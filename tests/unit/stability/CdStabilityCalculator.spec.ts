import moment = require('moment');
import { CdPipelineRun, CdJobRun } from '@/stability/Model';
import { CdStabilityData } from '@/stability/CdStabilityCalculator';
import * as _ from "lodash";

describe("CdStabilityData", () => {

  function somePipelineRun() : CdPipelineRun {
    return {
      id: "12345",
      pipelineName: "build:test:deploy",
      jobs: [],
      dateTime: "some:time",
      result: "some result",
    };
  }

  function someJobRun() : CdJobRun {
    return {
      id: "56789",
      jobName: "build_docker",
      result: "some result",
      stageName: "some stage",
      dateTime: "some:time",
    };
  }

  function pipelineRuns(numFailures: number, numSuccesses: number) {
    const result: CdPipelineRun[] = [];
    _.times(numFailures, () => {
      const pipelineRun = somePipelineRun();
      pipelineRun.result = "failed";
      result.push(pipelineRun);
    });
    _.times(numSuccesses, () => {
      const pipelineRun = somePipelineRun();
      pipelineRun.result = "success";
      result.push(pipelineRun);
    });
    return result;
  }

  function jobsWithResult(jobName:string, stageName:string, result: string, numberOf: number) {
    return _.times(numberOf, () => {
      const jobRun = someJobRun();
      jobRun.jobName = jobName;
      jobRun.stageName = stageName;
      jobRun.result = result;
      return jobRun;
    });
  }

  function jobs(jobName: string, stageName: string, numFailures: number, numSuccesses: number) {
    return _.concat(
      jobsWithResult(jobName, stageName, "failed", numFailures),
      jobsWithResult(jobName, stageName, "success", numSuccesses),
    );
  }

  describe("failure rates: ", () => {
    test("should calculate overall failure rate of all pipeline runs", async () => {
    
      const data = new CdStabilityData(pipelineRuns(10, 10));
      expect(data.pipelineFailureRate.failureRate).toBe(50);
      expect(data.pipelineFailureRate.numberOfFailed).toBe(10);
      expect(data.pipelineFailureRate.numberOfSuccess).toBe(10);
      
    });
  
    test("should calculate failure rates for each job (grouped by name), sorted from highest rate to lowest", () => {
      const someStageName = "someStage";
      const somePipelines = pipelineRuns(1, 1);
      somePipelines[0].jobs = _.concat(
        jobs("build", someStageName, 1, 9),
        jobs("test", someStageName, 5, 5),
        jobs("deploy", someStageName, 0, 10),
        jobs("smoke-test", someStageName, 10, 0)
      );
  
      const data = new CdStabilityData(somePipelines);
      const failureRatesSorted = _.orderBy(data.jobFailureRates, "failureRate", "desc")
      expect(failureRatesSorted[0].name).toBe(`${someStageName}::smoke-test`);
      expect(failureRatesSorted[0].failureRate).toBe(100);
      expect(failureRatesSorted[1].name).toBe(`${someStageName}::test`);
      expect(failureRatesSorted[1].failureRate).toBe(50);
      expect(failureRatesSorted[2].name).toBe(`${someStageName}::build`);
      expect(failureRatesSorted[2].failureRate).toBe(10);
      expect(failureRatesSorted[3].name).toBe(`${someStageName}::deploy`);
      expect(failureRatesSorted[3].failureRate).toBe(0);
      
    });
  });

  function pipelineRunSeries(results: string[], diffInMinutes: number, pipelineName: string): CdPipelineRun[] {
    const timeStamp = moment();
    return results.map((result, i) => {
      timeStamp.add(diffInMinutes, "minute");
      return {
        result: result,
        pipelineName: pipelineName,
        id: "12345",
        dateTime: timeStamp.format("YYYY-MM-DD HH:mm:ss"),
        jobs: []
      }
    })
  };

  describe("MTTR: ", () => {
    test("should calculate time to restore for one group of pipeline runs with one restore", async () => {
    
      const somePipelineName = "build::test::deploy";

      const runSeries = pipelineRunSeries(
        ["failed", "failed", "success"],
        10,
      somePipelineName);
      const data = new CdStabilityData(runSeries);
      expect(data.pipelineMttrs.length).toBe(1);

      const actualMttr = data.pipelineMttrs[0].mttr;
      expect(actualMttr!.days()).toBe(0);
      expect(actualMttr!.hours()).toBe(0);
      expect(actualMttr!.minutes()).toBe(20);
      
    });

    test("should calculate MEAN time to restore for pipeline runs with multiple failures and restores", async () => {
    
      const somePipelineName = "build::test::deploy";

      const runSeries = pipelineRunSeries(
        ["failed", "failed", "success", // 20 mins 
        "success",
        "failed", "success",            // 10 mins
        "failed", "failed", "success"], // 20 mins
        10,
      somePipelineName);
      const data = new CdStabilityData(runSeries);
      expect(data.pipelineMttrs.length).toBe(1);

      const actualMttr = data.pipelineMttrs[0].mttr;
      expect(actualMttr!.days()).toBe(0);
      expect(actualMttr!.hours()).toBe(0);
      expect(actualMttr!.minutes()).toBe(16);
      
    });

    test("should not return an MTTR when there are only failures", async () => {
    
      const somePipelineName = "build::test::deploy";

      const runSeries = pipelineRunSeries(
        ["failed", "failed", "failed"],
        10,
      somePipelineName);
      const data = new CdStabilityData(runSeries);
      expect(data.pipelineMttrs.length).toBe(1);

      expect(data.pipelineMttrs[0].mttr).toBeUndefined();
      expect(data.pipelineMttrs[0].mttrComment).toContain("run(s) failed");
      
      
    });

    test("should not return an MTTR when there are only successes", async () => {
    
      const somePipelineName = "build::test::deploy";

      const runSeries = pipelineRunSeries(
        ["success", "success", "success"],
        10,
      somePipelineName);
      const data = new CdStabilityData(runSeries);
      expect(data.pipelineMttrs.length).toBe(1);

      expect(data.pipelineMttrs[0].mttr).toBeUndefined();
      expect(data.pipelineMttrs[0].mttrComment).toContain("run(s) succeeded");
      
    });

  });

});


