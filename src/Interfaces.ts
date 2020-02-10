import moment = require("moment");

export interface CdEventsQuery {
  since: moment.Moment;
  until: moment.Moment;
  branch: string;
  prodDeploymentJobNames: string[];
}

export interface CdChangeReader {
  loadChanges(query: CdEventsQuery): Promise<any[]>;
}

export interface CdDeploymentReader {
  loadProductionDeployments(query: CdEventsQuery): Promise<any[]>;
}

