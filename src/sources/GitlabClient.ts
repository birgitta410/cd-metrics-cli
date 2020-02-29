
import * as _ from "lodash";
import moment from "moment";
import chalk from "chalk";

import { Gitlab } from "gitlab";

import { RequestHelper } from "../RequestHelper";
import { CdEventsQuery, CdChangeReader, CdDeploymentReader, CdDeploymentEvent, CdChangeEvent, CdChangeReference } from "../throughput/Model";
import { CdThroughputCalculator } from "../throughput/CdThroughputCalculator";
import { CdPipelineReader, CdPipelineRun, CdJobRun, CdStabilityQuery } from '@/stability/Model';

export class GitlabConfig {
  constructor(public url: string, public projectId: number) {}
}

export class GitlabClient implements CdChangeReader, CdDeploymentReader, CdPipelineReader {
  
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

  private jobToEvent(gitlabJob: any): CdDeploymentEvent {
    return {
      eventType: "deployment",
      revision: gitlabJob.commit.short_id,
      dateTime: CdThroughputCalculator.normalizeTime(gitlabJob.finished_at),
      result: gitlabJob.status,
      jobName: gitlabJob.name,
      url: gitlabJob.web_url,
      ref: gitlabJob.ref
    };
  }

  private async getPipelinesForReferences(query: CdEventsQuery): Promise<any[]> {

    let targetRefs = await this.getRefNames(query);
    const pipelinesPerRef = await Promise.all(targetRefs.map(async  (refName) => {
      return <any[]><unknown>this.api.Pipelines.all(this.projectId, {
        ref: refName,
        updated_after: CdThroughputCalculator.gitlabDateString(query.since),
        updated_before: CdThroughputCalculator.gitlabDateString(query.until)
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
      .map(this.jobToEvent)
      .value();
    console.log(`Got and filtered ${chalk.cyanBright(compactedJobs.length)} jobs`);
    return compactedJobs;
  };

  private commitToEvent(gitlabCommit: any): CdChangeEvent {
    const isMergeCommit = gitlabCommit.parent_ids.length > 1;
    return {
      eventType: "change",
      revision: gitlabCommit.short_id,
      dateTime: CdThroughputCalculator.normalizeTime(gitlabCommit.created_at),
      isMergeCommit: isMergeCommit
    };
  }

  public async loadBranches(branchSearchPattern: string): Promise<CdChangeReference[]> {
    const branches = await <any[]><unknown>this.api.Branches.all(this.projectId, {
      search: branchSearchPattern
    });
    return branches.map((b) => {
      return {
        name: b.name,
        commit: b.commit.short_id
      };
    });
  }

  private async getRefNames(query: CdEventsQuery): Promise<string[]> {
    if(query.tags !== undefined) {
      const tags = await this.loadTags(query.tags);
      return tags.map(t => t.name);
    } else {
      const branches = await this.loadBranches(query.branch);
      return branches.map(b => b.name);
    }
  }

  public async loadTags(tagSearchPattern: string): Promise<CdChangeReference[]> {
    const tags = await <any[]><unknown>this.api.Tags.all(this.projectId, {
      search: tagSearchPattern
    });
    return tags.map((b) => {
      return {
        name: b.name,
        commit: b.commit.short_id
      };
    });
  }
  
  public async loadCommitsForBranch(query: CdEventsQuery, branch: CdChangeReference): Promise<CdChangeEvent[]> {
    const branchName = branch.name;
    const commits = await <any[]><unknown>this.api.Commits.all(this.projectId, {
      refName: branchName,
      since: CdThroughputCalculator.gitlabDateString(query.since),
      until: CdThroughputCalculator.gitlabDateString(query.until),
      all: true
    });
    return _.chain(commits)
      .flatten()
      .map((c: any) => {
        return this.commitToEvent(c);
      })
      .value();
  }

  private async getAllPipelines(since: moment.Moment, until: moment.Moment): Promise<any[]> {

    const pipelineRuns = await <any[]><unknown>this.api.Pipelines.all(this.projectId, {
        updated_after: CdThroughputCalculator.gitlabDateString(since),
        updated_before: CdThroughputCalculator.gitlabDateString(until)
      });
    
    console.log(`Got ${chalk.cyanBright(pipelineRuns.length)} pipeline runs`);
    return pipelineRuns;
  }

  private toCdJobRun(gitlabJobRun:any): CdJobRun {
    return {
      id: gitlabJobRun.id,
      jobName: gitlabJobRun.name,
      stageName: gitlabJobRun.stage,
      result: gitlabJobRun.status,
      dateTime: CdThroughputCalculator.normalizeTime(gitlabJobRun.finished_at)
    };
  }

  private constructPipelineName(jobRuns: CdJobRun[]) {
    // Gitlab does not have a concept of names for pipelines, but this is useful/necessary to group pipelines for the MTTR
    const stageNames = _.uniq(jobRuns.map(job => {return job.stageName;}));
    return stageNames.join(":");
  }

  private toCdPipelineRun(gitlabPipelineRun:any, jobRuns: CdJobRun[]): CdPipelineRun {
    return {
      id: gitlabPipelineRun.id, 
      pipelineName: this.constructPipelineName(jobRuns),
      result: gitlabPipelineRun.status,
      dateTime: CdThroughputCalculator.normalizeTime(gitlabPipelineRun.updated_at),
      jobs: jobRuns
    };
  }

  public async loadPipelines(query: CdStabilityQuery): Promise<CdPipelineRun[]> {

    const pipelineRuns = await this.getAllPipelines(query.since, query.until);
    
    const allPipelineRuns: CdPipelineRun[] = await RequestHelper.executeInChunks(pipelineRuns, async (p: any) => {
      
      const jobsInPipelineRun = await <any[]><unknown>this.api.Pipelines.showJobs(this.projectId, p.id);
      const jobRuns = jobsInPipelineRun.map(this.toCdJobRun);
      return this.toCdPipelineRun(p, jobRuns);
    });
    
    return allPipelineRuns;

  }

}
