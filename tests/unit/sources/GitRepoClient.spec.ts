import nodegit from "nodegit";
import moment = require('moment');
import { GitRepoClient } from '@/sources/GitRepoClient';

describe("GitRepoClient", () => {

  const testRepoPath = `${process.cwd()}/tests/test-repo`;

  const checkoutRefInTestRepo = async (refName: string) => {
    return nodegit.Repository.open(testRepoPath).then(function(repo:nodegit.Repository) {
      return repo.checkoutBranch(refName);
    });
  }

  describe("loadCommitsForBranch", () => {

    test("should get all commits for the specified branch", async () => {

      // checking out a branch other than master to make sure it really gets
      // the master commits
      await checkoutRefInTestRepo("some-branch");

      const actualCommits = await new GitRepoClient(testRepoPath).loadCommitsForBranch({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["does-not-matter"]
      }, {
        name: "master", commit: "c28b8373"
      });

      expect(actualCommits.length).toBe(2);

      expect(actualCommits[0].revision).toBe("c28b8373");
      expect(actualCommits[0].ref).toBe("master");
      expect(moment(actualCommits[0].dateTime).valueOf()).toBe(moment("2020-02-10T14:50:48.000Z").valueOf());
      expect(actualCommits[0].isMergeCommit).toBe(false);

      expect(actualCommits[1].revision).toBe("90199a5b");
      expect(actualCommits[1].ref).toBe("");
      expect(moment(actualCommits[1].dateTime).valueOf()).toBe(moment("2020-02-10T14:38:25.000Z").valueOf());
      expect(actualCommits[1].isMergeCommit).toBe(false);
      
    });

  });

  describe("loadBranches", () => {
    test("should get all branches", async () => {

      const actualBranches = await new GitRepoClient(testRepoPath).loadBranches("*");

      expect(actualBranches.length).toBe(3);
      expect(actualBranches[0].name).toBe("refs/heads/master");
      expect(actualBranches[0].commit).toContain("c28b8373");
      expect(actualBranches[1].name).toBe("refs/heads/some-branch");
      expect(actualBranches[1].commit).toBe("e65e3001bc8d02dee795600caa83cecff062a93f");
      
    });

    test("should get all branches matching the specified naming pattern", async () => {

      const actualBranches = await new GitRepoClient(testRepoPath).loadBranches("some*");

      expect(actualBranches.length).toBe(2);
      
    });

  });

  describe("loadTags", () => {
    test("should get all tags", async () => {

      const actualTags = await new GitRepoClient(testRepoPath).loadTags("*");

      expect(actualTags.length).toBe(2);
      expect(actualTags[0].name).toBe("v1.0");
      expect(actualTags[0].commit).toContain("c28b8373");
      expect(actualTags[1].name).toBe("v1.1");
      
    });

    test("should get all tags that match the specified pattern", async () => {

      const actualTags = await new GitRepoClient(testRepoPath).loadTags("v1.0");

      expect(actualTags.length).toBe(1);
      expect(actualTags[0].name).toBe("v1.0");
      expect(actualTags[0].commit).toContain("c28b8373");
      
    });

  });

});
