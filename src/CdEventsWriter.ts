import moment = require("moment");
import chalk = require("chalk");
import fs = require("fs");
import * as _ from "lodash";
import prompts = require("prompts");

import {
  CdChangeReader,
  CdDeploymentReader,
  CdEventsQuery
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

  public async getChangesAndDeploymentsTimeline(
    query: CdEventsQuery
  ): Promise<any[]> {
    const commits = await this.changeReader.loadCommits(query);
    const changeList = commits.map((c: any) => {
      const isMergeCommit = c.parent_ids.length > 1;
      return {
        eventType: "change",
        revision: c.short_id,
        dateTime: CdEventsWriter.normalizeTime(c.created_at),
        isMergeCommit: isMergeCommit
      };
    });
    console.log(
      `${chalk.cyanBright(
        `>> Determined ${changeList.length} change events\n`
      )}`
    );

    const jobs = await this.deploymentReader.loadJobs(query);
    const deploymentList: any[] = jobs.map((j: any) => {
      return {
        eventType: "deployment",
        revision: j.commit.short_id,
        dateTime: CdEventsWriter.normalizeTime(j.finished_at),
        result: j.status,
        jobName: j.name,
        url: j.web_url
      };
    });
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

  public async listChangesAndDeployments(
    projectId: number,
    releaseBranch: string,
    deploymentJobs: string[],
    since: moment.Moment,
    until: moment.Moment
  ): Promise<any> {
    const gitlabQuery = {
      since: moment(since),
      until: moment(until),
      branch: releaseBranch,
      prodDeploymentJobNames: deploymentJobs
    };

    console.log(`Getting changes and deployments for project ${chalk.cyanBright(
      projectId
    )},
      focusing on changes and pipelines on branch(es) ${chalk.cyanBright(
        releaseBranch
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
      }\t${event.isMergeCommit || ""}\t${event.result || ""}`;
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
