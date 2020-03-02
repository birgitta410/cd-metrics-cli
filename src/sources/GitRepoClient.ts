import nodegit from "nodegit";
import moment from "moment";
import * as _ from "lodash";
import { CdChangeReader, CdEventsQuery, CdChangeReference, CdChangeEvent } from '../throughput/Model';

interface GitCommit {
  short_id: string,
  created_at: string,
  title: string,
  is_merge: boolean,
};

export class GitRepoClient implements CdChangeReader {
    
    constructor(private pathToRepo: string) {}

    private createRevwalk(refName: string): Promise<any> {
      return nodegit.Repository.open(this.pathToRepo).then(function(repo:nodegit.Repository) {
        return repo.checkoutBranch(refName).then(() => {
          const revWalk = repo.createRevWalk();
          revWalk.pushHead(); // Point to the latest commit
          return revWalk;
        });
      });
    }
  
    public async getBranches(): Promise<nodegit.Reference[]> {
      const repo = await nodegit.Repository.open(this.pathToRepo);
      const references: nodegit.Reference[] = await (repo.getReferences as any)();
      return _.uniqBy(_.filter(references, ref => {
        return ref.isRemote() === 1 && ref.isTag() === 0;
      }), (ref) => { return ref.name(); });
    }

    public async getTags(): Promise<nodegit.Tag[]> {
      const repo = await nodegit.Repository.open(this.pathToRepo);
      const references: nodegit.Reference[] = await (repo.getReferences as any)();
      const tagReferences = _.filter(references, ref => {
        return ref.isTag() === 1;
      });
      return Promise.all(tagReferences.map(tagRef => {
        return repo.getTagByName(tagRef.name())
      }));
    }

    private toGitCommit(commit: nodegit.Commit): GitCommit {
      const isMergeCommitCandidate = commit.parents().length > 1;
      const authoringTimestamp = commit.author().when().time();
      return {
        short_id: commit.sha().substr(0, 8),
        created_at: moment.unix(authoringTimestamp).toISOString(),
        title: commit.message(),
        is_merge: isMergeCommitCandidate
      };
    }
  
    private loadBatchOfCommits(refName: string, numCommits: number): Promise<GitCommit[]> {
      return this.createRevwalk(refName)
        .then(revWalk => {
          return revWalk.getCommits(numCommits);
        })
        .then((commits: nodegit.Commit[]) => {
          return commits.map(commit => {
            return this.toGitCommit(commit);
          });
        });
    }

    private filterReferences(references: CdChangeReference[], pattern: string) {
      if(pattern === "*") {
        return references;
      }
      const regex = new RegExp(`${pattern}`, "g");
      return references.filter(ref => {
        const match = ref.name.match(regex);
        return match !== null && match.length > 0;
      });
    }

    public async loadTags(tagsPattern: string): Promise<CdChangeReference[]> {
      const allTags = await this.getTags();
      const references = allTags.map(tag => {
        return {
          name: tag.name(),
          commit: tag.targetId().tostrS()
        };
      });
      return this.filterReferences(references, tagsPattern);
    }

    public async loadBranches(branchPattern: string): Promise<CdChangeReference[]> {
      const allBranches = await this.getBranches();
      const references = allBranches.map(branch => {
        return {
          name: branch.shorthand().replace("origin/", ""),
          commit: branch.target().tostrS()
        };
      });
      
      return this.filterReferences(references, branchPattern);
    }

    public async loadCommitsForBranch(query: CdEventsQuery, branch: CdChangeReference): Promise<CdChangeEvent[]> {
      const gitCommits = await this.loadBatchOfCommits(query.branch, 100);
      return gitCommits.map(gitCommit => {
        return {
          eventType: "change",
          revision: gitCommit.short_id,
          dateTime: gitCommit.created_at,
          isMergeCommit: gitCommit.is_merge,
          ref: branch.commit === gitCommit.short_id ? branch.name : ""
        };
      })
    }
  }