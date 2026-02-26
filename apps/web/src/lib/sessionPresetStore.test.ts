import {
  applySessionPresetTemplate,
  createSessionPresetTemplate,
  deleteSessionPresetTemplate,
  duplicateSessionPresetTemplate,
  readDefaultSessionPresetTemplateId,
  readExamSetupPresetSelection,
  readSessionPresetTemplates,
  readStudySetupPresetSelection,
  renameSessionPresetTemplate,
  writeDefaultSessionPresetTemplateId,
  writeExamSetupPresetSelection,
  writeStudySetupPresetSelection,
} from "./sessionPresetStore";
import { beforeEach, describe, expect, it } from "vitest";

describe("sessionPresetStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes and reads study setup presets using user-scoped key", () => {
    writeStudySetupPresetSelection("pilot-a", {
      lengthPresetId: "quick_10",
      timerPresetId: "10m",
    });

    const selection = readStudySetupPresetSelection("pilot-a");
    expect(selection).toEqual({
      lengthPresetId: "quick_10",
      timerPresetId: "10m",
    });
    expect(readStudySetupPresetSelection("pilot-b")).toBeNull();
  });

  it("writes and reads exam setup presets using user-scoped key", () => {
    writeExamSetupPresetSelection("pilot-a", {
      lengthPresetId: "half",
      timerPresetId: "30m",
    });

    const selection = readExamSetupPresetSelection("pilot-a");
    expect(selection).toEqual({
      lengthPresetId: "half",
      timerPresetId: "30m",
    });
    expect(readExamSetupPresetSelection("pilot-b")).toBeNull();
  });

  it("returns null for invalid JSON payload", () => {
    localStorage.setItem("part107_study_setup_v1:pilot-a", "{oops");
    expect(readStudySetupPresetSelection("pilot-a")).toBeNull();
  });

  it("creates and reads named session preset templates per user", () => {
    const template = createSessionPresetTemplate("pilot-a", "Weekend sprint", {
      study: { lengthPresetId: "focus_20", timerPresetId: "10m" },
      exam: { lengthPresetId: "quick", timerPresetId: "30m" },
    });
    expect(template).not.toBeNull();
    expect(template?.id).toBe("weekend-sprint");

    const templates = readSessionPresetTemplates("pilot-a");
    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe("Weekend sprint");
    expect(readSessionPresetTemplates("pilot-b")).toEqual([]);
  });

  it("applies a template to both study and exam setup presets", () => {
    const template = createSessionPresetTemplate("pilot-a", "Fast tune-up", {
      study: { lengthPresetId: "quick_10", timerPresetId: "5m" },
      exam: { lengthPresetId: "quick", timerPresetId: "15m" },
    });
    expect(template).not.toBeNull();

    const applied = applySessionPresetTemplate("pilot-a", template!.id);
    expect(applied?.id).toBe(template?.id);
    expect(readStudySetupPresetSelection("pilot-a")).toEqual({
      lengthPresetId: "quick_10",
      timerPresetId: "5m",
    });
    expect(readExamSetupPresetSelection("pilot-a")).toEqual({
      lengthPresetId: "quick",
      timerPresetId: "15m",
    });
  });

  it("stores and clears default template selection", () => {
    const template = createSessionPresetTemplate("pilot-a", "Default prep", {
      study: { lengthPresetId: "full", timerPresetId: "off" },
      exam: { lengthPresetId: "full", timerPresetId: "auto" },
    });
    expect(template).not.toBeNull();

    writeDefaultSessionPresetTemplateId("pilot-a", template!.id);
    expect(readDefaultSessionPresetTemplateId("pilot-a")).toBe(template!.id);

    writeDefaultSessionPresetTemplateId("pilot-a", null);
    expect(readDefaultSessionPresetTemplateId("pilot-a")).toBeNull();
  });

  it("renames an existing template", () => {
    const template = createSessionPresetTemplate("pilot-a", "Default prep", {
      study: { lengthPresetId: "full", timerPresetId: "off" },
      exam: { lengthPresetId: "full", timerPresetId: "auto" },
    });
    expect(template).not.toBeNull();

    const renamed = renameSessionPresetTemplate("pilot-a", template!.id, "Night Prep");
    expect(renamed?.name).toBe("Night Prep");
    expect(readSessionPresetTemplates("pilot-a")[0]?.name).toBe("Night Prep");
  });

  it("duplicates an existing template with copied settings", () => {
    const template = createSessionPresetTemplate("pilot-a", "Default prep", {
      study: { lengthPresetId: "focus_20", timerPresetId: "10m" },
      exam: { lengthPresetId: "half", timerPresetId: "30m" },
    });
    expect(template).not.toBeNull();

    const copy = duplicateSessionPresetTemplate("pilot-a", template!.id);
    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe(template?.id);
    expect(copy?.name).toContain("Copy");
    expect(copy?.study).toEqual(template?.study);
    expect(copy?.exam).toEqual(template?.exam);
    expect(readSessionPresetTemplates("pilot-a")).toHaveLength(2);
  });

  it("increments duplicate copy names when prior copies exist", () => {
    const template = createSessionPresetTemplate("pilot-a", "Default prep", {
      study: { lengthPresetId: "focus_20", timerPresetId: "10m" },
      exam: { lengthPresetId: "half", timerPresetId: "30m" },
    });
    expect(template).not.toBeNull();

    const firstCopy = duplicateSessionPresetTemplate("pilot-a", template!.id);
    const secondCopy = duplicateSessionPresetTemplate("pilot-a", template!.id);

    expect(firstCopy?.name).toBe("Default prep Copy");
    expect(secondCopy?.name).toBe("Default prep Copy 2");
  });

  it("removes default when template is deleted", () => {
    const template = createSessionPresetTemplate("pilot-a", "Delete me", {
      study: { lengthPresetId: "full", timerPresetId: "off" },
      exam: { lengthPresetId: "full", timerPresetId: "auto" },
    });
    expect(template).not.toBeNull();
    writeDefaultSessionPresetTemplateId("pilot-a", template!.id);

    expect(deleteSessionPresetTemplate("pilot-a", template!.id)).toBe(true);
    expect(readSessionPresetTemplates("pilot-a")).toEqual([]);
    expect(readDefaultSessionPresetTemplateId("pilot-a")).toBeNull();
  });
});
