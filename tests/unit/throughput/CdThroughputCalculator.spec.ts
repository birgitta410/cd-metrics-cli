import moment = require('moment');
import { CdDeploymentReader, CdEventsQuery, CdDeploymentEvent, CdChangeEvent } from '../../../src/throughput/Model';
import { CdThroughputCalculator, CdThroughputEventSeries } from '../../../src/throughput/CdThroughputCalculator';

class CdChangeServiceMock {
  loadChanges(query: CdEventsQuery): Promise<any[]> {
    throw new Error("Method should be mocked.");
  }
}

class CdDeploymentReaderMock implements CdDeploymentReader {
  loadProductionDeployments(query: CdEventsQuery): Promise<any[]> {
    throw new Error("Method should be mocked.");
  }
}

describe("CdThroughputCalculator", () => {
  let changeServiceMock: any = {};
  let deploymentReaderMock: any = {};

  function resetMocks() {

    changeServiceMock = new CdChangeServiceMock();
    changeServiceMock.loadChanges = jest.fn();

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
      authorDateTime: "some:time",
      isMergeCommit: false
    };
  }

  describe("CdThroughputEventSeries", () => {
    describe("addThroughputMetrics", () => {
      test("should add metrics to the events", () => {
        
        const changeEvents = [
          <CdChangeEvent>{eventType: "change", revision: "abcd1", dateTime: "2020-01-31T12:35:00.000+01:00", authorDateTime: "2020-01-31T12:35:00.000+01:00"},
          <CdChangeEvent>{eventType: "change", revision: "abcd2", dateTime: "2020-01-31T12:36:00.000+01:00", authorDateTime: "2020-01-31T12:34:00.000+01:00"},
          <CdChangeEvent>{eventType: "change", revision: "abcd3", dateTime: "2020-01-31T12:37:00.000+01:00", authorDateTime: ""},
          <CdChangeEvent>{eventType: "change", revision: "abcd4", dateTime: "2020-01-31T12:41:00.000+01:00", authorDateTime: ""},
          <CdChangeEvent>{eventType: "change", revision: "abcd5", dateTime: "2020-01-31T12:42:00.000+01:00", authorDateTime: ""},
        ];
        const deploymentEvents = [
          <CdDeploymentEvent>{eventType: "deployment", revision: "abcd3", dateTime: "2020-01-31T12:40:00.000+01:00", result: "success"},
          <CdDeploymentEvent>{eventType: "deployment", revision: "abcd5", dateTime: "2020-01-31T12:43:00.000+01:00", result: "failure"}
        ];
        
        const series = new CdThroughputEventSeries(changeEvents, deploymentEvents);
        series.addThroughputMetrics();

        expect((series.changes[0]).metrics!.deployment.revision).toBe("abcd3");
        expect((series.changes[0]).metrics!.cycleTime!.asMinutes()).toBe(5);
        expect((series.changes[1]).metrics!.deployment.revision).toBe("abcd3");
        expect((series.changes[1]).metrics!.cycleTime!.asMinutes()).toBe(6);
        expect((series.changes[2]).metrics!.deployment.revision).toBe("abcd3");
        expect((series.deployments[0]).metrics!.changeSetSize).toBe(3);

        expect((series.changes[3]).metrics).toBeUndefined();
        expect((series.changes[4]).metrics).toBeUndefined();
        expect((series.deployments[1]).metrics).toBeUndefined();
      });

      test("should add rolling average of cycle times", () => {
        
        const changeEvents = [
          <CdChangeEvent>{dateTime: "2020-01-02T12:35:00.000+01:00", metrics: {cycleTime: moment.duration(1, "days")}},
          <CdChangeEvent>{dateTime: "2020-01-03T12:36:00.000+01:00", metrics: {cycleTime: moment.duration(2, "days")}},
          <CdChangeEvent>{dateTime: "2020-01-04T12:37:00.000+01:00", metrics: {cycleTime: moment.duration(3, "days")}},
          <CdChangeEvent>{dateTime: "2020-01-05T12:41:00.000+01:00", metrics: {cycleTime: moment.duration(4, "days")}},
          <CdChangeEvent>{dateTime: "2020-01-06T12:42:00.000+01:00", metrics: {cycleTime: moment.duration(5, "days")}},
        ];
        
        const timeWindowInDays = 2;
        const series = new CdThroughputEventSeries(changeEvents, []);
        series.addRollingAverages(timeWindowInDays);
        
        expect((series.changes[0]).metrics!.cycleTimeRollingAverage.asHours()).toBe(24);
        expect((series.changes[1]).metrics!.cycleTimeRollingAverage.asHours()).toBe(36);
        expect((series.changes[2]).metrics!.cycleTimeRollingAverage.asHours()).toBe(60);
        expect((series.changes[3]).metrics!.cycleTimeRollingAverage.asHours()).toBe(84);
        expect((series.changes[4]).metrics!.cycleTimeRollingAverage.asHours()).toBe(108);
        
      });

    });
  });

  describe("getChangesAndDeploymentsTimeline", () => {
    describe("for releasing from a specific branch", () => {
      test("should return a chronological timeline of changes and deployments", async () => {
        const deploymentEvent: any = someDeploymentEvent();
        deploymentEvent.name = "some-deployment-job";
        deploymentEvent.dateTime = "2020-01-31T12:35:00.000+01:00";

        const changeEvent: any = someChangeEvent();
        changeEvent.dateTime = "2020-01-31T12:45:00.000+01:00";
        
        deploymentReaderMock.loadProductionDeployments.mockResolvedValue([
          deploymentEvent
        ]);
        changeServiceMock.loadChanges.mockResolvedValue([
          changeEvent
        ]);

        const throughputCalculator = new CdThroughputCalculator(changeServiceMock, deploymentReaderMock);
        const events = await throughputCalculator.getChangesAndDeploymentsTimeline({
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
        changeServiceMock.loadChanges.mockResolvedValue([
          changeEvent1, changeEvent2, changeEvent3Tagged, changeEvent4
        ]);

        const throughputCalculator = new CdThroughputCalculator(changeServiceMock, deploymentReaderMock);
        const events = await throughputCalculator.getChangesAndDeploymentsTimeline({
          since: moment(),
          until: moment(),
          branch: "master",
          tags: "^4",
          prodDeploymentJobNames: [deploymentEvent.name]
        });

        expect(events.length).toBe(5);
        
        const changes = events.filter(e => e.eventType === "change");
        expect(changes.length).toBe(4);

        expect(events[0]).toBe(changeEvent1);
        expect(events[1]).toBe(changeEvent2);
        expect(events[2]).toBe(changeEvent3Tagged);
        expect(events[3]).toBe(deploymentEvent);
        expect(events[4]).toBe(changeEvent4);
        
        const deployments = events.filter(e => e.eventType === "deployment");
        expect(deployments.length).toBe(1);

      });
    });

    describe("for releasing from release branches", () => {
      test("should put release branch deployments in a grouping with branch changes", async () => {
        
        const changeEvent1: any = someChangeEvent();
        changeEvent1.dateTime = "2020-01-31T12:35:00.000+01:00";
        const changeEvent2: any = someChangeEvent();
        changeEvent2.dateTime = "2020-01-31T13:35:00.000+01:00";
        
        const changeEvent3OnBranch: any = someChangeEvent();
        changeEvent3OnBranch.ref = "release/4.3.0";
        changeEvent3OnBranch.dateTime = "2020-01-31T14:35:00.000+01:00";
        const deploymentEvent: any = someDeploymentEvent();
        deploymentEvent.name = "some-deployment-job";
        deploymentEvent.dateTime = "2020-01-31T14:45:00.000+01:00";
        deploymentEvent.ref = "release/4.3.0";
        const changeEvent4OnBranch: any = someChangeEvent();
        changeEvent4OnBranch.dateTime = "2020-01-31T14:50:00.000+01:00";
        changeEvent4OnBranch.ref = "release/4.3.0";
        const deploymentEvent2: any = someDeploymentEvent();
        deploymentEvent2.name = "some-deployment-job";
        deploymentEvent2.dateTime = "2020-01-31T14:55:00.000+01:00";
        deploymentEvent2.ref = "release/4.3.0";
        
        const changeEvent5: any = someChangeEvent();
        changeEvent5.dateTime = "2020-02-01T14:40:00.000+01:00";
        
        deploymentReaderMock.loadProductionDeployments.mockResolvedValue([
          deploymentEvent, deploymentEvent2
        ]);
        changeServiceMock.loadChanges.mockResolvedValue([
          changeEvent1, changeEvent2, changeEvent3OnBranch, changeEvent4OnBranch, changeEvent5
        ]);

        const throughputCalculator = new CdThroughputCalculator(changeServiceMock, deploymentReaderMock);
        const events = await throughputCalculator.getChangesAndDeploymentsTimeline({
          since: moment(),
          until: moment(),
          branch: "master",
          tags: "^4",
          prodDeploymentJobNames: [deploymentEvent.name]
        });

        expect(events.length).toBe(7);
        
        expect(events[0]).toBe(changeEvent1);
        expect(events[1]).toBe(changeEvent2);
        expect(events[2]).toBe(changeEvent3OnBranch);
        expect(events[3]).toBe(deploymentEvent);
        expect(events[4]).toBe(changeEvent4OnBranch);
        expect(events[5]).toBe(deploymentEvent2);
        expect(events[6]).toBe(changeEvent5);

      });

      test("should put release branch deployments in a grouping with branch changes", async () => {
        const changeEvent1 = { eventType: "change", revision: "31f43b63", dateTime:"01-02-2020 22:37:08", authorDateTime:"2020-02-01 22:37:08"};
        const deploymentEvent1_r257 = { eventType: "deployment", revision: "52c360a2", dateTime: "01-02-2020 22:46:19", result: "success", ref: "release/2.57.0" };
        const changeEvent2_r257 = { eventType: "change", revision: "8eee2484", dateTime:"04-02-2020 16:26:24", ref: "release/2.57.0", authorDateTime:"2020-01-30 10:06:33"};
        const deploymentEvent2_r257 = { eventType: "deployment", revision: "8eee2484", dateTime: "04-02-2020 16:30:58", result: "success", ref: "release/2.57.0" };
        const deploymentEvent3_r257 = { eventType: "deployment", revision: "8eee2484", dateTime: "05-02-2020 17:42:35", result: "success", ref: "release/2.57.0" };
        const changeEvent3 = { eventType: "change", revision: "bba719c3", dateTime:"06-02-2020 15:10:46", authorDateTime:"2020-02-06 15:10:46", ref: ""};
        const changeEvent4 = { eventType: "change", revision: "825230dd", dateTime:"10-02-2020 11:06:09", authorDateTime:"2020-02-10 11:06:09"};
        const changeEvent5 = { eventType: "change", revision: "baa6d29b", dateTime:"10-02-2020 15:24:00", authorDateTime:"2020-02-10 15:24:00"};
        const changeEvent6 = { eventType: "change", revision: "344c0290", dateTime:"10-02-2020 15:35:34", authorDateTime:"2020-02-10 15:35:34"};
        const changeEvent7 = { eventType: "change", revision: "dafe734f", dateTime:"10-02-2020 16:07:27", authorDateTime:"2020-02-10 16:07:27"};
        const changeEvent8 = { eventType: "change", revision: "6c61eb1b", dateTime:"11-02-2020 14:49:40", authorDateTime:"TRUE			2020-02-11 14:49:40"};
        const deploymentEvent4_r258 = { eventType: "deployment", revision: "31f43b63", dateTime: "05-02-2020 17:35:40", result: "success", ref: "release/2.58.0" };
        const deploymentEvent5_r258 = { eventType: "deployment", revision: "31f43b63", dateTime: "06-02-2020 16:44:23", result: "success", ref: "release/2.58.0" };
        const changeEvent9_r258 = { eventType: "change", revision: "a683ed6d", dateTime:"11-02-2020 15:12:49", ref: "release/2.58.0", authorDateTime:"2020-02-10 11:06:09"};
        const deploymentEvent6_r258 = { eventType: "deployment", revision: "a683ed6d", dateTime: "11-02-2020 15:18:11", result: "success", ref: "release/2.58.0" };
        const deploymentEvent7_r258 = { eventType: "deployment", revision: "a683ed6d", dateTime: "13-02-2020 11:21:57", result: "success", ref: "release/2.58.0" };
        const changeEvent10_r258 = { eventType: "change", revision: "fb23dad0", dateTime:"14-02-2020 10:40:14", ref: "release/2.58.0", authorDateTime:"2020-02-14 10:38:47"};
        const deploymentEvent8_r258 = { eventType: "deployment", revision: "fb23dad0", dateTime: "14-02-2020 10:54:18", result: "success", ref: "release/2.58.0" };
        const changeEvent11_r258 = { eventType: "change", revision: "2d68dd57", dateTime:"14-02-2020 11:12:04", ref: "release/2.58.0", authorDateTime:"2020-02-14 11:10:51"};
        const deploymentEvent9_r258 = { eventType: "deployment", revision: "2d68dd57", dateTime: "14-02-2020 11:18:06", result: "success", ref: "release/2.58.0" };
        
        deploymentReaderMock.loadProductionDeployments.mockResolvedValue([
          deploymentEvent1_r257, deploymentEvent2_r257, deploymentEvent3_r257, deploymentEvent4_r258, deploymentEvent5_r258, deploymentEvent6_r258, deploymentEvent7_r258, 
          deploymentEvent8_r258, deploymentEvent9_r258
        ]);
        changeServiceMock.loadChanges.mockResolvedValue([
          changeEvent1, changeEvent2_r257, changeEvent3, changeEvent4, changeEvent5, changeEvent6, changeEvent7, changeEvent8, changeEvent9_r258,
          changeEvent10_r258, changeEvent11_r258
        ]);

        const throughputCalculator = new CdThroughputCalculator(changeServiceMock, deploymentReaderMock);
        const events = await throughputCalculator.getChangesAndDeploymentsTimeline({
          since: moment(),
          until: moment(),
          branch: "release",
          prodDeploymentJobNames: ["build-container"]
        });

        expect(events.length).toBe(20);
        
        expect(events[0]).toBe(changeEvent1);
        
        // release 2.5.7
        expect(events[1]).toBe(deploymentEvent1_r257);
        expect(events[2]).toBe(changeEvent2_r257);
        expect(events[3]).toBe(deploymentEvent2_r257);
        expect(events[4]).toBe(deploymentEvent3_r257);
        
        // release 2.5.8
        expect(events[5]).toBe(deploymentEvent4_r258);
        expect(events[6]).toBe(deploymentEvent5_r258);
        expect(events[7]).toBe(changeEvent9_r258);
        expect(events[8]).toBe(deploymentEvent6_r258);
        expect(events[9]).toBe(deploymentEvent7_r258);
        expect(events[10]).toBe(changeEvent10_r258);
        expect(events[11]).toBe(deploymentEvent8_r258);
        expect(events[12]).toBe(changeEvent11_r258);
        expect(events[13]).toBe(deploymentEvent9_r258);
        
        // change 3-8 (on master)
        expect(events[14]).toBe(changeEvent3);
        expect(events[15]).toBe(changeEvent4);
        expect(events[16]).toBe(changeEvent5);
        expect(events[17]).toBe(changeEvent6);
        expect(events[18]).toBe(changeEvent7);
        expect(events[19]).toBe(changeEvent8);

      });
    });
  });
});


