import { CdChangeReader, CdEventsQuery, CdChangeEvent, CdChangeReference } from './Model';
import _ from 'lodash';
import chalk = require('chalk');

export class CdChangeService {

    constructor(private reader: CdChangeReader) { }

    private async getRefNames(query: CdEventsQuery): Promise<CdChangeReference[]> {
        if(query.tags !== undefined) {
            return await this.reader.loadTags(query.tags);
        } else {
            return await this.reader.loadBranches(query.branch);
        }
    }

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
        
        let targetRefs = await this.getRefNames(query);
    
        const eventsPerBranch = await this.reader.loadCommitsForReferences(query, targetRefs);

        const commits = _.chain(eventsPerBranch)
          .uniqBy("revision")
          .map((c: any) => {
            return this.addReferencesToEvents(c, tags.concat(targetRefs));
          })
          .value();
        console.log(`Got ${chalk.cyanBright(commits.length)} unique commits from branch(es)/tag(s) ${chalk.cyanBright(targetRefs)}`);
        return commits;
          
      }

}