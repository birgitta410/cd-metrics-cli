import yargs from "yargs";
import moment = require("moment");

import { Gitlab } from "gitlab";
import { GitlabClient, GitlabConfig } from "./GitlabClient";
import { CdEventsWriter } from './CdEventsWriter';
import { CdChangeService } from './CdChangeService';

const createGitlabClient = (projectId: number, host:string, token:string) => {
  const api = new Gitlab({
    host: host,
    token: token
  });

  const config = new GitlabConfig(
    "some url, TODO, currently never used!!",
    projectId
  );

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
        alias: "rb",
        default: "master",
        description: "Name of the branch that releases to production; ONLY ONE BRANCH IS POSSIBLE HERE, "
          + "use of release branches is currently not supported."
      })
      .option("releaseTags", {
        alias: "rt",
        description: "Search pattern for tags on releaseBranch from which production deployments happen"
          + " no regular expressions, but ^ and $ can be used to indicate start or end of a partial pattern "
          + "(e.g. ^release will find tags starting with 'release')"
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

    const gitlabClient = createGitlabClient(argv.projectId, gitlabUrl, gitlabToken);
    const changeService = new CdChangeService(gitlabClient);
    const writer = new CdEventsWriter(changeService, gitlabClient);
    await writer.listChangesAndDeployments(argv.projectId, argv.releaseBranch, argv.releaseTags, argv.deploymentJobs, since, until);
    
  })
  .argv