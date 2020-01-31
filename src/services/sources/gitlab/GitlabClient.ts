
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
}
