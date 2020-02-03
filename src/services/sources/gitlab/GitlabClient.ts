
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

  public async loadPipelines(projectId: number, query: GitlabQuery): Promise<any> {
    return this.api.Pipelines.all(projectId, { 
      ref: query.branch,
      updated_after: query.since,
      updated_before: query.until
    });
  }

  public async loadCommits(
    projectId: number,
    query: GitlabQuery
  ): Promise<any> {
    return this.api.Commits.all(projectId, {
      refName: query.branch,
      maxPages: 1,
      since: query.since,
      until: query.until
    })
      .then((result: any) => {
        return result;
      })
      .catch(error => {
        console.log(`ERROR ${error}`);
      });
  }

  public static normalizeTime(time:string): string {
    // return moment(time, moment.ISO_8601).toISOString();
    return moment(time).format("YYYY-MM-DD HH:mm:ss");
    
  }

  public static normalizedNow(): string {
    // return moment(time, moment.ISO_8601).toISOString();
    return moment().format("YYYY-MM-DD HH:mm:ss");
    
  }

  public async getChangesAndDeploymentsTimeline(projectId: number, query: GitlabQuery): Promise<any[]> {
    return this
      .loadCommits(projectId, query)
      .then((commits: any[]) => {
        return commits.map(c => {
          const isMergeCommit = c.parent_ids.length > 1;
          return {
            eventType: "change",
            revision: c.short_id,
            dateTime: GitlabClient.normalizeTime(c.created_at),
            isMergeCommit: isMergeCommit
          };
        });
      }).then((changeList: any[]) => {
        return this.loadPipelines(projectId, query).then((pipelines: any[]) => {
          const deploymentList: any[] = pipelines.map(p => {
            return {
              eventType: "deployment",
              revision: p.sha.substr(0, 8),
              dateTime: GitlabClient.normalizeTime(p.created_at),
              result: p.status
            };
          });
          return _.chain(changeList)
            .union(deploymentList)
            .sortBy("dateTime")
            .value();
        });
      });
  }

}
