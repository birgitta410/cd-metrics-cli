import { CdChangeReader, CdEventsQuery, CdChangeEvent, CdChangeReference } from './Model';
import _ from 'lodash';
import moment from 'moment';
import chalk = require('chalk');

export class CdChangeService {

    constructor(private reader: CdChangeReader) { }

    public getBranchDiffSet(originalBranch:CdChangeEvent[], branchToDiff: CdChangeEvent[]): CdChangeEvent[] {
      const chronologicalOriginals = _.sortBy(originalBranch, "dateTime");
      const chronologicalBranchedOff = _.sortBy(branchToDiff, "dateTime");

      const commitsExclusivelyOnBranch = _.differenceBy(
        chronologicalBranchedOff, // needs to be the first arguments, so it's the diff of the branch, not the master
        chronologicalOriginals,
        "revision");
      
      if(commitsExclusivelyOnBranch.length === 0) {
        return [];
      } else {
        console.log(`Found ${commitsExclusivelyOnBranch.length} commits exclusively on branch`);
      }

      return commitsExclusivelyOnBranch;

    }

    private getEventsOnBranch(branchName: string, branchEvents: CdChangeEvent[], masterEvents: CdChangeEvent[]): CdChangeEvent[] {
        
        const eventsOnlyOnBranch = this.getBranchDiffSet(masterEvents, branchEvents);
        
        eventsOnlyOnBranch.forEach(change => {
          change.ref = branchName;
        });
        return eventsOnlyOnBranch;
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

    private async loadMasterBranch() {
      let branches = await this.reader.loadBranches("master");
      if (branches.length > 1) {
        return branches.find(b => b.name === "master");
      }
      return branches[0];
    }

    public async loadChanges(
        query: CdEventsQuery
      ): Promise<CdChangeEvent[]> {
    
        let tags: CdChangeReference[] = [];
        if(query.tags) {
           tags = await this.reader.loadTags(query.tags);
        }
        
        const masterBranch = await this.loadMasterBranch();
        if(masterBranch === undefined) {
          throw new Error("Could not find master branch");
        }

        let branches = [];
        if(query.branch === "master") {
          branches = [masterBranch];
        } else {
          branches = await this.reader.loadBranches(query.branch);
          branches.push(masterBranch);
        }
        
        let changeEvents;
        if (branches.length !== 1) {
          const eventsOnMaster = await this.reader.loadCommitsForBranch(query, masterBranch);
          const eventsPerBranch = await Promise.all(branches.map(async (branch: CdChangeReference) => {
            if(branch.name !== "master") {
              const allEventsOnBranch = await this.reader.loadCommitsForBranch(query, branch);
              return this.getEventsOnBranch(branch.name, allEventsOnBranch, eventsOnMaster);
            }
          }));
          // TODO: Why do I need compact here? Where do undefined events come from?
          const allEventsFromBranches = _.compact(_.flatten(eventsPerBranch));
          changeEvents = _.sortBy(_.concat(allEventsFromBranches, eventsOnMaster), "dateTime");
          console.log(`Got ${chalk.cyanBright(changeEvents.length)} commits, ${chalk.cyanBright(allEventsFromBranches.length)} of those from branches ${chalk.cyanBright(branches.map(b => b.name))}`);
        } else {
          changeEvents = await this.reader.loadCommitsForBranch(query, branches[0]);
          console.log(`Got ${chalk.cyanBright(changeEvents.length)} commits from branch ${chalk.cyanBright(branches[0].name)}`);
        }

        const commits = _.chain(changeEvents)
          .map((c: any) => {
            return this.addReferencesToEvents(c, tags.concat(tags));
          })
          .value();
        
        return commits;
          
      }

}