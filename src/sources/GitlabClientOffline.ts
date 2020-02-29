import { CdPipelineReader, CdStabilityQuery, CdPipelineRun } from "../stability/Model";
import { GitlabDataMapper } from "./GitlabClient";
import * as _ from "lodash";
import fs from "fs";
import moment from "moment";
import chalk from "chalk";

export class GitlabClientOffline implements CdPipelineReader {

    public static writeJson(fileIdentifier: string, data: any) {
        fs.writeFileSync(`${fileIdentifier}-${moment().toISOString()}.json`, JSON.stringify(data));
    }

    public static readJson(fileName: string): any {
        console.log(`Loading file contents: ./offline-data/${fileName}`);
        return JSON.parse(fs.readFileSync(`./offline-data/${fileName}`, "utf8"));
    }

    private getAllPipelines() {
        const pipelineRunsPerBranch = GitlabClientOffline.readJson("PipelinesAll-getAllPipelines.json");
        
        const pipelineRuns = _.flatten(pipelineRunsPerBranch);
        
        console.log(`Got ${chalk.cyanBright(pipelineRuns.length)} pipeline runs`);
        return pipelineRuns;
    }

    public async loadPipelines(query: CdStabilityQuery): Promise<CdPipelineRun[]> {

        const pipelineRuns = await this.getAllPipelines();
        
        let i = 1;
        const allPipelineRuns: CdPipelineRun[] = pipelineRuns.map(p => {
          
          const jobsInPipelineRun = GitlabClientOffline.readJson(`${i}_PipelinesShowJobs-loadPipelines.json`)
          i++;
          const jobRuns = jobsInPipelineRun.map(GitlabDataMapper.toCdJobRun);
          return GitlabDataMapper.toCdPipelineRun(p, jobRuns);
        });
        
        return allPipelineRuns;
    
      }

}