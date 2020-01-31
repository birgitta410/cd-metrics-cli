import yargs from "yargs";
import { Gitlab } from "gitlab";
import { GitlabClient, GitlabConfig } from "./services/sources/gitlab/GitlabClient";
import { release } from 'os';

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

    console.log(`Getting changes and deployments for project ${projectId} and release branch ${releaseBranch}`)

    const api = new Gitlab({
      host: gitlabUrl,
      token: gitlabToken
    });

    const config = new GitlabConfig(
      "some url, TODO, currently never used!!",
      projectId,
      "the-project");

    await new GitlabClient(api, config).listChangesAndDeployments(projectId, releaseBranch);

  })
  .argv