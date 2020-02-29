import { CdPipelineReader, CdPipeline, CdJob } from "./Model";
import moment from "moment";
import * as _ from "lodash";

export class CdStabilityCalculator {
  constructor(private pipelineReader: CdPipelineReader) {}


  private getFailureRateFor(jobs: CdJob[]): number {
    const numberOfFailed = jobs.filter(job => {
        return job.result === "failed";
    }).length;
    const numberOfSuccess = jobs.filter(job => {
        return job.result === "success";
    }).length;

    if(numberOfSuccess === 0 && numberOfFailed === 0) {
        return 0;
    } else {
        return _.round(numberOfFailed / (numberOfFailed + numberOfSuccess) * 100, 2);
    }
  }

  private addFailureRateToPipeline(pipeline: CdPipeline) {
    const allJobs = _.flatten(
      _.keys(pipeline.stages).map(stageName => {
        return pipeline.stages[stageName];
      })
    );

    pipeline.metrics = pipeline.metrics || {};
    pipeline.metrics.failure = this.getFailureRateFor(allJobs);
    console.log(`Failure rate of ${pipeline.id}: ${pipeline.metrics.failure}`);
  }

  private getFailureRateByJobs(jobs: CdJob[]): { [jobName: string ]: number[]} {
    const jobNames = _.uniq(jobs.map(job => job.name));
    const result: { [jobName: string ]: number[]} = {};
    jobNames.forEach(jobName => {
        const jobsWithName = jobs.filter(job => { return job.name === jobName; });
        const jobKey = `${jobsWithName[0].stage}:${jobName}`;
        result[jobKey] = result[jobKey] || [];
        const failureRate = this.getFailureRateFor(jobsWithName);
        result[jobKey].push(failureRate)
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
    pipelines.forEach(pipeline => this.addFailureRateToPipeline(pipeline));
    
    const allMetrics = pipelines.map(p => p.metrics);
    const average = _.round(_.meanBy(allMetrics, "failure"), 2);

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

    const jobFailureRates = this.getFailureRateByJobs(allJobs);

    console.log(`Average failure rate is ${average}`);

    _.keys(jobFailureRates).forEach(jobName => {
        console.log(`Job ${jobName}: ${jobFailureRates[jobName]}`);
    });


  }
}
