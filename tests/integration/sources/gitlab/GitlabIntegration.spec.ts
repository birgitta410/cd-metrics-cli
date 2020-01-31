import { Gitlab } from "gitlab";
import { GitlabClient, GitlabConfig } from "@/services/sources/gitlab/GitlabClient";

describe("GitlabClient.loadData for real", () => {

  test.only("create test data for the 4 key metrics thing", () => {
    const api = new Gitlab({
      host: process.env.GITLAB_URL,
      token: process.env.GITLAB_TOKEN
    });

    const config = new GitlabConfig(
      "some url, TODO, currently never used!!",
      1745,
      "the-project");

    return new GitlabClient(api, config)
      .loadCommits(1745, "master", 20)
      .then((commits: any[]) => {
        const lines = commits.map(c => {
          const isMergeCommit = c.parent_ids.length > 1;
          return `${c.short_id}\t${c.created_at}\t${isMergeCommit}`;
        });
        console.log(`
CHANGES ON MASTER
revision\ttime\tisMergeCommit
${lines.join(`\n`)}`);
      }).then(() => {
        return new GitlabClient(api, config).loadPipelines(1745, "master");
      })
      .then((pipelines: any[]) => {
        const lines = pipelines.map(p => {
          return `${p.sha}\t${p.created_at}\t${p.status}`;
        });
        console.log(`
DEPLOYMENTS FROM MASTER
revision\ttime\tstatus
${lines.join(`\n`)}`);
      });
  }, 60000);
});
