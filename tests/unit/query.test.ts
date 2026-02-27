import { describe, expect, it } from "vitest";
import { parseWizardQuery } from "../../src/wizard/query";

describe("parseWizardQuery tracker modes", () => {
  it("defaults to tracker mode default", () => {
    expect(parseWizardQuery("").trackerMode).toBe("default");
  });

  it("parses tracker=local", () => {
    expect(parseWizardQuery("?tracker=local").trackerMode).toBe("local");
  });

  it("parses tracker=remote", () => {
    expect(parseWizardQuery("?tracker=remote").trackerMode).toBe("remote");
  });

  it("parses tracker=off", () => {
    expect(parseWizardQuery("?tracker=off").trackerMode).toBe("off");
  });

  it("parses tracker=mockfail", () => {
    expect(parseWizardQuery("?tracker=mockfail").trackerMode).toBe("mockfail");
  });
});
