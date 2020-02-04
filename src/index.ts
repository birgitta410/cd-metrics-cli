import yargs from "yargs";
import moment = require("moment");
import chalk = require("chalk");
import { Gitlab } from "gitlab";
import { GitlabClient, GitlabConfig } from "./services/sources/gitlab/GitlabClient";

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
        description: "Base url of the Gitlab instance",
        demand: true
      })
      .option("gitlabToken", {
        demand: true,
        description: "Gitlab API token"
      })
  }, async (argv: any) => {

    const projectId = argv.projectId;
    const releaseBranch = argv.releaseBranch;
    const gitlabUrl = argv.gitlabUrl;
    const gitlabToken = argv.gitlabToken;

    const gitlabQuery2020 = {
      since: "2020-01-01T00:10:00.000+00:00",
      until: GitlabClient.normalizedNow(),
      branch: releaseBranch,
      prodDeploymentJobNames: ["deploy_prod_sharenow", "install_build_deploy_static"]
    };

    // pickle-rick branch rename to master: October
    const gitlabQuery2ndHalf2019 = {
      since: "2019-10-07T00:10:00.000+00:00",
      until: "2019-12-25T00:10:00.000+00:00",
      branch: releaseBranch,
      prodDeploymentJobNames: ["deploy_prod_sharenow", "install_build_deploy_static"]
    };

    const gitlabQuery = gitlabQuery2ndHalf2019;

    console.log(`Getting changes and deployments for project ${chalk.blueBright(projectId)},
  focusing on changes and pipelines on branch ${chalk.blueBright(releaseBranch)},
  considering jobs named ${chalk.blueBright(gitlabQuery.prodDeploymentJobNames)} as production deployments.
  Timeline ${chalk.blueBright(gitlabQuery.since)} - ${chalk.blueBright(gitlabQuery.until)}`);

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