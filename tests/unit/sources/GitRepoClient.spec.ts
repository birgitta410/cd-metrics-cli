import nodegit from "nodegit";
import moment = require('moment');
import { GitRepoClient } from '@/sources/GitRepoClient';

/**
 * Integration test with test git repo, added as git submodule
 */
describe("GitRepoClient", () => {

  const testRepoPath = `${process.cwd()}/tests/test-repo`;

  const masterPointingAtSha = "2acc03db";

  const checkoutRefInTestRepo = async (refName: string) => {
    return nodegit.Repository.open(testRepoPath).then(function(repo:nodegit.Repository) {
      return repo.checkoutBranch(refName);
    });
  }

  const loadMasterCommitsFromTestRepo = async () => {
    return new GitRepoClient(testRepoPath).loadCommitsForBranch({
      since: moment(),
      until: moment(),
      branch: "master",
      prodDeploymentJobNames: ["does-not-matter"]
    }, {
      name: "master", commit: masterPointingAtSha
    });
  }

  describe("loadCommitsForBranch", () => {

    test("should get all commits for the specified branch", async () => {

      // checking out a branch other than master to make sure the function
      // really gets the master commits and not the branch commits
      await checkoutRefInTestRepo("some-branch");

      const actualCommits = await loadMasterCommitsFromTestRepo();

      expect(actualCommits.length).toBe(3);

      const expectedHeadSha = masterPointingAtSha;
      const expectedCommitSha2 = "90199a5b";
      const expectedHeadCommit = actualCommits.find(commit => { return commit.revision === expectedHeadSha; });
      const expectedCommit2 = actualCommits.find(commit => { return commit.revision === expectedCommitSha2; });

      expect(expectedHeadCommit).toBeDefined();
      expect(expectedHeadCommit!.ref).toBe("master");
      expect(expectedHeadCommit!.isMergeCommit).toBe(false);

      expect(expectedCommit2).toBeDefined();
      expect(expectedCommit2!.ref).toBe("");
      expect(moment(expectedCommit2!.dateTime).valueOf()).toBe(moment("2020-02-10T14:38:25.000Z").valueOf());
      expect(expectedCommit2!.isMergeCommit).toBe(false);
      
    });

    test("should get the original author date and time (not the commit date and time)", async () => {
      const cherryPickedCommitShaOnMaster = "2acc03db";
      const cherryPickOriginalAuthorTime = "Fri Feb 28 10:45:09 2020 +0100";

      const actualCommits = await loadMasterCommitsFromTestRepo();
      const cherryPickedCommit = actualCommits.find(commit => {
        return commit.revision === cherryPickedCommitShaOnMaster;
      });

      expect(cherryPickedCommit).toBeDefined();
      expect(moment(cherryPickedCommit!.dateTime).valueOf())
        .toBe(moment(cherryPickOriginalAuthorTime).valueOf());

    });

  });

  describe("loadBranches", () => {
    test("should get all branches", async () => {

      const actualBranches = await new GitRepoClient(testRepoPath).loadBranches("*");

      expect(actualBranches.length).toBe(4);
      expect(actualBranches[0].name).toBe("master");
      expect(actualBranches[0].commit).toContain(masterPointingAtSha);
      expect(actualBranches[1].name).toBe("some-branch");
      expect(actualBranches[1].commit).toBe("e65e3001bc8d02dee795600caa83cecff062a93f");
      
    });

    test("should get all branches matching the specified naming pattern", async () => {

      const actualBranches = await new GitRepoClient(testRepoPath).loadBranches("some*");

      expect(actualBranches.length).toBe(3);
      
    });

    test("should get master branch for pattern 'master'", async () => {

      const actualBranches = await new GitRepoClient(testRepoPath).loadBranches("master");

      expect(actualBranches.length).toBe(1);
      
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
