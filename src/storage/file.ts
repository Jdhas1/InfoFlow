/**
 * The saved-file format (`.ifm.json`): checking, upgrading and writing it.
 *
 * Versions:
 * - "4.0.0"        current (beta 1 onwards).
 * - "4.0.0-draft"  written by the v3 prototype. Same shape; upgraded by setting the version.
 * - (missing)      very early v2 browser data with the same lists; treated like the draft.
 */
import { z } from "zod";
import { SCHEMA_VERSION } from "../model/types";
import type { IfmMap } from "../model/types";
import { slug } from "../model/text";
import { uid } from "../model/map";
import { CHANNELS, METHODS, VERBS } from "../model/vocab";

export const FILE_EXTENSION = ".ifm.json";
const KNOWN_OLD_VERSIONS = ["4.0.0-draft"];

const id = z.string().min(1);
const ref = id.nullable().optional().transform((v) => v ?? null);
const ids = z.array(id).optional().transform((v) => v ?? []);
const text = z.string().optional().transform((v) => v ?? "");
const method = z.enum(METHODS.map((m) => m.k) as [string, ...string[]]).nullable().optional().transform((v) => v ?? null);

const StepSchema = z.object({ id, name: text, order: z.number().finite() });
const PerformerSchema = z.object({ id, name: text, kind: z.enum(["role", "external", "software"]).catch("role") });
const ContainerSchema = z.object({
  id,
  name: text,
  medium: z.string().nullable().optional().transform((v) => v || null),
  ownerId: ref,
  fields: ids,
  contents: z.enum(["listed", "pending", "unknown"]).optional(),
  contentsNote: z.string().optional(),
  parentId: id.nullable().optional(),
  preexisting: z.boolean().optional(),
  preexistingNote: z.string().optional(),
});
const InformationSchema = z.object({ id, name: text });
const ActionSchema = z.object({
  id,
  stepId: ref,
  who: ref,
  verb: z.enum(VERBS.map((v) => v.k) as [string, ...string[]]),
  method,
  items: z.array(z.object({ info: id, method })).optional().transform((v) => v ?? []),
  objects: ids,
  from: ids,
  to: ids,
  toWho: ref,
  fromWho: ref,
  onFail: z.string().nullable().optional(),
  confirmed: z.boolean().optional().transform((v) => v ?? true),
  toldBy: z.string().nullable().optional().transform((v) => v || null),
  channel: z.enum(CHANNELS as unknown as [string, ...string[]]).nullable().optional().catch(null).transform((v) => v ?? null),
  at: z.string().optional().transform((v) => v || new Date(0).toISOString()),
});
const MapSchema = z.object({
  schemaVersion: z.string().optional(),
  mapId: z.string().optional(),
  title: z.string().optional().transform((v) => v ?? ""),
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
  steps: z.array(StepSchema),
  performers: z.array(PerformerSchema),
  containers: z.array(ContainerSchema),
  information: z.array(InformationSchema),
  actions: z.array(ActionSchema),
});

export type ReadResult =
  | { ok: true; map: IfmMap; warnings: string[]; upgradedFrom: string | null }
  | { ok: false; error: string };

const LIST_NAMES: Record<string, string> = {
  steps: "step", performers: "person or system", containers: "container", information: "information item", actions: "action",
};

/** Turn a technical validation problem into a sentence a person can act on. */
function describeIssue(issue: z.core.$ZodIssue): string {
  const [list, index, field] = issue.path;
  if (typeof list === "string" && typeof index === "number" && LIST_NAMES[list]) {
    const what = `${LIST_NAMES[list]} ${index + 1}`;
    if (field === "verb") return `${what} has an action type this version doesn't know.`;
    if (field === "id") return `${what} is missing its id.`;
    return `${what} has a damaged "${String(field ?? "entry")}" value.`;
  }
  if (typeof list === "string" && LIST_NAMES[list]) return `its list of ${list} is damaged.`;
  return "part of it is damaged.";
}

/**
 * Check and upgrade a map from parsed JSON. Never throws.
 * Broken links between items (e.g. an action pointing at a deleted step) are repaired and reported as warnings.
 */
export function readMap(raw: unknown): ReadResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "That file isn't an InfoFlow map." };
  const r = raw as Record<string, unknown>;

  const version = typeof r.schemaVersion === "string" ? r.schemaVersion : null;
  if (version && version !== SCHEMA_VERSION && !KNOWN_OLD_VERSIONS.includes(version)) {
    const major = Number.parseInt(version, 10);
    if (Number.isFinite(major) && major > 4) return { ok: false, error: `That map was saved by a newer version of InfoFlow (format ${version}). Please use the latest version to open it.` };
    return { ok: false, error: `That file uses map format ${version}, which this version can't open.` };
  }
  for (const k of ["steps", "performers", "containers", "information", "actions"]) {
    if (!Array.isArray(r[k])) return { ok: false, error: `That file has no ${k}. It may be from the older intake model, or not an InfoFlow map.` };
  }

  const parsed = MapSchema.safeParse(r);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `That map file looks damaged: ${first ? describeIssue(first) : "part of it is damaged."}` };
  }
  const p = parsed.data;
  const warnings: string[] = [];

  // Ids must be unique within each list.
  for (const k of ["steps", "performers", "containers", "information", "actions"] as const) {
    const seen = new Set<string>();
    for (const x of p[k]) {
      if (seen.has(x.id)) return { ok: false, error: `That map file looks damaged: two ${k} share the id "${x.id}".` };
      seen.add(x.id);
    }
  }

  const now = new Date().toISOString();
  const map = {
    schemaVersion: SCHEMA_VERSION,
    mapId: p.mapId || uid("map"),
    title: p.title,
    createdAt: p.createdAt || now,
    modifiedAt: p.modifiedAt || p.createdAt || now,
    steps: p.steps,
    performers: p.performers,
    containers: p.containers,
    information: p.information,
    actions: p.actions,
  } as IfmMap;

  warnings.push(...repairLinks(map));
  return { ok: true, map, warnings, upgradedFrom: version === SCHEMA_VERSION ? null : (version ?? "an early version") };
}

/** Fix references to things that don't exist. Returns plain-language notes of what changed. */
export function repairLinks(m: IfmMap): string[] {
  const notes: string[] = [];
  const S = new Set(m.steps.map((x) => x.id));
  const P = new Set(m.performers.map((x) => x.id));
  const C = new Set(m.containers.map((x) => x.id));
  const I = new Set(m.information.map((x) => x.id));
  let noStep = 0, people = 0, conts = 0, infos = 0;

  for (const a of m.actions) {
    if (a.stepId && !S.has(a.stepId)) { a.stepId = null; noStep++; }
    for (const k of ["who", "toWho", "fromWho"] as const) if (a[k] && !P.has(a[k]!)) { a[k] = null; people++; }
    for (const k of ["objects", "from", "to"] as const) {
      const before = a[k].length;
      a[k] = a[k].filter((c) => C.has(c));
      conts += before - a[k].length;
    }
    const before = a.items.length;
    a.items = a.items.filter((i) => I.has(i.info));
    infos += before - a.items.length;
  }
  for (const c of m.containers) {
    if (c.ownerId && !P.has(c.ownerId)) { c.ownerId = null; people++; }
    if (c.parentId && !C.has(c.parentId)) { c.parentId = null; conts++; }
    const before = c.fields.length;
    c.fields = c.fields.filter((f, i, arr) => I.has(f) && arr.indexOf(f) === i);
    infos += before - c.fields.length;
  }
  // Break any nesting loops (A inside B inside A).
  for (const c of m.containers) {
    let p = c.parentId ? m.containers.find((x) => x.id === c.parentId) : undefined;
    let guard = 0;
    while (p && guard++ < 1000) {
      if (p.id === c.id) { c.parentId = null; conts++; break; }
      const pid = p.parentId;
      p = pid ? m.containers.find((x) => x.id === pid) : undefined;
    }
  }
  const sorted = m.steps.slice().sort((a, b) => a.order - b.order);
  sorted.forEach((s, i) => { s.order = i; });

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (noStep) notes.push(`${plural(noStep, "action pointed", "actions pointed")} at a step that no longer exists, so ${noStep === 1 ? "it was" : "they were"} moved to "No step".`);
  if (people) notes.push(`${plural(people, "link", "links")} to a person or system that no longer exists ${people === 1 ? "was" : "were"} cleared.`);
  if (conts) notes.push(`${plural(conts, "link", "links")} to a container that no longer exists ${conts === 1 ? "was" : "were"} removed.`);
  if (infos) notes.push(`${plural(infos, "link", "links")} to information that no longer exists ${infos === 1 ? "was" : "were"} removed.`);
  return notes;
}

/** Read the text of a chosen file. */
export function readMapText(textContent: string): ReadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(textContent);
  } catch {
    return { ok: false, error: "That file isn't an InfoFlow map (it can't be read as JSON)." };
  }
  return readMap(raw);
}

/** The text written to a `.ifm.json` file. */
export function serializeMap(m: IfmMap): string {
  return JSON.stringify({ ...m, schemaVersion: SCHEMA_VERSION }, null, 2);
}

export function fileNameFor(m: Pick<IfmMap, "title">): string {
  return slug(m.title) + FILE_EXTENSION;
}
