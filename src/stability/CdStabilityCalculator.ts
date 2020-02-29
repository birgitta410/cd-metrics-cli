import { CdPipelineReader, CdPipeline, CdJob, CdFailureRate } from "./Model";
import moment from "moment";
import chalk from "chalk";
import * as _ from "lodash";

export class CdStabilityCalculator {
  constructor(private pipelineReader: CdPipelineReader) {}


  private getFailureRateFor(jobs: CdJob[]): CdFailureRate {
    const numberOfFailed = jobs.filter(job => {
        return job.result === "failed";
    }).length;
    const numberOfSuccess = jobs.filter(job => {
        return job.result === "success";
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

  private addFailureRateToPipeline(pipeline: CdPipeline) {
    const allJobs = _.flatten(
      _.keys(pipeline.stages).map(stageName => {
        return pipeline.stages[stageName];
      })
    );

    pipeline.metrics = pipeline.metrics || {};
    pipeline.metrics.failure = this.getFailureRateFor(allJobs).failureRate;
  }

  private getFailureRateByJobs(jobs: CdJob[]): CdFailureRate[] {
    const jobNames = _.uniq(jobs.map(job => job.name));
    const result: CdFailureRate[] = [];
    jobNames.forEach(jobName => {
        const jobsWithName = jobs.filter(job => { return job.name === jobName; });
        const jobKey = `${jobsWithName[0].stage}::${jobName}`;
        const failureRate = this.getFailureRateFor(jobsWithName);
        failureRate.name = jobKey;
        result.push(failureRate);
    });
    return result;
  }

  public async calculateFailureRate(
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
    const allJobs = _.chain(pipelines)
        .map(pipeline => {
            const stageNames = _.keys(pipeline.stages);
            return stageNames.map(stageName => {
                return pipeline.stages[stageName];
            })
        })
        .flatten()
        .flatten()
        .value();
    console.log(`Got ${pipelines.length} pipelines with ${allJobs.length} jobs`);
    
    pipelines.forEach(pipeline => this.addFailureRateToPipeline(pipeline));
    
    const allMetrics = pipelines.map(p => p.metrics);
    const average = _.round(_.meanBy(allMetrics, "failure"), 2);

    const jobFailureRates = this.getFailureRateByJobs(allJobs);
    
    console.log(`Average failure rate is ${chalk.cyanBright(average)}`);

    const COLOR_BAD = chalk.redBright;
    const COLOR_OK = chalk.yellowBright;
    const COLOR_PERFECT = chalk.greenBright;
    _.orderBy(jobFailureRates, "failureRate", "desc").forEach(failureRate => {
        let colorFn = COLOR_OK;
        if(failureRate.failureRate >= 50) {
            colorFn = COLOR_BAD;
        } else if (failureRate.failureRate <=5) {
            colorFn = COLOR_PERFECT;
        }
        console.log(`${colorFn(failureRate.failureRate)} `
            +`(${failureRate.numberOfFailed}/${failureRate.numberOfSuccess + failureRate.numberOfFailed})`
            +`\t\t${failureRate.name}`);
    });

  }
}
