import { CdChangeReader, CdEventsQuery, CdChangeEvent, CdChangeReference } from './Model';
import _ from 'lodash';
import chalk = require('chalk');

export class CdChangeService {

    constructor(private reader: CdChangeReader) { }

    private addReferencesToEvents(changeEvent: CdChangeEvent, tags: CdChangeReference[]): CdChangeEvent {
        const tagPointingAtCommit = tags.filter((tag: CdChangeReference) => {
            return tag.commit === changeEvent.revision;
        });
        if(tagPointingAtCommit.length > 0) {
            changeEvent.ref = tagPointingAtCommit[0].name;
        }
        return changeEvent;
    }

    public async loadChanges(
        query: CdEventsQuery
      ): Promise<CdChangeEvent[]> {
    
        let tags: CdChangeReference[] = [];
        if(query.tags) {
           tags = await this.reader.loadTags(query.tags);
        }
        
        let branches = await this.reader.loadBranches(query.branch);
        if (branches.length !== 1 && query.branch === "master") {
          branches = branches.filter(b => b.name === "master");
        }
        if (branches.length !== 1) {
          console.log(chalk.red(`ERROR: Expecting exactly one branch named '${query.branch}', but found ${branches.length}`));
          return [];
        }

        const eventsPerBranch = await this.reader.loadCommitsForBranch(query, branches[0]);

        const commits = _.chain(eventsPerBranch)
          .map((c: any) => {
            return this.addReferencesToEvents(c, tags.concat(tags));
          })
          .value();
        console.log(`Got ${chalk.cyanBright(commits.length)} commits from branch ${chalk.cyanBright(branches[0].name)}`);
        return commits;
          
      }

}