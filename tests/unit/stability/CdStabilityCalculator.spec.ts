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

  test("should calculate overall failure rate of all pipeline runs", async () => {
    
    const data = new CdStabilityData(pipelineRuns(10, 10));
    expect(data.pipelineFailureRate.failureRate).toBe(50);
    expect(data.pipelineFailureRate.numberOfFailed).toBe(10);
    expect(data.pipelineFailureRate.numberOfSuccess).toBe(10);
    
  });

  test.only("should calculate failure rates for each job (grouped by name), sorted from highest rate to lowest", () => {
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


