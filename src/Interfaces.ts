import moment = require("moment");

export interface CdEventsQuery {
  since: moment.Moment;
  until: moment.Moment;
  branch: string;
  tags?: string;
  prodDeploymentJobNames: string[];
}

export interface CdEvent {
  eventType: "change" | "deployment",
  revision: string,
  dateTime: string,
}

export interface CdChangeEvent extends CdEvent {
  isMergeCommit: boolean,
  ref?: string
};

export interface CdDeploymentEvent extends CdEvent {
  result: string,
  jobName: string,
  url?: string
};

export interface CdChangeReader {
  loadChanges(query: CdEventsQuery): Promise<CdChangeEvent[]>;
}

export interface CdDeploymentReader {
  loadProductionDeployments(query: CdEventsQuery): Promise<CdDeploymentEvent[]>;
}

