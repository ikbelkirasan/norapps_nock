import axios from "axios";
import nock from "./";

const makeRequest = async () => {
  const response = await axios.post(
    "http://example.com/foo?a=b",
    {
      foo: "bar",
    },
    {
      headers: {
        "X-API-KEY": "wrong",
      },
    }
  );
  return response.data;
};

describe("Nock Utils", () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  it("should just work", async () => {
    nock("http://example.com")
      .post("/foo", { foo: "bar1" })
      .matchHeader("X-API-KEY", "secret")
      .query({
        a: "b",
      })
      .reply(200, {
        status: "success",
      });

    nock("http://example.com").post("/bar", { foo: "bar1" }).reply(200, {
      status: "success",
    });

    await nock.runInContext(async () => {
      const response = await makeRequest();
      expect(response).toEqual({
        status: "success",
      });
    });
  });
});
