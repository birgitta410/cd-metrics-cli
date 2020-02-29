import moment = require('moment');
import { CdChangeReader, CdEventsQuery, CdChangeReference, CdChangeEvent } from '@/Interfaces';
import { CdChangeService } from '@/CdChangeService';

class CdChangeReaderMock implements CdChangeReader {
  loadTags(tagsPattern: string): Promise<import("../../src/Interfaces").CdChangeReference[]> {
    throw new Error("Method should be mocked.");
  }
  loadBranches(branchPattern: string): Promise<import("../../src/Interfaces").CdChangeReference[]> {
    throw new Error("Method should be mocked.");
  }
  loadCommitsForReferences(query: CdEventsQuery, targetRefs: import("../../src/Interfaces").CdChangeReference[]): Promise<CdChangeEvent[]> {
    throw new Error("Method should be mocked.");
  }
}


describe("CdChangeService", () => {
  let changeReaderMock: any;
  
  function resetMocks() {

    changeReaderMock = new CdChangeReaderMock();
    changeReaderMock.loadTags = jest.fn();
    changeReaderMock.loadBranches = jest.fn();
    changeReaderMock.loadCommitsForReferences = jest.fn();

  }

  beforeEach(() => {
    resetMocks();
  });

  function createService() {
    return new CdChangeService(changeReaderMock);
  }

  function someCommit() : CdChangeEvent {
    return {
      eventType: "change",
      revision: "4b4e5264",
      dateTime: "2020-01-10T17:01:21.000+01:00",
      isMergeCommit: false
    };
  }

  function someBranch() : CdChangeReference {
    return {
      "name": "release/7.41.0",
      "commit": "55cb3e2c",
    };
  }

  function someTag() : CdChangeReference {
    return {
      "name": "4.5.0-1",
      "commit": "6f9828be"
    };
  }

  describe("loadChanges", () => {
    test("should get all commits for the specified branch", async () => {
      const commit = someCommit();
      changeReaderMock.loadCommitsForReferences.mockResolvedValue([
        commit
      ]);

      const masterBranch: CdChangeReference = { name: "master", commit: commit.revision };
      changeReaderMock.loadBranches.mockResolvedValue([
        masterBranch
      ]);

      const query = {
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["does-not-matter"]
      };
      const actualCommits = await createService().loadChanges(query);

      expect(actualCommits.length).toBe(1);

      expect(actualCommits[0].revision).toBe(commit.revision);
      expect(moment(actualCommits[0].dateTime).valueOf()).toBe(moment(commit.dateTime).valueOf());
      expect(actualCommits[0].isMergeCommit).toBe(false);
      expect(changeReaderMock.loadCommitsForReferences).toHaveBeenCalledWith(query, [masterBranch]);

    });

    test.skip("should get unique commits for multiple branches if branch name is pattern", async () => {
      const masterCommit1 = someCommit();
      masterCommit1.revision = "654321";
      const masterCommit2 = someCommit();
      masterCommit2.revision = "123456";

      const branchCommit1 = someCommit();
      branchCommit1.revision = "abcdef12";
      const branchCommit2 = someCommit();
      branchCommit2.revision = "65fedcba";
      
      changeReaderMock.loadCommitsForReferences.mockResolvedValue([
        masterCommit1, masterCommit2, branchCommit1, branchCommit2]);

      const branch = someBranch();
      branch.name = "release/1.2";
      changeReaderMock.loadBranches.mockResolvedValue([
        branch
      ]);

      const actualCommits = await createService().loadChanges({
        since: moment(),
        until: moment(),
        branch: "^release",
        prodDeploymentJobNames: ["does-not-matter"]
      });

      expect(actualCommits.length).toBe(4);

      // How to find out which commits are UNIQUELY on the release branch? Created after it was split off?!
      // The branch result from the Gitlab API contains a commit - probably the latest commit of the branch, yeah
      // Then need to find all the ones between that one and ... no...
      // Maybe I can just "tag" all the commits that a job also pointed at?

      // OR:
      // 1) Assume that release branches are always created from the same branch (e.g. master)
      // 2) Find the latest commit that those two branches have in common
      // 3) Go from there

      expect(actualCommits[0].ref).toBe("master");
      expect(actualCommits[1].ref).toBe("release/1.2");
      expect(actualCommits[2].ref).toBe("release/1.2");

    });

    test("should add tag to change event if tags pattern is set", async () => {
      const commit1 = someCommit();
      commit1.revision = "654321";
      const commit2 = someCommit();
      commit2.revision = "123456";
      
      changeReaderMock.loadCommitsForReferences
        .mockImplementationOnce(() => Promise.resolve([commit1, commit2]))
        .mockImplementationOnce(() => Promise.resolve([commit2]));

      const tag1 = someTag();
      tag1.name = "1.2";
      tag1.commit = commit1.revision;
      const tag2 = someTag();
      tag2.name = "1.3";
      tag2.commit = commit2.revision;
      changeReaderMock.loadTags.mockResolvedValue([
        tag1, tag2
      ]);

      const actualCommits = await createService().loadChanges({
        since: moment(),
        until: moment(),
        branch: "master",
        tags: "*",
        prodDeploymentJobNames: ["does-not-matter"]
      });

      expect(actualCommits.length).toBe(2);

      expect(actualCommits[0].ref).toBe("1.2");
      expect(actualCommits[1].ref).toBe("1.3");

      expect(changeReaderMock.loadTags).toHaveBeenCalledWith("*")
      expect(changeReaderMock.loadBranches).not.toHaveBeenCalled();

    });
  });
});


