import moment = require("moment");
import chalk = require("chalk");
import * as _ from "lodash";

import {
  CdDeploymentReader,
  CdEventsQuery,
  CdEvent,
  CdChangeEvent,
  CdDeploymentEvent
} from "./Model";
import { CdChangeService } from './CdChangeService';
import { Printer } from '../Printer';
import { TimeUtil } from '../TimeUtil';

export class CdThroughputEventSeries {

  constructor(
    public changes: CdChangeEvent[], 
    public deployments: CdDeploymentEvent[]) {
      this.changes = _.sortBy(changes, "dateTime");
      this.deployments = _.sortBy(deployments, "dateTime");
  }

  private average = (numbers) => {
    return sum(numbers) / (numbers.length || 1);
  }
  
  private window = (change: CdChangeEvent, windowInDays: number) => {
    const halfWindow = Math.round(windowInDays/2);
    const startWindow = moment(change.dateTime).subtract(halfWindow, "days").minutes(0).hours(0);
    const endWindow = moment(change.dateTime).add(halfWindow, "days").minutes(0).hours(0);
    const changesInWindow = this.changes.filter(otherChange => {
      const otherChangeTime = moment(otherChange.dateTime);
      return otherChangeTime.isAfter(startWindow) && otherChangeTime.isBefore(endWindow);
    });
    return {
      change: change,
      window: changesInWindow
    };
  }
  
  public addRollingAverages(windowInDays: number): void {
    _.chain(this.changes)
        .map((change) => {
          return this.window(change, windowInDays)
        })
        .map((changeWindow) => {
          const meanInMinutes = _.meanBy(changeWindow.window, (change) => {
            return change.metrics!.cycleTime.asMinutes();
          });
          changeWindow.change.metrics!.cycleTimeRollingAverage = moment.duration(meanInMinutes, "minutes");
        })
        .value();
  }

  public addThroughputMetrics(): void {
    
    this.changes.forEach(changeEvent => {
      const nextDeployment = this.deployments.find(deploymentEvent => {
        const isNextSuccessfulDeployment =  moment(deploymentEvent.dateTime).isAfter(moment(changeEvent.dateTime))
          && deploymentEvent.result === "success";
        return isNextSuccessfulDeployment;
      });

      if(nextDeployment) {
        nextDeployment.metrics = nextDeployment.metrics || { changeSetSize: 0 };
        nextDeployment.metrics.changeSetSize ++;

        changeEvent.metrics = {
          deployment: nextDeployment,
          cycleTime: moment.duration(moment(nextDeployment.dateTime).diff(moment(changeEvent.authorDateTime)))
        };
      }

    });

  }
}

export class CdThroughputCalculator {
  
  constructor(
    private changeService: CdChangeService,
    private deploymentReader: CdDeploymentReader
  ) {}

  private async getTimelineForReleaseReferences(
    changeList: CdEvent[], 
    deploymentList: CdEvent[]) {

    const nonReffedEvents = _.sortBy(_.concat(
      changeList.filter(event => { return event.ref === undefined || event.ref === ""; }),
      deploymentList.filter(event => { return event.ref === undefined || event.ref === ""; }),
    ), "dateTime");
    
    const eventsByRefs:any = {};
    const refNames = _.compact(_.uniq(_.concat(
      changeList.map(event => event.ref),
      deploymentList.map(event => event.ref),
    )));
    refNames.forEach((refName:string) => {
      const refEvents = _.sortBy(_.compact(_.concat(
        changeList.filter(event => { return event.ref === refName; }),
        deploymentList.filter(event => { return event.ref === refName; }),
      )), "dateTime");
      eventsByRefs[refName] = refEvents;
    });
    

    let result: CdEvent[] = [];
    nonReffedEvents.forEach(nonRefEvent => {
      const refGroupsToPushIn = _.keys(eventsByRefs).filter(refName => {
        const firstEventInGroup = eventsByRefs[refName][0];
        return moment(firstEventInGroup.dateTime).isBefore(moment(nonRefEvent.dateTime));
      });
      refGroupsToPushIn.forEach(refName => {
        result.push(...eventsByRefs[refName]);
        delete eventsByRefs[refName];
      });
      
      result.push(nonRefEvent);
    });

    return result;
  }

  private async getChronologicalTimelineFromBranch(changeList: CdEvent[], 
    deploymentList: CdEvent[]) {
    
    return _.chain(changeList)
      .union(deploymentList)
      .sortBy("dateTime")
      .value();
  }

  public async getChangesAndDeploymentsTimeline(
    query: CdEventsQuery
  ): Promise<any[]> {
    const changeList: CdEvent[] = await this.changeService.loadChanges(query);

    console.log(
      `${chalk.cyanBright(
        `>> Determined ${changeList.length} change events\n`
      )}`
    );

    const deploymentList: CdEvent[] = await this.deploymentReader.loadProductionDeployments(query);
    console.log(
      `${chalk.cyanBright(
        `>> Determined ${deploymentList.length} production deployment events\n`
      )}`
    );
    if(query.branch !== "master" || query.tags) {
      return this.getTimelineForReleaseReferences(changeList, deploymentList);
    } else {
      return this.getChronologicalTimelineFromBranch(changeList, deploymentList);
    }
  }

  public async printChangesAndDeployments(
    releaseBranch: string,
    releaseTags: string,
    deploymentJobs: string[],
    since: moment.Moment,
    until: moment.Moment
  ): Promise<any> {
    const gitlabQuery = {
      since: since,
      until: until,
      branch: releaseBranch,
      tags: releaseTags,
      prodDeploymentJobNames: deploymentJobs
    };

    console.log(`Getting changes and deployments for your project,
      focusing on changes and pipelines on branch(es)/tag(s) ${chalk.cyanBright(
        gitlabQuery.tags || gitlabQuery.branch
      )},
      considering jobs named ${chalk.cyanBright(
        JSON.stringify(gitlabQuery.prodDeploymentJobNames)
      )} as production deployments.
      Timeline ${chalk.cyanBright(
        TimeUtil.gitlabApiDateString(gitlabQuery.since)
      )} - ${chalk.cyanBright(
      TimeUtil.gitlabApiDateString(gitlabQuery.until)
    )}
      `);

    const eventsTimeLine = await this.getChangesAndDeploymentsTimeline(
      gitlabQuery
    );

    const header = `type\trevision\tcreation time\tis merge?\tresult\tref\tauthor time`;
    const output = eventsTimeLine.map(event => {
      return `${event.eventType}\t${event.revision}\t${
        event.dateTime
      }\t${event.isMergeCommit || ""}\t${event.result || ""}\t${event.ref || ""}\t${event.authorDateTime || ""}`;
    });

    console.log(`Output number of lines: ${output.length}`);

    await Printer.print(_.concat([header], output));
  }
}
