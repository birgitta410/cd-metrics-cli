import moment = require("moment");

export interface CdEvent {
  eventType: "change" | "deployment",
  revision: string,
  dateTime: string,
  ref?: string
}

export interface CdChangeEvent extends CdEvent {
  authorDateTime: string,
  isMergeCommit: boolean
};

export interface CdDeploymentEvent extends CdEvent {
  result: string,
  jobName: string,
  url?: string
};



export interface CdChangeReference {
  name: string,
  commit: string,
  originalName?: string
}

export interface CdEventsQuery {
  /**
   * Start date of the time frame to look for data
   */
  since: moment.Moment;
  /**
   * End date of the time frame to look for data
   */
  until: moment.Moment;
  /**
   * Branch that is releasing changes to production
   */
  branch: string;
  /**
   * If production deployments are triggered by tags,
   * this is a search pattern for those tags
   */
  tags?: string;
  /**
   * Name(s) of the job that deploys to production
   * (Usually just one, but could be multiple, e.g. if
   * pipeline got refactored)
   */
  prodDeploymentJobNames: string[];
}

export interface CdChangeReader {
  /**
   * Load all git tags that conform to the given pattern
   * (matching capabilities depend on the given reader implementation)
   */
  loadTags(tagsPattern: string): Promise<CdChangeReference[]>;
  /**
   * Load all branches that conform to the given pattern
   * (matching capabilities depend on the given reader implementation)
   */
  loadBranches(branchPattern: string): Promise<CdChangeReference[]>;
  /**
   * Load all commits on the given branch in time frame query.since-query.until
   */
  loadCommitsForBranch(query: CdEventsQuery, branch: CdChangeReference): Promise<CdChangeEvent[]>;
}

export interface CdDeploymentReader {
  /**
   * Loads all production deployments from query.branch in the given time frame 
   * query.since-query.until. If query.tags is set, it should consider those tags as 
   * triggers for production deployments.
   */
  loadProductionDeployments(query: CdEventsQuery): Promise<CdDeploymentEvent[]>;
}

