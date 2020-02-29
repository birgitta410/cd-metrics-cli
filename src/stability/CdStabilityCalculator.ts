import { CdPipelineReader, CdPipelineRun, CdJobRun, CdFailureRate, CdPipelineComponent } from "./Model";
import moment from "moment";
import chalk from "chalk";
import * as _ from "lodash";
import { Printer } from '../Printer';

export class CdStabilityData {
  
  public pipelineFailureRate: CdFailureRate;
  public jobFailureRates: CdFailureRate[];

  constructor(private pipelines: CdPipelineRun[]
  ) {
    this.pipelineFailureRate = this.calculateFailureRateFor(pipelines);
    this.jobFailureRates = this.calculateJobFailureRates(this.determineJobs());
  }

  private calculateJobFailureRates(jobRuns: CdJobRun[]): CdFailureRate[] {
    const jobNames = _.uniq(jobRuns.map(job => job.jobName));
    const result: CdFailureRate[] = [];
    jobNames.forEach(jobName => {
        const jobsWithName = jobRuns.filter(job => { return job.jobName === jobName; });
        const jobKey = `${jobsWithName[0].stageName}::${jobName}`;
        const failureRate = this.calculateFailureRateFor(jobsWithName);
        failureRate.name = jobKey;
        result.push(failureRate);
    });
    return result;
  }

  private calculateFailureRateFor(jobsOrPipelines: CdPipelineComponent[]): CdFailureRate {
    const numberOfFailed = jobsOrPipelines.filter(jobOrPipeline => {
        return jobOrPipeline.result === "failed";
    }).length;
    const numberOfSuccess = jobsOrPipelines.filter(jobOrPipeline => {
        return jobOrPipeline.result === "success";
    }).length;

    if(numberOfSuccess === 0 && numberOfFailed === 0) {
        return {
            failureRate: 0,
            numberOfSuccess: 0,
            numberOfFailed: 0
        };
    } else {
        return {
            failureRate: _.round(numberOfFailed / (numberOfFailed + numberOfSuccess) * 100, 2),
            numberOfSuccess: numberOfSuccess,
            numberOfFailed: numberOfFailed
        };
    }
  }

  private determineJobs(): CdJobRun[] {
    return _.chain(this.pipelines)
        .map(pipeline => {
            return pipeline.jobs;
        })
        .flatten()
        .filter(job => {
            return job.result === "success" || job.result === "failed";
        })
        .value();
  }

}
export class CdStabilityCalculator {
  constructor(private pipelineReader: CdPipelineReader) {}

  private static COLOR_BAD = chalk.redBright;
  private static COLOR_OK = chalk.yellowBright;
  private static COLOR_PERFECT = chalk.greenBright;

  private static colorFn(failureRate: number) {
    if(failureRate >= 50) {
      return CdStabilityCalculator.COLOR_BAD;
    } else if (failureRate <=5) {
        return CdStabilityCalculator.COLOR_PERFECT;
    } else {
      return CdStabilityCalculator.COLOR_OK;
    }
  }

  public async printFailureRates(
    releaseBranch: string,
    since: moment.Moment,
    until: moment.Moment
  ): Promise<any> {
    const query = {
      since: moment(since),
      until: moment(until),
      branch: releaseBranch
    };

    const pipelines = await this.pipelineReader.loadPipelines(query);

    const data = new CdStabilityData(pipelines);
    const failureByPipeline = data.pipelineFailureRate;
    console.log(`Failure rate of pipelines is ${CdStabilityCalculator.colorFn(failureByPipeline.failureRate)(`${failureByPipeline.failureRate}%`)}`
        +` (${failureByPipeline.numberOfFailed}/${failureByPipeline.numberOfFailed+failureByPipeline.numberOfSuccess})`);

    const jobFailureRates = data.jobFailureRates;
    _.orderBy(jobFailureRates, "failureRate", "desc").forEach(failureRate => {
        console.log(`${CdStabilityCalculator.colorFn(failureRate.failureRate)(`${failureRate.failureRate}%\t`)} `
            +`${failureRate.numberOfFailed}/${failureRate.numberOfSuccess + failureRate.numberOfFailed}`
            +`\t\t${failureRate.name}`);
    });

    const lines = _.orderBy(pipelines, "dateTime")
      .filter(pipeline => {
        return pipeline.result === "success" || pipeline.result === "failed";
      })
      .map(pipeline => {
        const failures = pipeline.jobs
          .filter(job => {
            return job.result === "failed";
          })
          .map(job => {
            return job.jobName;
          });
        return `${pipeline.id}\t${failures}\t${pipeline.result}\t${pipeline.dateTime}`;
      });
    await Printer.print(lines, "Print list of pipeline outcomes?");


  }
}
