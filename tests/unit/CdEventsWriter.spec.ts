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
    describe("for releasing from a branch", () => {
      test("should return a chronological timeline of changes and deployments", async () => {
        const deploymentEvent: any = someDeploymentEvent();
        deploymentEvent.name = "some-deployment-job";
        deploymentEvent.dateTime = "2020-01-31T12:35:00.000+01:00";

        const changeEvent: any = someChangeEvent();
        changeEvent.dateTime = "2020-01-31T12:45:00.000+01:00";
        
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

        expect(events[0].eventType).toBe("deployment");
        expect(events[1].eventType).toBe("change");

      });
    });

    describe("for releasing from tags", () => {
      test("should put tag deployments right after the respective change", async () => {
        
        const changeEvent1: any = someChangeEvent();
        changeEvent1.dateTime = "2020-01-31T12:35:00.000+01:00";
        const changeEvent2: any = someChangeEvent();
        changeEvent2.dateTime = "2020-01-31T13:35:00.000+01:00";
        const changeEvent3Tagged: any = someChangeEvent();
        changeEvent3Tagged.ref = "4.3.0";
        changeEvent3Tagged.dateTime = "2020-01-31T14:35:00.000+01:00";
        const changeEvent4: any = someChangeEvent();
        changeEvent4.dateTime = "2020-01-31T14:40:00.000+01:00";
        
        const deploymentEvent: any = someDeploymentEvent();
        deploymentEvent.name = "some-deployment-job";
        deploymentEvent.dateTime = "2020-01-31T14:45:00.000+01:00";
        deploymentEvent.ref = "4.3.0";

        deploymentReaderMock.loadProductionDeployments.mockResolvedValue([
          deploymentEvent
        ]);
        changeReaderMock.loadChanges.mockResolvedValue([
          changeEvent1, changeEvent2, changeEvent3Tagged, changeEvent4
        ]);

        const eventsWriter = new CdEventsWriter(changeReaderMock, deploymentReaderMock);
        const events = await eventsWriter.getChangesAndDeploymentsTimeline({
          since: moment(),
          until: moment(),
          branch: "master",
          tags: "^4",
          prodDeploymentJobNames: [deploymentEvent.name]
        });

        expect(events.length).toBe(5);
        
        const changes = events.filter(e => e.eventType === "change");
        expect(changes.length).toBe(4);

        expect(events[0].eventType).toBe("change");
        expect(events[1].eventType).toBe("change");
        expect(events[2].eventType).toBe("change");
        expect(events[3].eventType).toBe("deployment");
        expect(events[4].eventType).toBe("change");
        
        const deployments = events.filter(e => e.eventType === "deployment");
        expect(deployments.length).toBe(1);

      });
    });
  });
});


