import moment = require("moment");
import chalk = require("chalk");
import fs = require("fs");
import * as _ from "lodash";
import prompts = require("prompts");

import {
  CdChangeReader,
  CdDeploymentReader,
  CdEventsQuery,
  CdEvent
} from "./Interfaces";

const OUTPUT_FOLDER = "cd-metrics-cli-output";

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
    private changeReader: CdChangeReader,
    private deploymentReader: CdDeploymentReader
  ) {}

  private async getTimelineForReleaseReferences(query: CdEventsQuery) {
    const changeList: CdEvent[] = await this.changeReader.loadChanges(query);

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

    const chronologicalChanges = _.sortBy(changeList, "dateTime");
    const chronologicalDeployments = _.sortBy(deploymentList, "dateTime");

    let result: CdEvent[] = [];
    // TODO: Or, put all the changes and deployments for one ref into a list and sort that by time? And then "insert" that in the overall list?
    chronologicalChanges.map(change => {
      result.push(change);
      if(change.ref) {
        const deploymentsForRef = chronologicalDeployments.filter(deployment => {
          return deployment.ref === change.ref;
        });
        result = result.concat(deploymentsForRef);
      }
    })

    return result;
  }

  private async getChronologicalTimelineFromBranch(query: CdEventsQuery) {
    const changeList: CdEvent[] = await this.changeReader.loadChanges(query);

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

    return _.chain(changeList)
      .union(deploymentList)
      .sortBy("dateTime")
      .value();
  }

  public async getChangesAndDeploymentsTimeline(
    query: CdEventsQuery
  ): Promise<any[]> {
    if(query.branch.startsWith("^") || query.tags) {
      return this.getTimelineForReleaseReferences(query);
    } else {
      return this.getChronologicalTimelineFromBranch(query);
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

    const listEventsUserPrompt = await prompts({
      type: "select",
      name: "value",
      message: "Print events?",
      choices: [
        { title: "Yes", value: "yes" },
        { title: "No", value: "no" },
        { title: "To file", value: "file" }
      ],
      max: 1,
      hint: "- Space to select. Return to submit"
    });

    const output = eventsTimeLine.map(event => {
      return `${event.eventType}\t${event.revision}\t${
        event.dateTime
      }\t${event.isMergeCommit || ""}\t${event.result || ""}\t${event.ref || ""}`;
    });

    if (listEventsUserPrompt.value === "yes") {
      output.forEach(line => {
        console.log(`${line}`);
      });
    } else if (listEventsUserPrompt.value === "file") {
      const fileNamePrompt = await prompts({
        type: "text",
        name: "value",
        message: "File name? (will be written to ./outputs)"
      });
      const filePath = `./${OUTPUT_FOLDER}/${fileNamePrompt.value}`;
      console.log(`Writing output to file ${chalk.cyanBright(filePath)}`);
      fs.writeFileSync(`${filePath}`, output.join("\n"));
    }
  }
}
