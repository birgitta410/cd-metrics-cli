
import * as _ from "lodash";
import chalk from "chalk";

import { BuildServerClient, BuildServerConfig } from "@/services/sources/BuildServerClient";

import { Gitlab, JobScope } from "gitlab";
import moment = require('moment');

export class GitlabConfig implements BuildServerConfig {
  constructor(public url: string, public defaultProjectId: number, public defaultProjectName: string) {}
}

export interface GitlabQuery {
  since: moment.Moment,
  until: moment.Moment,
  branch: string,
  prodDeploymentJobNames: string[]
}

export class GitlabClient implements BuildServerClient {
  api: Gitlab;
  config: GitlabConfig;

  constructor(api: Gitlab, config: GitlabConfig) {
    this.api = api;
    this.config = config;
  }

  private findMostRecentJobRun(jobCandidates: any[], jobName:string): any {
    const jobsWithName: any = jobCandidates.filter(j => {
      return j.name === jobName;
    });
    if(jobsWithName.length === 1) {
      return jobsWithName[0];
    } else if (jobsWithName.length > 1) {
      return _.orderBy(jobsWithName, "created_at", "desc")[0];
    }
    return undefined;
  }

  public findProdDeploymentJob(allJobs: any[], pipelineId: string, prodDeploymentJobNameCandidates: string[]) : any {
    const deploymentCandidates = _.filter(allJobs, (j: any) => {
      return prodDeploymentJobNameCandidates.includes(j.name);
    });
    if(deploymentCandidates.length === 1) {
      return deploymentCandidates[0];
    } else if(deploymentCandidates.length > 1) {
      const prioritisedByNameAndTime = prodDeploymentJobNameCandidates.map(jobName => {
        return this.findMostRecentJobRun(deploymentCandidates, jobName);
      });
      const selectedJob = prioritisedByNameAndTime.length > 0 ? prioritisedByNameAndTime[0] : undefined;
      if(selectedJob) {
        console.log(`${chalk.yellow("WARNING")} Found ${deploymentCandidates.length} deployment jobs for pipeline ${pipelineId}, `
          + `choosing '${selectedJob.name}' run at ${selectedJob.created_at}`);
      } else {
        console.log(`${chalk.red("ERROR")} Found ${deploymentCandidates.length} deployment jobs for pipeline ${pipelineId}, `
          + `could not determine which one to choose`);
      }
      
      return selectedJob;

    } else {
      console.log(`${chalk.red("ERROR")} Found no deployment jobs for pipeline ${pipelineId} among jobs named ${allJobs.map((j: any) => j.name)}`);
      return undefined;
    }
  }

  public async loadJobs(projectId: number, query: GitlabQuery): Promise<any> {
    const queryParams = { 
      ref: query.branch,
      updated_after: GitlabClient.gitlabDateString(query.since),
      updated_before: GitlabClient.gitlabDateString(query.until)
    };
    const pipelines = await <any[]><unknown>this.api.Pipelines.all(projectId, queryParams);
    
    console.log(`Got ${pipelines.length} pipeline runs`);

    const filterForJobNames = query.prodDeploymentJobNames;
    const pipelineJobs = await Promise.all(
      pipelines.map(async (p: any) => {
        const jobs = await <any[]><unknown>this.api.Pipelines.showJobs(projectId, p.id);
        return this.findProdDeploymentJob(jobs, p.id, filterForJobNames);
      })
    );
    
    const allJobs = _.flatten(pipelineJobs);
    console.log(`Got and filtered ${allJobs.length} jobs`);
    return allJobs;
  };

  public async loadCommits(
    projectId: number,
    query: GitlabQuery
  ): Promise<any> {

    const commits = await <any[]><unknown>this.api.Commits.all(projectId, {
      refName: query.branch,
      since: GitlabClient.gitlabDateString(query.since),
      until: GitlabClient.gitlabDateString(query.until),
      all: true
    });
    console.log(`Got ${commits.length} commits`);
    return commits;
      
  }

  public static normalizeTime(time:string): string {
    return moment(time).format("YYYY-MM-DD HH:mm:ss");
  }

  public static normalizedNow(): string {
    return moment().format("YYYY-MM-DD HH:mm:ss");
  }

  public static gitlabDateString(date: moment.Moment): string {
    return date.format("YYYY-MM-DDT00:00:00.000+00:00");
  }
  

  public async getChangesAndDeploymentsTimeline(projectId: number, query: GitlabQuery): Promise<any[]> {
    // TODO: What if there are no environment branches?

    const commits = await this.loadCommits(projectId, query);
    const changeList = commits.map((c: any) => {
      const isMergeCommit = c.parent_ids.length > 1;
      return {
        eventType: "change",
        revision: c.short_id,
        dateTime: GitlabClient.normalizeTime(c.created_at),
        isMergeCommit: isMergeCommit
      };
    });
    const jobs = await this.loadJobs(projectId, query);
    const deploymentList: any[] = jobs.map((j: any) => {
      return {
        eventType: "deployment",
        revision: j.commit.short_id,
        dateTime: GitlabClient.normalizeTime(j.created_at),
        result: j.status,
        jobName: j.name
      };
    });
    return _.chain(changeList)
      .union(deploymentList)
      .sortBy("dateTime")
      .value();
  }

}
