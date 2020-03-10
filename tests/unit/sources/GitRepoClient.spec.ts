import nodegit from "nodegit";
import moment = require('moment');
import { GitRepoClient } from '@/sources/GitRepoClient';

/**
 * Integration test with test git repo, added as git submodule
 */
describe("GitRepoClient", () => {

  const testRepoPath = `${process.cwd()}/tests/test-repo`;
  let repo: GitRepoClient;

  // Some fixed expectations about the test repository (to be updated when the test repo changes)
  const MASTER_POINTING_AT_SHA = "2acc03db";
  const MASTER_COMMITS_SINCE = moment("2020-02-01");
  const MASTER_COMMITS_UNTIL = moment("2020-04-01")
  const NUM_COMMITS_ON_MASTER = 3;

  const checkoutRefInTestRepo = async (refName: string) => {
    return nodegit.Repository.open(testRepoPath).then(function(repo:nodegit.Repository) {
      return repo.checkoutBranch(refName);
    });
  }

  const loadMasterCommitsFromTestRepo = async (since: moment.Moment, until: moment.Moment) => {
    const branches = await repo.loadBranches("master");
    console.log(`Master branch: ${JSON.stringify(branches[0])}`)  
    return repo.loadCommitsForBranch({
      since: since,
      until: until,
      branch: "master",
      prodDeploymentJobNames: ["does-not-matter"]
    }, branches[0]);
  }

  describe("loadCommitsForBranch", () => {

    beforeEach( async () => {
      repo = await new GitRepoClient(testRepoPath);
    });

    test("should get all commits for the specified branch", async () => {

      // checking out a branch other than master to make sure the function
      // really gets the master commits and not the branch commits
      await checkoutRefInTestRepo("some-branch");

      const actualCommits = await loadMasterCommitsFromTestRepo(MASTER_COMMITS_SINCE, MASTER_COMMITS_UNTIL);

      expect(actualCommits.length).toBe(NUM_COMMITS_ON_MASTER);

      const expectedHeadSha = MASTER_POINTING_AT_SHA;
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

    test("should get commits from branch that is not master", async () => {

      const branches = await repo.loadBranches("some-branch");
      
      const actualCommits = await repo.loadCommitsForBranch({
        since: MASTER_COMMITS_SINCE,
        until: MASTER_COMMITS_UNTIL,
        branch: "some-branch",
        prodDeploymentJobNames: ["does-not-matter"]
      }, branches[0]);

      expect(actualCommits.length).toBe(3);

      const expectedHeadSha = "e65e3001";
      const expectedHeadCommit = actualCommits.find(commit => { return commit.revision === expectedHeadSha; });

      expect(expectedHeadCommit).toBeDefined();
      
    });

    test("should get only commits in the specified timeline", async () => {

      const actualCommits = await loadMasterCommitsFromTestRepo(moment("2020-02-27"), moment("2020-02-29"));

      expect(actualCommits.length).toBe(1);

      const expectedCommitSha1 = "2acc03db";
      const expectedCommit1 = actualCommits.find(commit => { return commit.revision === expectedCommitSha1; });
      
      expect(expectedCommit1).toBeDefined();
      
    });

    test("should get the original author date and time (not the commit date and time)", async () => {
      const cherryPickedCommitShaOnMaster = "2acc03db";
      const cherryPickOriginalAuthorTime = "Fri Feb 28 10:45:09 2020 +0100";

      const actualCommits = await loadMasterCommitsFromTestRepo(MASTER_COMMITS_SINCE, MASTER_COMMITS_UNTIL);
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

      const actualBranches = await repo.loadBranches("*");

      expect(actualBranches.length).toBe(4);
      expect(actualBranches[0].name).toBe("master");
      expect(actualBranches[0].commit).toContain(MASTER_POINTING_AT_SHA);
      expect(actualBranches[1].name).toBe("some-branch");
      expect(actualBranches[1].commit).toBe("e65e3001bc8d02dee795600caa83cecff062a93f");
      
    });

    test("should get all branches matching the specified naming pattern", async () => {

      const actualBranches = await repo.loadBranches("some*");

      expect(actualBranches.length).toBe(3);
      
    });

    test("should get master branch for pattern 'master'", async () => {

      const actualBranches = await repo.loadBranches("master");

      expect(actualBranches.length).toBe(1);
      
    });

  });

  describe("loadTags", () => {
    test("should get all tags", async () => {

      const actualTags = await repo.loadTags("*");

      expect(actualTags.length).toBe(2);
      expect(actualTags[0].name).toBe("v1.0");
      expect(actualTags[0].commit).toContain("c28b8373");
      expect(actualTags[1].name).toBe("v1.1");
      
    });

    test("should get all tags that match the specified pattern", async () => {

      const actualTags = await repo.loadTags("v1.0");

      expect(actualTags.length).toBe(1);
      expect(actualTags[0].name).toBe("v1.0");
      expect(actualTags[0].commit).toContain("c28b8373");
      
    });

  });

});
