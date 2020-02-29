
import moment from "moment";


export interface CdPipelineComponent {
    id: string,
    result: string,
    dateTime: string
}

export interface CdJobRun extends CdPipelineComponent {
    jobName: string,
    stageName: string,
    ref: string
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

export interface CdMttr {
    mttr?: moment.Duration,
    mttrComment?: string,
    numberOfRuns: number,
    pipelineName: string
}

export interface CdStabilityQuery {
    /**
     * Start date of the time frame to look for data
     */
    since: moment.Moment;
    /**
     * End date of the time frame to look for data
     */
    until: moment.Moment;
    /**
     * List of branches to get pipeline runs for
     * (e.g. ["master"])
     */
    branches: string[];
}

export interface CdPipelineReader {
    /**
     * Should return all pipeline runs in the given time period
     */
    loadPipelines(query: CdStabilityQuery): Promise<CdPipelineRun[]>;
}
