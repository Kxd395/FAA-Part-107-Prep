import { userScopedStorageKey } from "./progressStorage";

export const STUDY_SETUP_PRESET_STORAGE_KEY = "part107_study_setup_v1";
export const EXAM_SETUP_PRESET_STORAGE_KEY = "part107_exam_setup_v1";
export const SESSION_PRESET_TEMPLATES_STORAGE_KEY = "part107_session_preset_templates_v1";
export const DEFAULT_SESSION_PRESET_TEMPLATE_STORAGE_KEY =
  "part107_default_session_preset_template_v1";

const MAX_TEMPLATE_COUNT = 20;
const MAX_TEMPLATE_NAME_LENGTH = 40;

export interface SetupPresetSelection {
  lengthPresetId: string;
  timerPresetId: string;
}

export interface SessionPresetTemplate {
  id: string;
  name: string;
  study: SetupPresetSelection;
  exam: SetupPresetSelection;
  updatedAt: string;
}

function safeParseSelection(raw: string | null): SetupPresetSelection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SetupPresetSelection> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.lengthPresetId !== "string" || typeof parsed.timerPresetId !== "string") {
      return null;
    }
    return {
      lengthPresetId: parsed.lengthPresetId,
      timerPresetId: parsed.timerPresetId,
    };
  } catch {
    return null;
  }
}

function safeParseTemplates(raw: string | null): SessionPresetTemplate[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((template) => normalizeTemplate(template))
      .filter((template): template is SessionPresetTemplate => !!template)
      .slice(0, MAX_TEMPLATE_COUNT);
  } catch {
    return [];
  }
}

function normalizeTemplateName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return null;
  return normalized.slice(0, MAX_TEMPLATE_NAME_LENGTH).trim();
}

function normalizeTemplateId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

function normalizeTemplate(input: unknown): SessionPresetTemplate | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<SessionPresetTemplate>;
  const id = normalizeTemplateId(candidate.id);
  const name = normalizeTemplateName(candidate.name);
  const study = safeParseSelection(JSON.stringify(candidate.study ?? null));
  const exam = safeParseSelection(JSON.stringify(candidate.exam ?? null));
  if (!id || !name || !study || !exam) return null;
  return {
    id,
    name,
    study,
    exam,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim().length > 0
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

function readSelection(baseKey: string, userId: string): SetupPresetSelection | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(userScopedStorageKey(baseKey, userId));
  return safeParseSelection(raw);
}

function writeSelection(baseKey: string, userId: string, selection: SetupPresetSelection): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(userScopedStorageKey(baseKey, userId), JSON.stringify(selection));
}

function readTemplates(userId: string): SessionPresetTemplate[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(userScopedStorageKey(SESSION_PRESET_TEMPLATES_STORAGE_KEY, userId));
  return safeParseTemplates(raw);
}

function writeTemplates(userId: string, templates: SessionPresetTemplate[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    userScopedStorageKey(SESSION_PRESET_TEMPLATES_STORAGE_KEY, userId),
    JSON.stringify(templates.slice(0, MAX_TEMPLATE_COUNT))
  );
}

function nextTemplateId(existing: SessionPresetTemplate[], name: string): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "template";
  const usedIds = new Set(existing.map((template) => template.id));
  let nextId = base;
  let suffix = 2;
  while (usedIds.has(nextId)) {
    nextId = `${base}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

function normalizeTemplateNameForComparison(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function nextTemplateCopyName(existing: SessionPresetTemplate[], sourceName: string): string {
  const baseName = normalizeTemplateName(sourceName) ?? "Template";
  const usedNames = new Set(existing.map((template) => normalizeTemplateNameForComparison(template.name)));
  const initial = `${baseName} Copy`;
  if (!usedNames.has(normalizeTemplateNameForComparison(initial))) {
    return initial;
  }

  let suffix = 2;
  let next = `${baseName} Copy ${suffix}`;
  while (usedNames.has(normalizeTemplateNameForComparison(next))) {
    suffix += 1;
    next = `${baseName} Copy ${suffix}`;
  }
  return next;
}

export function readStudySetupPresetSelection(userId: string): SetupPresetSelection | null {
  return readSelection(STUDY_SETUP_PRESET_STORAGE_KEY, userId);
}

export function writeStudySetupPresetSelection(
  userId: string,
  selection: SetupPresetSelection
): void {
  writeSelection(STUDY_SETUP_PRESET_STORAGE_KEY, userId, selection);
}

export function readExamSetupPresetSelection(userId: string): SetupPresetSelection | null {
  return readSelection(EXAM_SETUP_PRESET_STORAGE_KEY, userId);
}

export function writeExamSetupPresetSelection(
  userId: string,
  selection: SetupPresetSelection
): void {
  writeSelection(EXAM_SETUP_PRESET_STORAGE_KEY, userId, selection);
}

export function readSessionPresetTemplates(userId: string): SessionPresetTemplate[] {
  return readTemplates(userId);
}

export function createSessionPresetTemplate(
  userId: string,
  name: string,
  presets: { study: SetupPresetSelection; exam: SetupPresetSelection }
): SessionPresetTemplate | null {
  const normalizedName = normalizeTemplateName(name);
  if (!normalizedName) return null;

  const templates = readTemplates(userId);
  const nowIso = new Date().toISOString();
  const template: SessionPresetTemplate = {
    id: nextTemplateId(templates, normalizedName),
    name: normalizedName,
    study: presets.study,
    exam: presets.exam,
    updatedAt: nowIso,
  };
  writeTemplates(userId, [template, ...templates]);
  return template;
}

export function renameSessionPresetTemplate(
  userId: string,
  templateId: string,
  nextName: string
): SessionPresetTemplate | null {
  const normalizedTemplateId = normalizeTemplateId(templateId);
  const normalizedName = normalizeTemplateName(nextName);
  if (!normalizedTemplateId || !normalizedName) return null;
  const templates = readTemplates(userId);
  const index = templates.findIndex((template) => template.id === normalizedTemplateId);
  if (index < 0) return null;

  const renamed: SessionPresetTemplate = {
    ...templates[index],
    name: normalizedName,
    updatedAt: new Date().toISOString(),
  };
  const next = [...templates];
  next[index] = renamed;
  writeTemplates(userId, next);
  return renamed;
}

export function duplicateSessionPresetTemplate(
  userId: string,
  templateId: string
): SessionPresetTemplate | null {
  const normalizedTemplateId = normalizeTemplateId(templateId);
  if (!normalizedTemplateId) return null;
  const templates = readTemplates(userId);
  const source = templates.find((template) => template.id === normalizedTemplateId);
  if (!source) return null;

  const copyName = nextTemplateCopyName(templates, source.name);
  const nowIso = new Date().toISOString();
  const copy: SessionPresetTemplate = {
    ...source,
    id: nextTemplateId(templates, copyName),
    name: normalizeTemplateName(copyName) ?? "Template Copy",
    updatedAt: nowIso,
  };
  writeTemplates(userId, [copy, ...templates]);
  return copy;
}

export function deleteSessionPresetTemplate(userId: string, templateId: string): boolean {
  const templates = readTemplates(userId);
  const normalizedTemplateId = normalizeTemplateId(templateId);
  if (!normalizedTemplateId) return false;
  const next = templates.filter((template) => template.id !== normalizedTemplateId);
  if (next.length === templates.length) return false;
  writeTemplates(userId, next);
  if (readDefaultSessionPresetTemplateId(userId) === normalizedTemplateId) {
    writeDefaultSessionPresetTemplateId(userId, null);
  }
  return true;
}

export function readDefaultSessionPresetTemplateId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(
    userScopedStorageKey(DEFAULT_SESSION_PRESET_TEMPLATE_STORAGE_KEY, userId)
  );
  const normalized = normalizeTemplateId(raw);
  if (!normalized) return null;
  return readTemplates(userId).some((template) => template.id === normalized) ? normalized : null;
}

export function writeDefaultSessionPresetTemplateId(
  userId: string,
  templateId: string | null
): void {
  if (typeof window === "undefined") return;
  const storageKey = userScopedStorageKey(DEFAULT_SESSION_PRESET_TEMPLATE_STORAGE_KEY, userId);
  if (!templateId) {
    localStorage.removeItem(storageKey);
    return;
  }
  const normalized = normalizeTemplateId(templateId);
  if (!normalized) {
    localStorage.removeItem(storageKey);
    return;
  }
  localStorage.setItem(storageKey, normalized);
}

export function applySessionPresetTemplate(
  userId: string,
  templateId: string
): SessionPresetTemplate | null {
  const normalizedTemplateId = normalizeTemplateId(templateId);
  if (!normalizedTemplateId) return null;
  const template =
    readTemplates(userId).find((candidate) => candidate.id === normalizedTemplateId) ?? null;
  if (!template) return null;
  writeStudySetupPresetSelection(userId, template.study);
  writeExamSetupPresetSelection(userId, template.exam);
  return template;
}
