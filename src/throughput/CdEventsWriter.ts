import moment = require("moment");
import chalk = require("chalk");
import * as _ from "lodash";

import {
  CdDeploymentReader,
  CdEventsQuery,
  CdEvent
} from "./Model";
import { CdChangeService } from './CdChangeService';
import { Printer } from '../Printer';


export class CdEventsWriter {
  public static normalizeTime(time: string): string {
    return moment(time).format("YYYY-MM-DD HH:mm:ss");
  }

  public static normalizedNow(): string {
    return moment().format("YYYY-MM-DD HH:mm:ss");
  }

  public static gitlabDateString(date: moment.Moment): string {
    return date.format("YYYY-MM-DDT00:00:00.000+00:00");
  }

  constructor(
    private changeService: CdChangeService,
    private deploymentReader: CdDeploymentReader
  ) {}

  private async getTimelineForReleaseReferences(
    changeList: CdEvent[], 
    deploymentList: CdEvent[]) {
    
    const chronologicalChanges = _.sortBy(changeList, "dateTime");
    const chronologicalDeployments = _.sortBy(deploymentList, "dateTime");

    let result: CdEvent[] = [];
    const refsIncluded: string[] = [];

    chronologicalChanges.map(change => {
      if(change.ref) {
        (function createChronologicalListForRef() {
          if(! refsIncluded.includes(change.ref)) {
            const changesForRef = chronologicalChanges.filter(otherChange => {
              return otherChange.ref === change.ref;
            });
            const deploymentsForRef = chronologicalDeployments.filter(deployment => {
              return deployment.ref === change.ref;
            });
            const allEventsForRef = _.sortBy(changesForRef.concat(deploymentsForRef), "dateTime");
            console.log(`Adding ${allEventsForRef.length} events for ${change.ref}`);
            result = result.concat(allEventsForRef);
            refsIncluded.push(change.ref);
          }
        })();
        
      } else {
        result.push(change);
      }
    })

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
    if(query.branch.startsWith("^") || query.tags) {
      return this.getTimelineForReleaseReferences(changeList, deploymentList);
    } else {
      return this.getChronologicalTimelineFromBranch(changeList, deploymentList);
    }
  }

  public async listChangesAndDeployments(
    projectId: number,
    releaseBranch: string,
    releaseTags: string,
    deploymentJobs: string[],
    since: moment.Moment,
    until: moment.Moment
  ): Promise<any> {
    const gitlabQuery = {
      since: moment(since),
      until: moment(until),
      branch: releaseBranch,
      tags: releaseTags,
      prodDeploymentJobNames: deploymentJobs
    };

    console.log(`Getting changes and deployments for project ${chalk.cyanBright(
      projectId
    )},
      focusing on changes and pipelines on branch(es)/tag(s) ${chalk.cyanBright(
        gitlabQuery.tags || gitlabQuery.branch
      )},
      considering jobs named ${chalk.cyanBright(
        JSON.stringify(gitlabQuery.prodDeploymentJobNames)
      )} as production deployments.
      Timeline ${chalk.cyanBright(
        CdEventsWriter.gitlabDateString(gitlabQuery.since)
      )} - ${chalk.cyanBright(
      CdEventsWriter.gitlabDateString(gitlabQuery.until)
    )}
      `);

    const eventsTimeLine = await this.getChangesAndDeploymentsTimeline(
      gitlabQuery
    );

    const output = eventsTimeLine.map(event => {
      return `${event.eventType}\t${event.revision}\t${
        event.dateTime
      }\t${event.isMergeCommit || ""}\t${event.result || ""}\t${event.ref || ""}`;
    });

    console.log(`Output number of lines: ${output.length}`);

    await Printer.print(output);
  }
}
