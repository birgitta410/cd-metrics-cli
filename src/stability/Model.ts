
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

export interface CdJob extends CdPipelineComponent {
    name: string,
    stage: string
}

export interface CdPipeline extends CdPipelineComponent {
    stages: {
        [stageName: string]: CdJob[]
    },
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
    loadPipelines(query: CdStabilityQuery): Promise<CdPipeline[]>;
}