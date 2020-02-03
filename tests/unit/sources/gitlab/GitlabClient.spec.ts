import moment from "moment";

import { Gitlab, Pipelines } from "gitlab";
import { GitlabClient, GitlabConfig } from "../../../../src/services/sources/gitlab/GitlabClient";

jest.mock("gitlab");

describe("GitlabClient.loadData", () => {
  let apiMock: Gitlab;
  let pipelinesApiMock: any = {};

  function resetMocks() {
    apiMock = new Gitlab();
    apiMock.Pipelines = new Pipelines();

    pipelinesApiMock = {
      all: jest.fn()
    };
    apiMock.Pipelines.all = pipelinesApiMock.all;
  }

  beforeEach(() => {
    resetMocks();
  });

  test("should return a result", () => {
  // TODO: Rewrite the return value here, is still in "jobs" format
    pipelinesApiMock.all.mockResolvedValue([
      {
        id: 222222,
        status: "failed",
        stage: "stage-name",
        name: "job-name",
        finished_at: "2019-12-09T16:00:43.957Z",
        commit: {
          id: "ac088916fa689f062df439da841c0ffe5e6a9fbe",
          short_id: "ac088916f",
          title: "My commit message",
          created_at: "2019-12-09T15:59:42.000Z",
          author_name: "First Last",
        }
      }
    ]);
    return new GitlabClient(apiMock, new GitlabConfig("someUrl", 1234, "the-project"))
      .loadJobs()
      .then(result => {
        expect(result).toBeDefined();
        
      });
  });
});
