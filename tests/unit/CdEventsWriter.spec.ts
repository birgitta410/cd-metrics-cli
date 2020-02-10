import moment = require('moment');
import { CdChangeReader, CdDeploymentReader, CdEventsQuery } from '../../src/Interfaces';
import { CdEventsWriter } from '../../src/CdEventsWriter';

class CdChangeReaderMock implements CdChangeReader {
  loadChanges(query: CdEventsQuery): Promise<any[]> {
    throw new Error("Method should be mocked.");
  }
}

class CdDeploymentReaderMock implements CdDeploymentReader {
  loadProductionDeployments(query: CdEventsQuery): Promise<any[]> {
    throw new Error("Method should be mocked.");
  }
}

describe("CdEventsWriter", () => {
  let changeReaderMock: any = {};
  let deploymentReaderMock: any = {};

  function resetMocks() {

    changeReaderMock = new CdChangeReaderMock();
    changeReaderMock.loadChanges = jest.fn();

    deploymentReaderMock = new CdDeploymentReaderMock();
    deploymentReaderMock.loadProductionDeployments = jest.fn();

  }

  beforeEach(() => {
    resetMocks();
  });

  function someJob() : any {
    return {
      "id": 1487964,
      "status": "success",
      "name": "some_job_name",
      "ref": "master",
      "created_at": "2019-11-08T17:12:24.655Z",
      "finished_at": "2019-11-08T17:15:54.672Z",
      "commit": {
        "id": "35aed3b9ad09a19243dcc2ed4ad3f6014d081580",
        "short_id": "35aed3b9",
        "created_at": "2020-11-08T12:48:17.000+00:00",
        "title": "Some commit message",
        "author_name": "Some Author"
      }
    };
  }

  function somePipeline() : any {
    return {
      "id": 419002,
      "sha": "35aed3b9a",
      "ref": "master",
      "status": "success",
      "created_at": "2020-02-05T12:48:19.024Z"
    };
  }

  function someCommit() : any {
    return {
      "id": "4b4e5264edeeb45d1c4f7b45e879258fdd5d5781",
      "short_id": "4b4e5264",
      "created_at": "2020-01-10T17:01:21.000+01:00",
      "parent_ids": [
          "231fe1c855b8d86b4822842a5ca7981000ac1ccc"
      ],
      "title": "some short commit message",
      "author_name": "Some Author"
    };
  }

  function someBranch() : any {
    return {
      "name": "release/7.41.0",
      "commit": {
          "id": "55cb3e2c2328213003657ba46f65cb0538c50e71",
          "short_id": "55cb3e2c",
          "created_at": "2019-12-09T15:10:00.000+00:00",
          "title": "Some commit message",
          "author_name": "Some Author",
      }
    };
  }

  describe("getChangesAndDeploymentsTimeline", () => {
    test("should return a timeline of changes and deployments", async () => {
      const deploymentJob: any = someJob();
      deploymentJob.name = "some-deployment-job";
      const commit: any = someCommit();
      deploymentReaderMock.loadProductionDeployments.mockResolvedValue([
        deploymentJob
      ]);
      changeReaderMock.loadChanges.mockResolvedValue([
        commit
      ]);

      const eventsWriter = new CdEventsWriter(changeReaderMock, deploymentReaderMock);
      const events = await eventsWriter.getChangesAndDeploymentsTimeline({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: [deploymentJob.name]
      });

      expect(events.length).toBe(2);
      
      const changes = events.filter(e => e.eventType === "change");
      expect(changes.length).toBe(1);
      expect(changes[0].revision).toBe(commit.short_id);
      expect(moment(changes[0].dateTime).valueOf()).toBe(moment(commit.created_at).valueOf());
      expect(changes[0].isMergeCommit).toBe(false);
      
      const deployments = events.filter(e => e.eventType === "deployment");
      expect(deployments.length).toBe(1);
      expect(deployments[0].revision).toBe(deploymentJob.commit.short_id);
      expect(CdEventsWriter.normalizeTime(deployments[0].dateTime)).toBe(CdEventsWriter.normalizeTime(deploymentJob.finished_at));
      expect(deployments[0].result).toBe(deploymentJob.status);
      expect(deployments[0].jobName).toBe(deploymentJob.name);
      

    });

    test("should not crash if no deployment jobs can be found", async () => {
      deploymentReaderMock.loadProductionDeployments.mockResolvedValue([ ]);
      changeReaderMock.loadChanges.mockResolvedValue([
        someCommit()
      ]);

      const eventsWriter = new CdEventsWriter(changeReaderMock, deploymentReaderMock);
      const events = await eventsWriter.getChangesAndDeploymentsTimeline({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["deployment-job"]
      });

      expect(events.length).toBe(1);

    });
  });
});


