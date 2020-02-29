
import moment from "moment";

export interface CdStabilityQuery {
    since: moment.Moment;
    until: moment.Moment;
    branch: string;
  }

export interface CdPipelineComponent {
    id: string,
    result: string,
    dateTime: string
}

export interface CdJobRun extends CdPipelineComponent {
    jobName: string,
    stageName: string
}

export interface CdPipelineRun extends CdPipelineComponent {
    jobs: CdJobRun[],
    metrics?: {
        failure?: number,
        jobs?: {
            [jobName: string]: {
                failure: number
            }
        }
    };
}

export interface CdFailureRate {
    failureRate: number,
    numberOfSuccess: number,
    numberOfFailed: number,
    name?: string
}

export interface CdPipelineReader {
    loadPipelines(query: CdStabilityQuery): Promise<CdPipelineRun[]>;
}