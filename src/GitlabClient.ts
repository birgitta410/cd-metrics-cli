
import * as _ from "lodash";
import chalk from "chalk";

import { Gitlab } from "gitlab";

import { RequestHelper } from "./RequestHelper";
import { CdEventsQuery, CdChangeReader, CdDeploymentReader } from "./Interfaces";
import { CdEventsWriter } from "./CdEventsWriter";

export class GitlabConfig {
  constructor(public url: string, public defaultProjectId: number, public defaultProjectName: string) {}
}

export class GitlabClient implements CdChangeReader, CdDeploymentReader {
  api: Gitlab;
  config: GitlabConfig;

  constructor(api: Gitlab, config: GitlabConfig) {
    this.api = api;
    this.config = config;
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

  public async loadJobs(projectId: number, query: CdEventsQuery): Promise<any[]> {
    const queryParams = { 
      ref: query.branch,
      updated_after: CdEventsWriter.gitlabDateString(query.since),
      updated_before: CdEventsWriter.gitlabDateString(query.until)
    };
    const pipelines = await <any[]><unknown>this.api.Pipelines.all(projectId, queryParams);
    
    console.log(`Got ${chalk.cyanBright(pipelines.length)} pipeline runs on ${chalk.cyanBright(queryParams.ref)}`);

    const filterForJobNames = query.prodDeploymentJobNames;

    const jobsForPipelinesInBranch = await RequestHelper.executeInChunks(pipelines, async (p: any) => {
      const jobs = await <any[]><unknown>this.api.Pipelines.showJobs(projectId, p.id);
      return this.findProdDeploymentJob(jobs, p.id, filterForJobNames);
    });
    
    const compactedJobs = _.compact(jobsForPipelinesInBranch);
    console.log(`Got and filtered ${chalk.cyanBright(compactedJobs.length)} jobs`);
    return compactedJobs;
  };

  public async getBranches(
    projectId: number,
    branchSearchPattern: string
  ): Promise<any[]> {
    const branches = await <any[]><unknown>this.api.Branches.all(projectId, {
      search: branchSearchPattern
    });
    return branches.map(b => b.name);
  }

  public async loadCommits(
    projectId: number,
    query: CdEventsQuery
  ): Promise<any[]> {

    const targetBranchPattern = query.branch;
    let targetBranches = [query.branch];
    if(targetBranchPattern.startsWith("^")) {
      targetBranches = await this.getBranches(projectId, targetBranchPattern);
    }

    const commitsPerBranch = await Promise.all(targetBranches.map(async  (branchName) => {
      return <any[]><unknown>this.api.Commits.all(projectId, {
        refName: branchName,
        since: CdEventsWriter.gitlabDateString(query.since),
        until: CdEventsWriter.gitlabDateString(query.until),
        all: true
      });
    }));
    
    const commits = _.chain(commitsPerBranch)
      .flatten()
      .uniqBy("short_id")
      .value();
    console.log(`Got ${chalk.cyanBright(commits.length)} unique commits from branch(es) ${chalk.cyanBright(targetBranches)}`);
    return commits;
      
  }

}
