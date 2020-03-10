import moment = require('moment');
import { CdChangeReader, CdEventsQuery, CdChangeReference, CdChangeEvent } from '@/throughput/Model';
import { CdChangeService } from '@/throughput/CdChangeService';

class CdChangeReaderMock implements CdChangeReader {
  loadTags(tagsPattern: string): Promise<CdChangeReference[]> {
    throw new Error("Method should be mocked.");
  }
  loadBranches(branchPattern: string): Promise<CdChangeReference[]> {
    throw new Error("Method should be mocked.");
  }
  loadCommitsForBranch(query: CdEventsQuery, branch: CdChangeReference): Promise<CdChangeEvent[]> {
    throw new Error("Method should be mocked.");
  }
}


describe("CdChangeService", () => {
  let changeReaderMock: any;
  
  function resetMocks() {

    changeReaderMock = new CdChangeReaderMock();
    changeReaderMock.loadTags = jest.fn();
    changeReaderMock.loadBranches = jest.fn();
    changeReaderMock.loadCommitsForBranch = jest.fn();

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

  function masterBranch() : CdChangeReference {
    return {
      "name": "master",
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
      changeReaderMock.loadCommitsForBranch.mockResolvedValue([
        commit
      ]);

      const theMasterBranch: CdChangeReference = masterBranch();
      changeReaderMock.loadBranches.mockResolvedValue([
        theMasterBranch
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
      expect(changeReaderMock.loadCommitsForBranch).toHaveBeenCalledWith(query, theMasterBranch);

    });

    test("should not return any changes if multiple branches are returned", async () => {
      // Explicitly not supporting release branches right now
      // - commits change their SHAs as they get merged across branches, so there's not way to properly determine what
      //   change gets deployed when
      const commit = someCommit();
      changeReaderMock.loadCommitsForBranch.mockResolvedValue([
        commit
      ]);

      const aBranch: CdChangeReference = someBranch();
      const anotherBranch: CdChangeReference = someBranch();
      changeReaderMock.loadBranches.mockResolvedValue([
        aBranch, anotherBranch
      ]);

      const query = {
        since: moment(),
        until: moment(),
        branch: "release-*",
        prodDeploymentJobNames: ["does-not-matter"]
      };
      const actualCommits = await createService().loadChanges(query);

      expect(actualCommits.length).toBe(0);

    });

    test("should return changes only for master even if there are branches that just contain the string 'master'", async () => {
      // Explicitly not supporting release branches right now
      // - commits change their SHAs as they get merged across branches, so there's not way to properly determine what
      //   change gets deployed when
      const commit = someCommit();
      changeReaderMock.loadCommitsForBranch.mockResolvedValue([
        commit
      ]);

      const theMasterBranch: CdChangeReference = masterBranch();
      const anotherBranch: CdChangeReference = someBranch();
      anotherBranch.name = "some-branch-with-master-in-the-name";
      changeReaderMock.loadBranches.mockResolvedValue([
        theMasterBranch, anotherBranch
      ]);

      const query = {
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["does-not-matter"]
      };
      const actualCommits = await createService().loadChanges(query);

      expect(actualCommits.length).toBe(1);

    });

    test("should add tag to change event if tags pattern is set", async () => {
      const theMasterBranch: CdChangeReference = masterBranch();
      changeReaderMock.loadBranches.mockResolvedValue([
        theMasterBranch
      ]);
      
      const commit1 = someCommit();
      commit1.revision = "654321";
      const commit2 = someCommit();
      commit2.revision = "123456";
      
      changeReaderMock.loadCommitsForBranch
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
      expect(changeReaderMock.loadBranches).toHaveBeenCalledWith("master");

    });
  });
});


