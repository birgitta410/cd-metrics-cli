import { Gitlab, Pipelines, Commits, Branches } from "gitlab";
import { GitlabClient, GitlabConfig } from "../../src/GitlabClient";
import moment = require('moment');

jest.mock("gitlab");

describe("GitlabClient", () => {
  let apiMock: Gitlab;
  let pipelinesApiMock: any = {};
  let commitsApiMock: any = {};
  let branchesApiMock: any = {};

  const someProjectId = 1111;

  function resetMocks() {
    apiMock = new Gitlab();
    apiMock.Pipelines = new Pipelines();
    apiMock.Commits = new Commits();
    apiMock.Branches = new Branches();

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
  }

  beforeEach(() => {
    resetMocks();
  });

  function createApi() {
    return new GitlabClient(apiMock, new GitlabConfig("someUrl", someProjectId));
  }

  function someJob() : any {
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

  function somePipeline() : any {
    return {
      "id": 419002,
      "sha": "35aed3b9a",
      "ref": "master",
      "status": "success",
      "created_at": "2020-02-05T12:48:19.024Z"
    };
  }

  function someCommit() : any {
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

  function someBranch() : any {
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

  describe("loadJobs", () => {
    test("should ask for pipelines on branch and load their respective deployment jobs", async () => {
      const deploymentJob: any = someJob();
      deploymentJob.name = "the-deployment-job";
      const otherJob: any = someJob();
      otherJob.name = "some-job";
      pipelinesApiMock.all.mockResolvedValue([
        somePipeline(), somePipeline()
      ]);
      pipelinesApiMock.showJobs.mockResolvedValue([
        deploymentJob
      ]);

      const actualDeploymentJobs = await createApi().loadProductionDeployments({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: [deploymentJob.name]
      });

      expect(actualDeploymentJobs.length).toBe(2);
      expect(pipelinesApiMock.all).toHaveBeenCalledTimes(1);
      expect(pipelinesApiMock.showJobs).toHaveBeenCalledTimes(2);

    });

    test("should ask for pipelines on multiple branches if branch name is pattern", async () => {
      const deploymentJob: any = someJob();
      deploymentJob.name = "the-deployment-job";
      const otherJob: any = someJob();
      otherJob.name = "some-job";
      pipelinesApiMock.all.mockResolvedValue([
        somePipeline(), somePipeline()
      ]);
      pipelinesApiMock.showJobs.mockResolvedValue([
        deploymentJob
      ]);

      const branch1 = someBranch();
      branch1.name = "release/1.2"
      const branch2 = someBranch();
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
      expect(pipelinesApiMock.all).toHaveBeenCalledTimes(2);
      expect(branchesApiMock.all).toHaveBeenCalledWith(someProjectId, { search: "^release" });

    });

    test("should not crash if no deployment jobs can be found", async () => {
      const nonDeploymentJob: any = someJob();
      nonDeploymentJob.name = "some-job";
      pipelinesApiMock.all.mockResolvedValue([somePipeline()]);
      pipelinesApiMock.showJobs.mockResolvedValue([nonDeploymentJob]);

      const events = await createApi().loadProductionDeployments({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["deployment-job"]
      });

      expect(events.length).toBe(0);
    });
  });

  describe("loadCommits", () => {
    test("should get all commits for the specified branch", async () => {
      const commit = someCommit();
      commitsApiMock.all.mockResolvedValue([
        commit
      ]);

      const actualCommits = await createApi().loadCommits({
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: ["does-not-matter"]
      });

      expect(actualCommits.length).toBe(1);
      expect(actualCommits[0].short_id).toBe(commit.short_id);

    });

    test("should get unique commits for multiple branches if branch name is pattern", async () => {
      const commit1 = someCommit();
      commit1.short_id = "654321"
      const commit2 = someCommit();
      commit2.short_id = "123456"
      
      commitsApiMock.all
        .mockImplementationOnce(() => Promise.resolve([commit1, commit2]))
        .mockImplementationOnce(() => Promise.resolve([commit2]));

      const branch1 = someBranch();
      branch1.name = "release/1.2"
      const branch2 = someBranch();
      branch2.name = "release/1.3"
      branchesApiMock.all.mockResolvedValue([
        branch1, branch2
      ]);

      const actualCommits = await createApi().loadCommits({
        since: moment(),
        until: moment(),
        branch: "^release",
        prodDeploymentJobNames: ["does-not-matter"]
      });

      expect(actualCommits.length).toBe(2);

    });
  });

  describe("findProdDeploymentJobs", () => {
    test("should return job with the specified filter name", () => {
      const job1 = someJob();
      job1.name = "name1";
      const job2 = someJob();
      job2.name = "name2";
      const jobs = [
        job2, job1
      ];
      const filteredJob = createApi()
          .findProdDeploymentJob(jobs, "123455", ["name2"]);
        
      expect(filteredJob.name).toBe("name2");

    });

    test("should return job with the first mentioned name, if there are multiple name matches", () => {
      const job1 = someJob();
      job1.name = "name1";
      const job2 = someJob();
      job2.name = "name2";
      const jobs = [
        job2, job1
      ];
      const filteredJob = createApi()
          .findProdDeploymentJob(jobs, "123455", ["name1", "name2"]);
        
      expect(filteredJob.name).toBe("name1");

    });

    test("should return the run that was created last, if there are multiple with the same name", () => {
      const firstJobRun = someJob();
      firstJobRun.name = "job-name";
      firstJobRun.created_at = "2019-11-08T17:12:24.655Z";
      const laterJobRun = someJob();
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
      
      const unfinishedJobRun = someJob();
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
      
      const unfinishedJobRun1 = someJob();
      unfinishedJobRun1.name = "job-name";
      unfinishedJobRun1.finished_at = null;

      const unfinishedJobRun2 = someJob();
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


