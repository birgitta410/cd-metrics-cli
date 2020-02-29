import nodegit, { Revwalk } from "nodegit";
import * as _ from "lodash";
import { CdChangeReader, CdEventsQuery } from './Interfaces';

interface GitCommit {
  short_id: string,
  created_at: string,
  title: string,
  is_merge: boolean,
};

export class GitRepoClient implements CdChangeReader {
    
    constructor(private pathToRepo: string) {}

    private createRevwalk(): Promise<any> {
      return nodegit.Repository.open(this.pathToRepo).then(function(repo) {
        const revWalk = repo.createRevWalk();
        revWalk.pushHead(); // Point to the latest commit
        return revWalk;
      });
    }
  
    public async getBranches(): Promise<nodegit.Reference[]> {
      const repo = await nodegit.Repository.open(this.pathToRepo);
      const references: nodegit.Reference[] = await (repo.getReferences as any)();
      return _.filter(references, ref => {
        return ref.isBranch() === 1;
      });
    }
  
    public loadChanges(query: import("./Interfaces").CdEventsQuery): Promise<any[]> {
      const batchSize = 100;
      return this.loadBatchOfCommits(100);
    }

    private loadBatchOfCommits(numCommits: number): Promise<GitCommit[]> {
      return this.createRevwalk()
        .then(revWalk => {
          return revWalk.getCommits(numCommits);
        })
        .then((commits: nodegit.Commit[]) => {
          return commits.map(commit => {
            const isMergeCommitCandidate = commit.parents().length > 1;
            return {
              short_id: commit.sha().substr(0, 8),
              created_at: commit.date().toISOString(),
              title: commit.message(),
              is_merge: isMergeCommitCandidate
            };
          });
        });
    }
  }