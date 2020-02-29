
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
    /**
     * A name that can identify a set of runs as runs of the same pipeline
     */
    pipelineName: string,
    /**
     * Jobs that ran as part of this pipeline run
     */
    jobs: CdJobRun[]
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