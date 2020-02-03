
import * as _ from "lodash";

import { BuildServerClient, BuildServerConfig } from "@/services/sources/BuildServerClient";

import { Gitlab } from "gitlab";
import moment = require('moment');

export class GitlabConfig implements BuildServerConfig {
  constructor(public url: string, public defaultProjectId: number, public defaultProjectName: string) {}
}

export interface GitlabQuery {
  since: string,
  until: string,
  branch: string
}

export class GitlabClient implements BuildServerClient {
  api: Gitlab;
  config: GitlabConfig;

  constructor(api: Gitlab, config: GitlabConfig) {
    this.api = api;
    this.config = config;
  }

  public async loadJobs(projectId: number, query: GitlabQuery): Promise<any> {
    const result = await <any[]><unknown>this.api.Pipelines.all(projectId, { 
      ref: query.branch,
      updated_after: query.since,
      updated_before: query.until
    });
    
    console.log(`Got ${result.length} pipeline runs`);
    return result;
  }

  public async loadCommits(
    projectId: number,
    query: GitlabQuery
  ): Promise<any> {

    const commits = await <any[]><unknown>this.api.Commits.all(projectId, {
      refName: query.branch,
      since: query.since,
      until: query.until
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
        revision: j.sha.substr(0, 8),
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
