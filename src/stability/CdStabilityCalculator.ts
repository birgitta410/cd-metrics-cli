import { CdPipelineReader, CdPipelineRun, CdJobRun, CdFailureRate, CdPipelineComponent, CdMttr } from "./Model";
import moment from "moment";
import chalk from "chalk";
import * as _ from "lodash";
import { Printer } from '../Printer';
import { TimeUtil } from '../TimeUtil';

export class CdStabilityData {
  
  public pipelineFailureRate: CdFailureRate;
  public jobFailureRates: CdFailureRate[];
  public pipelineMttrs: CdMttr[];

  constructor(private pipelines: CdPipelineRun[]) {
    const relevantPipelines = pipelines.filter(p => {
      return p.result === "success" || p.result === "failed";
    });
    this.pipelineFailureRate = this.calculateFailureRateFor(relevantPipelines);
    this.jobFailureRates = this.calculateJobFailureRates(this.determineJobs());
    this.pipelineMttrs = this.calculatePipelineMttrs(relevantPipelines);
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

  private calculatePipelineMttrs(pipelines: CdPipelineRun[]): CdMttr[] {
    const pipelineNames = _.uniq(pipelines.map(p => { return p.pipelineName; }));
    return pipelineNames.map((pipelineName: string) => {
      return this.calculateMttrForOnePipeline(pipelineName, 
        pipelines.filter(p => { return pipelineName === p.pipelineName; }));
    });
  }

  private calculateMttrForOnePipeline(pipelineName: string, runsWithName: CdPipelineRun[]): CdMttr {
    const pipelinesWithName = _.orderBy(runsWithName, "dateTime", "asc");

    const allFailures = pipelinesWithName.filter(p => { return p.result === "failed"; });
    const allSuccesses = pipelinesWithName.filter(p => { return p.result === "success"; });
    if(allFailures.length === 0 || allSuccesses.length === 0) {
      return {
        mttr: undefined,
        numberOfRuns: pipelinesWithName.length,
        mttrComment: `all ${pipelinesWithName.length} runs in time frame are ${allFailures.length === 0 ? "successes" : "failures"}`,
        pipelineName: pipelineName
      }
    }
    
    const restoreTimes: moment.Duration[] = [];
    let currentFailure: CdPipelineRun | undefined;
    pipelinesWithName.forEach((p: CdPipelineRun) => {
      if(currentFailure !== undefined) {
        if(p.result === "failed") {
          // continue
        } else if (p.result === "success") {
          const mttr: moment.Duration = moment.duration(moment(p.dateTime, "YYYY-MM-DD HH:mm:ss").diff(moment(currentFailure.dateTime, "YYYY-MM-DD HH:mm:ss")));
          restoreTimes.push(mttr);
          // reset
          currentFailure = undefined;
        }
      } else {
        if(p.result === "failed") {
          currentFailure = p;
        }
      }
    });

    const avgRestoreInMinutes = _.meanBy(restoreTimes, duration => {
      return duration.asMinutes();
    });
    return {
      mttr: moment.duration(avgRestoreInMinutes, "minutes"),
      numberOfRuns: pipelinesWithName.length,
      pipelineName: pipelineName
    }
    
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
    branches: string[],
    since: moment.Moment,
    until: moment.Moment
  ): Promise<any> {
    const query = {
      since: since,
      until: until,
      branches: branches
    };

    console.log(`Getting failure rates and MTTRs,
      focusing on pipelines running on branch(es) ${chalk.cyanBright(
        query.branches
      )},
      Timeline ${chalk.cyanBright(
        TimeUtil.gitlabApiDateString(query.since)
      )} - ${chalk.cyanBright(
        TimeUtil.gitlabApiDateString(query.until)
    )}
      `);

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

    const pipelineMttrs = _.orderBy(data.pipelineMttrs, "pipelineName");
    pipelineMttrs.forEach(mttr => {
      console.log(`${mttr.mttr ? mttr.mttr!.humanize() : `n/a`}`
        +`\t${mttr.mttrComment ? `(${mttr.mttrComment})` : `${mttr.numberOfRuns} run(s) considered`}`
        +`\t${mttr.pipelineName}`);
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
