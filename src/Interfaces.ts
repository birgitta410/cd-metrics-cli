import moment = require("moment");

export interface CdEventsQuery {
  since: moment.Moment;
  until: moment.Moment;
  branch: string;
  prodDeploymentJobNames: string[];
}

export interface CdChangeReader {
  loadCommits(projectId: number, query: CdEventsQuery): Promise<any[]>;
}

export interface CdDeploymentReader {
  loadJobs(projectId: number, query: CdEventsQuery): Promise<any[]>;
}

