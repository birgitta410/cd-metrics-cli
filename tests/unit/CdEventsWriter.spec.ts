import moment = require('moment');
import { CdChangeReader, CdDeploymentReader, CdEventsQuery, CdDeploymentEvent, CdChangeEvent } from '../../src/Interfaces';
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

  function someDeploymentEvent() : CdDeploymentEvent {
    return {
      eventType: "deployment",
      revision: "someSha",
      dateTime: "some:time",
      result: "some result",
      jobName: "some job",
    };
  }

  function someChangeEvent() : CdChangeEvent {
    return {
      eventType: "change",
      revision: "someSha",
      dateTime: "some:time",
      isMergeCommit: false
    };
  }

  describe("getChangesAndDeploymentsTimeline", () => {
    test("should return a timeline of changes and deployments", async () => {
      const deploymentEvent: any = someDeploymentEvent();
      deploymentEvent.name = "some-deployment-job";
      const changeEvent: any = someChangeEvent();
      deploymentReaderMock.loadProductionDeployments.mockResolvedValue([
        deploymentEvent
      ]);
      changeReaderMock.loadChanges.mockResolvedValue([
        changeEvent
      ]);

      const eventsWriter = new CdEventsWriter(changeReaderMock, deploymentReaderMock);
      const events = await eventsWriter.getChangesAndDeploymentsTimeline({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: [deploymentEvent.name]
      });

      expect(events.length).toBe(2);
      
      const changes = events.filter(e => e.eventType === "change");
      expect(changes.length).toBe(1);
      
      const deployments = events.filter(e => e.eventType === "deployment");
      expect(deployments.length).toBe(1);

    });
  });
});


