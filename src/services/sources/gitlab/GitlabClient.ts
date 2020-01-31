
import * as _ from "lodash";

import { BuildServerClient, BuildServerConfig } from "@/services/sources/BuildServerClient";

import { Gitlab } from "gitlab";

export class GitlabConfig implements BuildServerConfig {
  constructor(public url: string, public defaultProjectId: number, public defaultProjectName: string) {}
}
export class GitlabClient implements BuildServerClient {
  api: Gitlab;
  config: GitlabConfig;

  constructor(api: Gitlab, config: GitlabConfig) {
    this.api = api;
    this.config = config;
  }

  public async loadPipelines(projectId: number, refName: string): Promise<any> {
    return this.api.Pipelines.all(projectId, { refName: refName });
  }

  public async loadCommits(
    projectId: number,
    refName: string,
    numCommits = 50
  ): Promise<any> {
    return this.api.Commits.all(projectId, {
      refName: refName,
      maxPages: 1,
      perPage: numCommits
    })
      .then((result: any) => {
        return result;
      })
      .catch(error => {
        console.log(`ERROR ${error}`);
      });
  }

  public async listChangesAndDeployments(projectId: number, releaseBranch: string): Promise<any> {
      this
        .loadCommits(projectId, releaseBranch, 20)
        .then((commits: any[]) => {
          const lines = commits.map(c => {
            const isMergeCommit = c.parent_ids.length > 1;
            return `${c.short_id}\t${c.created_at}\t${isMergeCommit}`;
          });
          console.log(`
  CHANGES ON MASTER
  revision\ttime\tisMergeCommit
  ${lines.join(`\n`)}`);
        }).then(() => {
          return this.loadPipelines(projectId, releaseBranch);
        })
        .then((pipelines: any[]) => {
          const lines = pipelines.map(p => {
            return `${p.sha}\t${p.created_at}\t${p.status}`;
          });
          console.log(`
  DEPLOYMENTS FROM MASTER
  revision\ttime\tstatus
  ${lines.join(`\n`)}`);
        });
  }
}
