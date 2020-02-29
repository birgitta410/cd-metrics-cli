import moment = require('moment');
import { GitRepoClient } from '@/GitRepoClient';
import { Commit, Signature, Tree, Repository } from 'nodegit';

describe("GitlabClient", () => {

  describe("loadChanges", () => {
    test("should get all commits for the specified branch", async () => {

      const testRepoPath = `${process.cwd()}/tests/test-repo`;
      console.log(`Opening test repo at ${testRepoPath}`);

      const actualCommits = await new GitRepoClient(testRepoPath).loadChanges({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["does-not-matter"]
      });

      expect(actualCommits.length).toBe(2);

      expect(actualCommits[0].short_id).toBe("c28b8373");
      expect(actualCommits[0].title).toContain("commit 2");
      expect(moment(actualCommits[0].created_at).valueOf()).toBe(moment("2020-02-10T14:50:48.000Z").valueOf());
      expect(actualCommits[0].is_merge).toBe(false);

      expect(actualCommits[1].short_id).toBe("90199a5b");
      expect(actualCommits[1].title).toContain("First commit");
      expect(moment(actualCommits[1].created_at).valueOf()).toBe(moment("2020-02-10T14:38:25.000Z").valueOf());
      expect(actualCommits[1].is_merge).toBe(false);
      
    });

  });

});


