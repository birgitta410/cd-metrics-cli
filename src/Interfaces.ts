import moment = require("moment");

export interface CdEventsQuery {
  since: moment.Moment;
  until: moment.Moment;
  branch: string;
  prodDeploymentJobNames: string[];
}

export interface CdChangeReader {
  loadCommits(query: CdEventsQuery): Promise<any[]>;
}

export interface CdDeploymentReader {
  loadJobs(query: CdEventsQuery): Promise<any[]>;
}

