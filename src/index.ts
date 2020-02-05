import yargs from "yargs";
import prompts = require('prompts');
import chalk = require("chalk");
import moment = require("moment");

import { Gitlab } from "gitlab";
import { GitlabClient, GitlabConfig } from "./GitlabClient";

const listChangesAndDeployments = async (projectId:number, 
  releaseBranch:string,
  gitlabUrl:string,
  gitlabToken:string,
  deploymentJobs:string[],
  since: moment.Moment,
  until: moment.Moment) => {
  
  const gitlabQuery = {
    since: moment(since),
    until: moment(until),
    branch: releaseBranch,
    prodDeploymentJobNames: deploymentJobs
  };

  console.log(`Getting changes and deployments for project ${chalk.cyanBright(projectId)},
focusing on changes and pipelines on branch ${chalk.cyanBright(releaseBranch)},
considering jobs named ${chalk.cyanBright(JSON.stringify(gitlabQuery.prodDeploymentJobNames))} as production deployments.
Timeline ${chalk.cyanBright(GitlabClient.gitlabDateString(gitlabQuery.since))} - ${chalk.cyanBright(GitlabClient.gitlabDateString(gitlabQuery.until))}
`);

  const eventsTimeLine = await createGitlabClient(projectId, gitlabUrl, gitlabToken)
    .getChangesAndDeploymentsTimeline(projectId, gitlabQuery);

  const listEventsUserPrompt = await prompts({
    type: "confirm",
    name: "value",
    message: "Print events?",
    initial: true
  });
  
  if(listEventsUserPrompt.value === true) {
    eventsTimeLine.forEach(event => {
      console.log(`${event.eventType}\t${event.revision}\t${event.dateTime}\t${event.isMergeCommit || ""}\t${event.result || ""}`);
    });
  }
}

const createGitlabClient = (projectId: number, host:string, token:string) => {
  const api = new Gitlab({
    host: host,
    token: token
  });

  const config = new GitlabConfig(
    "some url, TODO, currently never used!!",
    projectId,
    "the-project");

  return new GitlabClient(api, config);
}

yargs
  .command("$0", "list changes and deployments", (yargs) => {
    yargs
      .option("projectId", {
        alias: "p",
        type: "number",
        demand: true,
        describe: "The Gitlab project ID"
      })
      .option("releaseBranch", {
        alias: "b",
        default: "master",
        description: "Name of the branch that releases to production"
      })
      .option("gitlabUrl", {
        description: "Base url of the Gitlab instance; falls back on GITLAB_URL env var if empty",
        type: "string"
      })
      .option("gitlabToken", {
        description: "Gitlab API token; falls back on GITLAB_TOKEN env var if empty",
        type: "string"
      })
      .option("deploymentJobs", {
        alias: "j",
        type: "array",
        demand: true,
        description: "List of names of jobs that deploy to production, space-separated (firstname secondname thirdname). Will be prioritised in order."
      })
      .option("since", {
        alias: "s",
        type: "string",
        demand: true,
        description: "Time frame: data since which date? YYYY-MM-HH"
      })
      .option("until", {
        alias: "u",
        type: "string",
        default: "today",
        description: "Time frame: data until which date? YYYY-MM-HH"
      })
  }, async (argv: any) => {

    const gitlabUrl = argv.gitlabUrl || process.env.GITLAB_URL;
    const gitlabToken = argv.gitlabToken || process.env.GITLAB_TOKEN;

    const since = moment(argv.since);
    const until = argv.until === "today" ? moment() : moment(argv.until);
    await listChangesAndDeployments(argv.projectId, 
      argv.releaseBranch, 
      gitlabUrl,
      gitlabToken, 
      argv.deploymentJobs, 
      since, 
      until);
    
  })
  .argv