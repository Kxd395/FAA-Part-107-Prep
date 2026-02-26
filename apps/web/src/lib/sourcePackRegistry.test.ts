import { describe, expect, it } from "vitest";
import { getSourcePackByProfile, SOURCE_PACK_REGISTRY } from "./sourcePackRegistry";

describe("sourcePackRegistry", () => {
  it("defines unique profiles for all registry entries", () => {
    const profiles = SOURCE_PACK_REGISTRY.map((entry) => entry.profile);
    expect(new Set(profiles).size).toBe(profiles.length);
  });

  it("supports profile lookups", () => {
    expect(getSourcePackByProfile("part107_bank")?.id).toBe("part107");
    expect(getSourcePackByProfile("carrington_strict")?.id).toBe("carrington_strict");
    expect(getSourcePackByProfile("carrington_bank")).toBeNull();
    expect(getSourcePackByProfile("confirmed_test")).toBeNull();
  });
});
