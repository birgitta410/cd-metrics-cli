
import * as _ from "lodash";
import chalk from "chalk";

import { Gitlab } from "gitlab";

import { RequestHelper } from "./RequestHelper";
import { CdEventsQuery, CdChangeReader, CdDeploymentReader, CdDeploymentEvent, CdChangeEvent } from "./Interfaces";
import { CdEventsWriter } from "./CdEventsWriter";

export class GitlabConfig {
  constructor(public url: string, public projectId: number) {}
}

export class GitlabClient implements CdChangeReader, CdDeploymentReader {
  api: Gitlab;
  config: GitlabConfig;
  projectId: number;

  constructor(api: Gitlab, config: GitlabConfig) {
    this.api = api;
    this.config = config;
    this.projectId = config.projectId;
  }

  private findMostRecentJobRun(jobCandidates: any[], jobName:string): any | undefined {
    const jobsWithName: any = jobCandidates.filter(j => {
      return j.name === jobName && j.finished_at;
    });
    if(jobsWithName.length === 1) {
      return jobsWithName[0];
    } else if (jobsWithName.length > 1) {
      return _.orderBy(jobsWithName, "created_at", "desc")[0];
    }
    return undefined;
  }

  public findProdDeploymentJob(allJobs: any[], pipelineId: string, prodDeploymentJobNameCandidates: string[]) : any | undefined {
    
    const deploymentCandidates = _.filter(allJobs, (j: any) => {
      return prodDeploymentJobNameCandidates.includes(j.name);
    });
    if(deploymentCandidates.length === 1) {
      return deploymentCandidates[0].finished_at ? deploymentCandidates[0] : undefined;
    } else if(deploymentCandidates.length > 1) {
      const prioritisedByNameAndTime = _.compact(prodDeploymentJobNameCandidates.map(jobName => {
        return this.findMostRecentJobRun(deploymentCandidates, jobName);
      }));
      const selectedJob = prioritisedByNameAndTime.length > 0 ? prioritisedByNameAndTime[0] : undefined;
      if(selectedJob) {
        console.log(`${chalk.yellow("WARNING")} Found ${deploymentCandidates.length} deployment jobs for pipeline ${pipelineId}, `
          + `choosing '${selectedJob.name}' run at ${selectedJob.created_at}`);
      } else {
        console.log(`${chalk.yellow("WARNING")} Found ${deploymentCandidates.length} deployment jobs for pipeline ${pipelineId}, `
          + `could not determine which one to choose`);
      }
      
      return selectedJob;

    } else {
      console.log(`${chalk.yellow("WARNING")} Found no deployment jobs for pipeline ${pipelineId} among jobs named ${allJobs.map((j: any) => j.name)}`);
      return undefined;
    }
  }

  private mapToDeploymentEvent(gitlabJob: any): CdDeploymentEvent {
    return {
      eventType: "deployment",
      revision: gitlabJob.commit.short_id,
      dateTime: CdEventsWriter.normalizeTime(gitlabJob.finished_at),
      result: gitlabJob.status,
      jobName: gitlabJob.name,
      url: gitlabJob.web_url
    };
  }

  private async getPipelinesForReferences(query: CdEventsQuery): Promise<any[]> {

    let targetRefs = await this.getRefNames(query);
    const pipelinesPerRef = await Promise.all(targetRefs.map(async  (refName) => {
      return <any[]><unknown>this.api.Pipelines.all(this.projectId, {
        ref: refName,
        updated_after: CdEventsWriter.gitlabDateString(query.since),
        updated_before: CdEventsWriter.gitlabDateString(query.until)
      });
    }));
    const pipelines = _.flatten(pipelinesPerRef);
    
    console.log(`Got ${chalk.cyanBright(pipelines.length)} pipeline runs on branch(es)/tag(s) ${chalk.cyanBright(targetRefs)}`);
    return pipelines;
  }

  public async loadProductionDeployments(query: CdEventsQuery): Promise<CdDeploymentEvent[]> {
    const pipelines = await this.getPipelinesForReferences(query);
    
    const filterForJobNames = query.prodDeploymentJobNames;

    const jobsForPipelinesInBranch = await RequestHelper.executeInChunks(pipelines, async (p: any) => {
      const jobs = await <any[]><unknown>this.api.Pipelines.showJobs(this.projectId, p.id);
      return this.findProdDeploymentJob(jobs, p.id, filterForJobNames);
    });
    
    const compactedJobs = _.chain(jobsForPipelinesInBranch)
      .compact()
      .map(this.mapToDeploymentEvent)
      .value();
    console.log(`Got and filtered ${chalk.cyanBright(compactedJobs.length)} jobs`);
    return compactedJobs;
  };

  private async getBranches(
    branchSearchPattern: string
  ): Promise<any[]> {
    const branches = await <any[]><unknown>this.api.Branches.all(this.projectId, {
      search: branchSearchPattern
    });
    return branches.map(b => b.name);
  }

  private async loadTags(
    tagSearchPattern: string
  ): Promise<any[]> {
    const tags = await <any[]><unknown>this.api.Tags.all(this.projectId, {
      search: tagSearchPattern
    });
    return tags.map(b => b.name);
  }

  private async getTargetBranches(branchQuery: string): Promise<string[]> {
    const targetBranchPattern = branchQuery;
    if(targetBranchPattern.startsWith("^")) {
      return await this.getBranches(targetBranchPattern);
    }
    return [ branchQuery ];
  }

  private async getRefNames(query: CdEventsQuery): Promise<string[]> {
    if(query.tags !== undefined) {
      return await this.loadTags(query.tags);
    } else {
      return await this.getTargetBranches(query.branch);
    }
  }

  private mapToChangeEvent(gitlabCommit: any): CdChangeEvent {
    const isMergeCommit = gitlabCommit.parent_ids.length > 1;
    return {
      eventType: "change",
      revision: gitlabCommit.short_id,
      dateTime: CdEventsWriter.normalizeTime(gitlabCommit.created_at),
      isMergeCommit: isMergeCommit
    };
  }

  public async loadChanges(
    query: CdEventsQuery
  ): Promise<CdChangeEvent[]> {

    let targetRefs = await this.getRefNames(query);

    const commitsPerBranch = await Promise.all(targetRefs.map(async  (branchName: any) => {
      return <any[]><unknown>this.api.Commits.all(this.projectId, {
        refName: branchName,
        since: CdEventsWriter.gitlabDateString(query.since),
        until: CdEventsWriter.gitlabDateString(query.until),
        all: true
      });
    }));
    
    const commits = _.chain(commitsPerBranch)
      .flatten()
      .uniqBy("short_id")
      .map(this.mapToChangeEvent)
      .value();
    console.log(`Got ${chalk.cyanBright(commits.length)} unique commits from branch(es)/tag(s) ${chalk.cyanBright(targetRefs)}`);
    return commits;
      
  }

}
