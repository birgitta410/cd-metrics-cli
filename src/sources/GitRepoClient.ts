import nodegit from "nodegit";
import moment from "moment";
import chalk from "chalk";
import * as _ from "lodash";
import { CdChangeReader, CdEventsQuery, CdChangeReference, CdChangeEvent } from '../throughput/Model';
import { TimeUtil } from '../TimeUtil';

interface GitCommit {
  short_id: string,
  id: string,
  created_at: string,
  authored_at: string,
  title: string,
  is_merge: boolean,
};

export class GitRepoClient implements CdChangeReader {
    
    constructor(private pathToRepo: string) {}

    private createRevwalk(refName: string): Promise<any> {
      return nodegit.Repository.open(this.pathToRepo).then(function(repo:nodegit.Repository) {
        return repo.checkoutBranch(refName).then(() => {
          const revWalk = repo.createRevWalk();
          revWalk.pushRef(refName); // Point to the latest commit on the branch
          return revWalk;
        }).catch((error) => {
          console.log(`ERROR ${error}`);
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
      const tags = await Promise.all(tagReferences.map(async (tagRef) => {
        const tag = repo.getTagByName(tagRef.name()).catch(error => {
          // FIXME: Maybe this is happening with missing tag messages?
          // https://github.com/nodegit/nodegit/issues/1311
          console.log(`${chalk.yellow(`WARNING:`)} Error getting tag ${tagRef.name()}: ${error}`);
        });
        return tag;
      }));
      const successfullyLoadedTags = <nodegit.Tag[]>_.compact(tags);
      console.log(`Successfully read ${successfullyLoadedTags.length}/${tagReferences.length} tags`);
      return successfullyLoadedTags;
    }

    private authoringTime(commit: nodegit.Commit): moment.Moment {
      const authoringTimestamp = commit.author().when().time();
      return moment.unix(authoringTimestamp);
    }

    private toGitCommit(commit: nodegit.Commit): GitCommit {
      const isMergeCommitCandidate = commit.parents().length > 1;
      return {
        short_id: commit.sha().substr(0, 8),
        id: commit.sha(),
        created_at: commit.date().toISOString(),
        authored_at: this.authoringTime(commit).toISOString(),
        title: commit.message(),
        is_merge: isMergeCommitCandidate
      };
    }
  
    private loadBatchOfCommitsSince(refName: string, since: moment.Moment): Promise<GitCommit[]> {
      return this.createRevwalk(refName)
        .then(revWalk => {
          return revWalk.getCommitsUntil((commit: nodegit.Commit) => {
            return this.authoringTime(commit).isAfter(since);
          });
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
      if(pattern === "master") {
        pattern = "^master$";
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
          originalName: branch.name(),
          commit: branch.target().tostrS()
        };
      });

      return this.filterReferences(references, branchPattern);
    }

    public async loadCommitsForBranch(query: CdEventsQuery, branch: CdChangeReference): Promise<CdChangeEvent[]> {
      const gitCommitsSince = await this.loadBatchOfCommitsSince(branch.originalName || branch.name, query.since);
      const gitCommitsInTimeFrame = gitCommitsSince.filter((commit: GitCommit) => {
        return moment(commit.authored_at).isBefore(query.until)
          && moment(commit.created_at).isAfter(query.since); // filter out potentially one overincluded commit
      });
      
      return gitCommitsInTimeFrame.map((gitCommit: GitCommit) => {
        return {
          eventType: "change",
          revision: gitCommit.short_id,
          dateTime: TimeUtil.normalizeTime(gitCommit.created_at),
          authorDateTime: TimeUtil.normalizeTime(gitCommit.authored_at),
          isMergeCommit: gitCommit.is_merge,
          ref: branch.commit === gitCommit.short_id || branch.commit === gitCommit.id ? branch.name : ""
        };
      })
    }
  }