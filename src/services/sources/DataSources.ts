import { BuildServerClient } from './BuildServerClient';

export class DataSources {

    static instance: DataSources;

    constructor(public buildServerClient: BuildServerClient) {}

    static set(newDataSources: DataSources) {
        DataSources.instance = newDataSources;
    }

    static getInstance(): DataSources {
        return DataSources.instance;
    }
}