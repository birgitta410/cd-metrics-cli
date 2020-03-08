import yargs from "yargs";
import moment = require("moment");

import { Gitlab } from "gitlab";
import { GitlabClient, GitlabConfig } from "./sources/GitlabClient";
import { CdThroughputCalculator } from './throughput/CdThroughputCalculator';
import { CdChangeService } from './throughput/CdChangeService';
import { CdStabilityCalculator } from './stability/CdStabilityCalculator';
import { GitRepoClient } from './sources/GitRepoClient';

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

const withProjectIdOption = (yargs: any) => {
  return yargs
    .option("projectId", {
      alias: "p",
      type: "number",
      demand: true,
      describe: "The Gitlab project ID"
    });
};

const withRepoPathOption = (yargs: any) => {
  return yargs
    .option("repo", {
      type: "string",
      describe: "Path to a local git repository to use as source of changes"
    });
};

const withReleaseBranchOption = (yargs: any) => {
  return yargs.option("releaseBranch", {
    alias: "rb",
    default: "master",
    description: "Name of the branch that releases to production; ONLY ONE BRANCH IS POSSIBLE HERE, "
      + "use of release branches is currently not supported."
  });
};

const withBranchesOption = (yargs: any) => {
  return yargs.option("branches", {
    alias: "b",
    type: "array",
    default: ["master"],
    description: "List of branches to get pipeline runs from"
  });
};

const withReleaseTagsOption = (yargs: any) => {
  return yargs.option("releaseTags", {
    alias: "rt",
    description: "Search pattern for tags on releaseBranch from which production deployments happen"
      + " no regular expressions, but ^ and $ can be used to indicate start or end of a partial pattern "
      + "(e.g. ^release will find tags starting with 'release')"
  });
};

const withGitlabOptions = (yargs: any) => {
  return yargs.option("gitlabUrl", {
    description: "Base url of the Gitlab instance; falls back on GITLAB_URL env var if empty",
    type: "string"
  })
  .option("gitlabToken", {
    description: "Gitlab API token; falls back on GITLAB_TOKEN env var if empty",
    type: "string"
  });
};

const withDateRangeOptions = (yargs: any) => {
  return yargs.option("since", {
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
  });
};

const withDeploymentJobsOption = (yargs: any) => {
  return yargs.option("deploymentJobs", {
    alias: "j",
    type: "array",
    demand: true,
    description: "List of names of jobs that deploy to production, space-separated (firstname secondname thirdname). Will be prioritised in order."
  });
};

const localRepoPathFromRemote = (remotePath: string): string | undefined => {
  if(remotePath) {
    const repoNameMatch = remotePath.match(/\/([^\/]*)\.git/);
    if(repoNameMatch && repoNameMatch.length > 0) {
      const repoName = repoNameMatch[1];
      return `./repos/${repoName}`;
    }
  }
}

yargs
  .command("throughput", "list changes and deployments", (yargs) => {
      withProjectIdOption(yargs);
      withRepoPathOption(yargs);
      withReleaseBranchOption(yargs);
      withReleaseTagsOption(yargs);
      withGitlabOptions(yargs);
      withDateRangeOptions(yargs);
      withDeploymentJobsOption(yargs);
  }, async (argv: any) => {

    const gitlabUrl = argv.gitlabUrl || process.env.GITLAB_URL;
    const gitlabToken = argv.gitlabToken || process.env.GITLAB_TOKEN;

    const since = moment(argv.since);
    const until = argv.until === "today" ? moment() : moment(argv.until);

    const gitlabClient = createGitlabClient(argv.projectId, gitlabUrl, gitlabToken);

    let changeService: CdChangeService;
    const localRepoPath = localRepoPathFromRemote(argv.repo);
    if(localRepoPath) {
      const repoClient = new GitRepoClient(localRepoPath);
      console.log(`Using locally cloned repo at ${localRepoPath} to determine changes`);
      changeService = new CdChangeService(repoClient);
    } else {
      console.log(`Using Gitlab API to determine changes`);
      changeService = new CdChangeService(gitlabClient);
    }
    
    const writer = new CdThroughputCalculator(changeService, gitlabClient);
    await writer.printChangesAndDeployments(argv.releaseBranch, argv.releaseTags, argv.deploymentJobs, since, until);
    
  })
  .command("stability", "calculate failure rate", (yargs) => {
    withProjectIdOption(yargs);
    withBranchesOption(yargs);
    withGitlabOptions(yargs);
    withDateRangeOptions(yargs);
  }, async (argv: any) => {

    const gitlabUrl = argv.gitlabUrl || process.env.GITLAB_URL;
    const gitlabToken = argv.gitlabToken || process.env.GITLAB_TOKEN;

    const since = moment(argv.since);
    const until = argv.until === "today" ? moment() : moment(argv.until);

    const gitlabClient = createGitlabClient(argv.projectId, gitlabUrl, gitlabToken);
    const stabilityCalculator = new CdStabilityCalculator(gitlabClient);
    await stabilityCalculator.printFailureRates(argv.branches, since, until);
    
  })
  .argv