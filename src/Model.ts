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
  ref?: string
}

export interface CdChangeEvent extends CdEvent {
  isMergeCommit: boolean
};

export interface CdDeploymentEvent extends CdEvent {
  result: string,
  jobName: string,
  url?: string
};

export interface CdChangeReference {
  name: string,
  commit: string
}

export interface CdChangeReader {
  loadTags(tagsPattern: string): Promise<CdChangeReference[]>;
  loadBranches(branchPattern: string): Promise<CdChangeReference[]>;
  loadCommitsForBranch(query: CdEventsQuery, branch: CdChangeReference): Promise<CdChangeEvent[]>;
}

export interface CdDeploymentReader {
  loadProductionDeployments(query: CdEventsQuery): Promise<CdDeploymentEvent[]>;
}

