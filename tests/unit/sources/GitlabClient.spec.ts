import { Gitlab, Pipelines, Commits, Branches, Tags } from "gitlab";
import { GitlabClient, GitlabConfig } from "../../../src/sources/GitlabClient";
import moment = require('moment');
import { CdThroughputCalculator } from '@/throughput/CdThroughputCalculator';
import { CdChangeReference } from '@/throughput/Model';
import { CdStabilityQuery } from '@/stability/Model';

jest.mock("gitlab");

describe("GitlabClient", () => {
  let apiMock: Gitlab;
  let pipelinesApiMock: any = {};
  let commitsApiMock: any = {};
  let branchesApiMock: any = {};
  let tagsApiMock: any = {};

  const someProjectId = 1111;

  function resetMocks() {
    apiMock = new Gitlab();
    apiMock.Pipelines = new Pipelines();
    apiMock.Commits = new Commits();
    apiMock.Branches = new Branches();
    apiMock.Tags = new Tags();

    pipelinesApiMock = {
      all: jest.fn(),
      showJobs: jest.fn()
    };
    apiMock.Pipelines.all = pipelinesApiMock.all;
    apiMock.Pipelines.showJobs = pipelinesApiMock.showJobs;

    commitsApiMock = {
      all: jest.fn()
    };
    apiMock.Commits.all = commitsApiMock.all;

    branchesApiMock = {
      all: jest.fn()
    };
    apiMock.Branches.all = branchesApiMock.all;

    tagsApiMock = {
      all: jest.fn()
    };
    apiMock.Tags.all = tagsApiMock.all;
  }

  beforeEach(() => {
    resetMocks();
  });

  function createApi() {
    return new GitlabClient(apiMock, new GitlabConfig("someUrl", someProjectId));
  }

  function someGitlabJob() : any {
    return {
      "id": 1487964,
      "status": "success",
      "name": "some_job_name",
      "ref": "master",
      "created_at": "2019-11-08T17:12:24.655Z",
      "finished_at": "2019-11-08T17:15:54.672Z",
      "commit": {
        "id": "35aed3b9ad09a19243dcc2ed4ad3f6014d081580",
        "short_id": "35aed3b9",
        "created_at": "2020-11-08T12:48:17.000+00:00",
        "title": "Some commit message",
        "author_name": "Some Author"
      }
    };
  }

  function someGitlabPipeline() : any {
    return {
      "id": 419002,
      "sha": "35aed3b9a",
      "ref": "master",
      "status": "success",
      "created_at": "2020-02-05T12:48:19.024Z"
    };
  }

  function someGitlabCommit() : any {
    return {
      "id": "4b4e5264edeeb45d1c4f7b45e879258fdd5d5781",
      "short_id": "4b4e5264",
      "created_at": "2020-01-10T17:01:21.000+01:00",
      "parent_ids": [
          "231fe1c855b8d86b4822842a5ca7981000ac1ccc"
      ],
      "title": "some short commit message",
      "author_name": "Some Author"
    };
  }

  function someGitlabBranch() : any {
    return {
      "name": "release/7.41.0",
      "commit": {
          "id": "55cb3e2c2328213003657ba46f65cb0538c50e71",
          "short_id": "55cb3e2c",
          "created_at": "2019-12-09T15:10:00.000+00:00",
          "title": "Some commit message",
          "author_name": "Some Author",
      }
    };
  }

  function someGitlabTag() : any {
    return {
      "name": "4.5.0-1",
      "target": "6f9828be449adae6b6fb82626a96138b718c956b",
      "commit": {
          "id": "6f9828be449adae6b6fb82626a96138b718c956b",
          "short_id": "6f9828be",
          "created_at": "2020-01-31T16:35:57.000+01:00",
      },
      "release": {
          "tag_name": "4.5.0-1",
          "description": "* release description"
      }
    };
  }

  function toChangeReference(gitlabReference: any): CdChangeReference {
    return {
      name: gitlabReference.name,
      commit: gitlabReference.commit ? gitlabReference.commit.short_id : undefined
    };
  }

  function mockMasterBranch() {
    const masterBranch = someGitlabBranch();
    masterBranch.name = "master";
    branchesApiMock.all.mockResolvedValue([
      masterBranch
    ]);
  }

  describe("loadProductionDeployments", () => {
    test("should ask for pipelines on branch and load their respective deployment jobs", async () => {
      const deploymentJob: any = someGitlabJob();
      deploymentJob.name = "the-deployment-job";
      const otherJob: any = someGitlabJob();
      otherJob.name = "some-job";
      pipelinesApiMock.all.mockResolvedValue([
        someGitlabPipeline(), someGitlabPipeline()
      ]);
      pipelinesApiMock.showJobs.mockResolvedValue([
        deploymentJob
      ]);

      mockMasterBranch();

      const actualDeploymentJobs = await createApi().loadProductionDeployments({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: [deploymentJob.name]
      });

      expect(actualDeploymentJobs.length).toBe(2);
      expect(pipelinesApiMock.all).toHaveBeenCalledTimes(1);
      expect(pipelinesApiMock.showJobs).toHaveBeenCalledTimes(2);

      expect(actualDeploymentJobs[0].eventType).toBe("deployment");
      expect(actualDeploymentJobs[0].revision).toBe(deploymentJob.commit.short_id);
      expect(CdThroughputCalculator.normalizeTime(actualDeploymentJobs[0].dateTime)).toBe(CdThroughputCalculator.normalizeTime(deploymentJob.finished_at));
      expect(actualDeploymentJobs[0].result).toBe(deploymentJob.status);
      expect(actualDeploymentJobs[0].jobName).toBe(deploymentJob.name);

    });

    test("should ask for pipelines on multiple branches if branch name is pattern", async () => {
      const deploymentJob: any = someGitlabJob();
      deploymentJob.name = "the-deployment-job";
      deploymentJob.ref = "release/1.2";
      
      pipelinesApiMock.all.mockResolvedValue([
        someGitlabPipeline(), someGitlabPipeline()
      ]);
      pipelinesApiMock.showJobs.mockResolvedValue([
        deploymentJob
      ]);

      const branch1 = someGitlabBranch();
      branch1.name = "release/1.2"
      const branch2 = someGitlabBranch();
      branch2.name = "release/1.3"
      branchesApiMock.all.mockResolvedValue([
        branch1, branch2
      ]);

      const actualDeploymentJobs = await createApi().loadProductionDeployments({
        since: moment(),
        until: moment(),
        branch: "^release",
        prodDeploymentJobNames: [deploymentJob.name]
      });

      expect(actualDeploymentJobs.length).toBe(4);
      expect(actualDeploymentJobs[0].ref).toBe("release/1.2");

      expect(pipelinesApiMock.all).toHaveBeenCalledTimes(2);
      expect(branchesApiMock.all).toHaveBeenCalledWith(someProjectId, { search: "^release" });

    });

    test("should ask for pipelines on tags instead of branches, if tags were provided", async () => {
      const tag1 = someGitlabTag();
      tag1.name = "1.2.3"
      const tag2 = someGitlabTag();
      tag2.name = "1.2.4"
      
      const deploymentJobTag1: any = someGitlabJob();
      deploymentJobTag1.name = "the-deployment-job";
      deploymentJobTag1.ref = tag1.name;
      
      const deploymentJobTag2: any = someGitlabJob();
      deploymentJobTag2.name = deploymentJobTag1.name;
      deploymentJobTag2.ref = tag2.name;
      
      pipelinesApiMock.all
        .mockImplementationOnce(() => Promise.resolve([someGitlabPipeline()]))
        .mockImplementationOnce(() => Promise.resolve([someGitlabPipeline()]));

      pipelinesApiMock.showJobs
        .mockImplementationOnce(() => Promise.resolve([deploymentJobTag1]))
        .mockImplementationOnce(() => Promise.resolve([deploymentJobTag2]));

      tagsApiMock.all.mockResolvedValue([
        tag1, tag2
      ]);

      const actualDeploymentJobs = await createApi().loadProductionDeployments({
        since: moment(),
        until: moment(),
        branch: "master",
        tags: "*",
        prodDeploymentJobNames: [deploymentJobTag1.name]
      });

      expect(actualDeploymentJobs.length).toBe(2);
      expect(actualDeploymentJobs[0].ref).toBe("1.2.3");

      expect(pipelinesApiMock.all).toHaveBeenCalledTimes(2);
      expect(branchesApiMock.all).not.toHaveBeenCalled();
      expect(tagsApiMock.all).toHaveBeenCalledWith(1111, { search: "*" });

    });

    test("should not crash if no deployment jobs can be found", async () => {
      const nonDeploymentJob: any = someGitlabJob();
      nonDeploymentJob.name = "some-job";
      pipelinesApiMock.all.mockResolvedValue([someGitlabPipeline()]);
      pipelinesApiMock.showJobs.mockResolvedValue([nonDeploymentJob]);

      mockMasterBranch();

      const events = await createApi().loadProductionDeployments({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["deployment-job"]
      });

      expect(events.length).toBe(0);
    });
  });

  describe("loadPipelines", () => {
    test("should ask for pipelines on branch and load their respective deployment jobs", async () => {
      pipelinesApiMock.all.mockResolvedValue([
        someGitlabPipeline(), someGitlabPipeline()
      ]);
      
      const job1: any = someGitlabJob();
      job1.name = "a-job";
      job1.stage = "build";
      const job2: any = someGitlabJob();
      job2.name = "some-job";
      job2.stage = "test";
      pipelinesApiMock.showJobs.mockResolvedValue([
        job1, job2
      ]);

      mockMasterBranch();

      const query: CdStabilityQuery = {
        branch: "master",
        since: moment(),
        until: moment() 
      };
      const actualPipelineRuns = await createApi().loadPipelines(query);

      expect(actualPipelineRuns.length).toBe(2);
      expect(actualPipelineRuns[0].pipelineName).toBe("build:test");
      expect(pipelinesApiMock.all).toHaveBeenCalled();
      expect(pipelinesApiMock.showJobs).toHaveBeenCalledTimes(2);

    });

  });

  describe("loadCommitsForBranch", () => {
    test("should get all commits for the specified branch", async () => {
      const commit = someGitlabCommit();
      commitsApiMock.all.mockResolvedValue([
        commit
      ]);

      const actualCommits = await createApi().loadCommitsForBranch({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["does-not-matter"]
      }, toChangeReference({ name: "master" }));

      expect(actualCommits.length).toBe(1);

      expect(actualCommits[0].revision).toBe(commit.short_id);
      expect(moment(actualCommits[0].dateTime).valueOf()).toBe(moment(commit.created_at).valueOf());
      expect(actualCommits[0].isMergeCommit).toBe(false);

    });

  });

  describe("findProdDeploymentJobs", () => {
    test("should return job with the specified filter name", () => {
      const job1 = someGitlabJob();
      job1.name = "name1";
      const job2 = someGitlabJob();
      job2.name = "name2";
      const jobs = [
        job2, job1
      ];
      const filteredJob = createApi()
          .findProdDeploymentJob(jobs, "123455", ["name2"]);
        
      expect(filteredJob.name).toBe("name2");

    });

    test("should return job with the first mentioned name, if there are multiple name matches", () => {
      const job1 = someGitlabJob();
      job1.name = "name1";
      const job2 = someGitlabJob();
      job2.name = "name2";
      const jobs = [
        job2, job1
      ];
      const filteredJob = createApi()
          .findProdDeploymentJob(jobs, "123455", ["name1", "name2"]);
        
      expect(filteredJob.name).toBe("name1");

    });

    test("should return the run that was created last, if there are multiple with the same name", () => {
      const firstJobRun = someGitlabJob();
      firstJobRun.name = "job-name";
      firstJobRun.created_at = "2019-11-08T17:12:24.655Z";
      const laterJobRun = someGitlabJob();
      laterJobRun.name = "job-name";
      laterJobRun.created_at = "2019-11-08T17:15:24.655Z";
      const jobs = [
        firstJobRun, laterJobRun
      ];
      const filteredJob = createApi()
          .findProdDeploymentJob(jobs, "123455", ["job-name"]);
        
      expect(filteredJob.created_at).toBe(laterJobRun.created_at);

    });

    test("should ignore jobs that are not finished", () => {
      
      const unfinishedJobRun = someGitlabJob();
      unfinishedJobRun.name = "job-name";
      unfinishedJobRun.finished_at = null;
      const jobs = [
        unfinishedJobRun
      ];
      const filteredJob = createApi()
          .findProdDeploymentJob(jobs, "123455", ["job-name"]);
        
      expect(filteredJob).toBeUndefined();
    });

    test("should ignore jobs among multiple candidates that are not finished", () => {
      
      const unfinishedJobRun1 = someGitlabJob();
      unfinishedJobRun1.name = "job-name";
      unfinishedJobRun1.finished_at = null;

      const unfinishedJobRun2 = someGitlabJob();
      unfinishedJobRun2.name = "job-name";
      unfinishedJobRun2.finished_at = null;
      const jobs = [
        unfinishedJobRun1, unfinishedJobRun2
      ];
      const filteredJob = createApi()
          .findProdDeploymentJob(jobs, "123455", ["job-name"]);
        
      expect(filteredJob).toBeUndefined();
    });
  });
});


