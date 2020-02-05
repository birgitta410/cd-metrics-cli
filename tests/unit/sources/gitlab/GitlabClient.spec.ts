import { Gitlab, Pipelines, Commits } from "gitlab";
import { GitlabClient, GitlabConfig } from "../../../../src/services/sources/gitlab/GitlabClient";

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

    commitsApiMock = {
      all: jest.fn()
    };
    apiMock.Commits.all = commitsApiMock.all;
  }

  beforeEach(() => {
    resetMocks();
  });

  function createJob() : any {
    return {
      "id": 1487964,
      "status": "success",
      "name": "some_job_name",
      "ref": "master",
      "created_at": "2019-11-08T17:12:24.655Z"
    };
  }

  describe("findProdDeploymentJobs", () => {
    test("should return job with the specified filter name", () => {
      const job1 = createJob();
      job1.name = "name1";
      const job2 = createJob();
      job2.name = "name2";
      const jobs = [
        job2, job1
      ];
      const filteredJob = new GitlabClient(apiMock, new GitlabConfig("someUrl", 1111, "the-project"))
          .findProdDeploymentJob(jobs, "123455", ["name2"]);
        
      console.log(`filtered ${JSON.stringify(filteredJob)}`)
      expect(filteredJob.name).toBe("name2");

    });

    test("should return job with the first mentioned name, if there are multiple name matches", () => {
      const job1 = createJob();
      job1.name = "name1";
      const job2 = createJob();
      job2.name = "name2";
      const jobs = [
        job2, job1
      ];
      const filteredJob = new GitlabClient(apiMock, new GitlabConfig("someUrl", 1111, "the-project"))
          .findProdDeploymentJob(jobs, "123455", ["name1", "name2"]);
        
      console.log(`filtered ${JSON.stringify(filteredJob)}`)
      expect(filteredJob.name).toBe("name1");

    });

    test("should return the run that was created last, if there are multiple with the same name", () => {
      const firstJobRun = createJob();
      firstJobRun.name = "job-name";
      firstJobRun.created_at = "2019-11-08T17:12:24.655Z";
      const laterJobRun = createJob();
      laterJobRun.name = "job-name";
      laterJobRun.created_at = "2019-11-08T17:15:24.655Z";
      const jobs = [
        firstJobRun, laterJobRun
      ];
      const filteredJob = new GitlabClient(apiMock, new GitlabConfig("someUrl", 1111, "the-project"))
          .findProdDeploymentJob(jobs, "123455", ["job-name"]);
        
      console.log(`filtered ${JSON.stringify(filteredJob)}`)
      expect(filteredJob.created_at).toBe(laterJobRun.created_at);

    });
  });

  
});
