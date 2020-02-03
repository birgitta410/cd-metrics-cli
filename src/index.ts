import yargs from "yargs";
import moment = require('moment');
import { Gitlab } from "gitlab";
import { GitlabClient, GitlabConfig, GitlabQuery } from "./services/sources/gitlab/GitlabClient";

yargs
  .command('$0', 'list changes and deployments', (yargs) => {
    yargs
      .option('projectId', {
        alias: 'p',
        type: 'number',
        demand: true,
        describe: 'The Gitlab project ID'
      })
      .option('releaseBranch', {
        alias: 'b',
        default: 'master',
        description: 'Name of the branch that releases to production'
      })
      .option('gitlabUrl', {
        description: 'Base url of the Gitlab instance',
        demand: true
      })
      .option('gitlabToken', {
        demand: true,
        description: 'Gitlab API token'
      })
  }, async (argv: any) => {

    const projectId = argv.projectId;
    const releaseBranch = argv.releaseBranch;
    const gitlabUrl = argv.gitlabUrl;
    const gitlabToken = argv.gitlabToken;

    const gitlabQuery2020 = {
      since: "2020-01-01T00:10:00.000+00:00",
      until: GitlabClient.normalizedNow(),
      branch: releaseBranch
    };

    const gitlabQuery2ndHalf2019 = {
      since: "2019-06-01T00:10:00.000+00:00",
      until: "2019-12-25T00:10:00.000+00:00",
      branch: releaseBranch
    };

    const gitlabQuery = gitlabQuery2ndHalf2019;

    console.log(`Getting changes and deployments for project '${projectId}' and release branch '${releaseBranch}', between ${gitlabQuery.since} and ${gitlabQuery.until}`)

    const api = new Gitlab({
      host: gitlabUrl,
      token: gitlabToken
    });

    const config = new GitlabConfig(
      "some url, TODO, currently never used!!",
      projectId,
      "the-project");

    const eventsTimeLine = await new GitlabClient(api, config)
      .getChangesAndDeploymentsTimeline(projectId, gitlabQuery);
    eventsTimeLine.forEach(event => {
      console.log(`${event.eventType}\t${event.revision}\t${event.dateTime}\t${event.isMergeCommit || ""}\t${event.result || ""}`);
    });

  })
  .argv