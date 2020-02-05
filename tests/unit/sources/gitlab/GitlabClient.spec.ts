import { Gitlab, Pipelines, Commits } from "gitlab";
import { GitlabClient, GitlabConfig } from "../../../../src/services/sources/gitlab/GitlabClient";
import moment = require('moment');

jest.mock("gitlab");

describe("GitlabClient", () => {
  let apiMock: Gitlab;
  let pipelinesApiMock: any = {};
  let commitsApiMock: any = {};

  function resetMocks() {
    apiMock = new Gitlab();
    apiMock.Pipelines = new Pipelines();
    apiMock.Commits = new Commits();

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
  }

  beforeEach(() => {
    resetMocks();
  });

  function createApi() {
    return new GitlabClient(apiMock, new GitlabConfig("someUrl", 1111, "the-project"));
  }

  function someJob() : any {
    return {
      "id": 1487964,
      "status": "success",
      "name": "some_job_name",
      "ref": "master",
      "created_at": "2019-11-08T17:12:24.655Z"
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

      const actualDeploymentJobs = await createApi().loadJobs(1111, {
        since: moment(),
        until: moment(),
        branch: "master",
        prodDeploymentJobNames: [deploymentJob.name]
      });

      expect(actualDeploymentJobs.length).toBe(2);

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
        
      console.log(`filtered ${JSON.stringify(filteredJob)}`)
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
        
      console.log(`filtered ${JSON.stringify(filteredJob)}`)
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
        
      console.log(`filtered ${JSON.stringify(filteredJob)}`)
      expect(filteredJob.created_at).toBe(laterJobRun.created_at);

    });
  });

  
});


