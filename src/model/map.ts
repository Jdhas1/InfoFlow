/**
 * Creating maps and the basic operations on them.
 *
 * Convention: functions named like verbs (ensure, nest, merge, addStep...) change the map passed in.
 * The UI clones the map first (see `updateMap`) so React sees a new object.
 */
import { SCHEMA_VERSION } from "./types";
import type { Action, Container, ContentsStatus, IfmMap, Information, Performer, PerformerKind, Step } from "./types";
import { ci, clean } from "./text";

/* ---------- ids ---------- */

let seq = 0;
/** A new id that is unique within this browser session, e.g. "act_lq2x9k3". */
export function uid(prefix: string): string {
  seq++;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

/* ---------- making maps ---------- */

export function emptyMap(title = "", now: Date = new Date()): IfmMap {
  const ts = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    mapId: uid("map"),
    title,
    createdAt: ts,
    modifiedAt: ts,
    steps: [],
    performers: [],
    containers: [],
    information: [],
    actions: [],
  };
}

/** A new map with the given step names, e.g. from a template. */
export function mapFromSteps(names: readonly string[], title = ""): IfmMap {
  const m = emptyMap(title);
  names.forEach((n, i) => m.steps.push({ id: uid("step"), name: n, order: i }));
  return m;
}

/** Copy a map, mark it changed, and apply a change to the copy. */
export function updateMap(m: IfmMap, fn: (draft: IfmMap) => void, now: Date = new Date()): IfmMap {
  const copy = structuredClone(m);
  fn(copy);
  copy.modifiedAt = now.toISOString();
  return copy;
}

/* ---------- lookups ---------- */

export function ordered(m: IfmMap): Step[] {
  return m.steps.slice().sort((a, b) => a.order - b.order);
}

export function renumber(m: IfmMap): void {
  ordered(m).forEach((s, i) => {
    s.order = i;
  });
}

export function byId<T extends { id: string }>(list: readonly T[], id: string | null | undefined): T | null {
  if (!id) return null;
  return list.find((x) => x.id === id) ?? null;
}

export function byName<T extends { name: string }>(list: readonly T[], name: string): T | null {
  const key = ci(name);
  return list.find((x) => ci(x.name) === key) ?? null;
}

export function stepIdx(m: IfmMap, id: string | null | undefined): number {
  return ordered(m).findIndex((s) => s.id === id);
}

export function stepName(m: IfmMap, id: string | null | undefined): string {
  return byId(m.steps, id)?.name ?? "No step";
}

/** "listed" if it has fields and nobody said otherwise; "unknown" if empty and never asked. */
export function cStatus(c: Container): ContentsStatus {
  return c.contents ?? (c.fields.length ? "listed" : "unknown");
}

/* ---------- find-or-create by name ---------- */

export function ensurePerformer(m: IfmMap, name: string, kind: PerformerKind): Performer | null {
  const n = clean(name);
  if (!n) return null;
  let p = byName(m.performers, n);
  if (!p) {
    p = { id: uid("per"), name: n, kind };
    m.performers.push(p);
  }
  return p;
}

export function ensureContainer(m: IfmMap, name: string): Container | null {
  const n = clean(name);
  if (!n) return null;
  let c = byName(m.containers, n);
  if (!c) {
    c = { id: uid("con"), name: n, medium: null, ownerId: null, fields: [] };
    m.containers.push(c);
  }
  return c;
}

export function ensureInfo(m: IfmMap, name: string): Information | null {
  const n = clean(name);
  if (!n) return null;
  let i = byName(m.information, n);
  if (!i) {
    i = { id: uid("inf"), name: n };
    m.information.push(i);
  }
  return i;
}

/* ---------- steps ---------- */

export function addStep(m: IfmMap, name: string): Step | null {
  const n = clean(name);
  if (!n) return null;
  const s: Step = { id: uid("step"), name: n, order: m.steps.length };
  m.steps.push(s);
  renumber(m);
  return s;
}

/** Swap a step with its neighbour. dir -1 = earlier, +1 = later. */
export function moveStep(m: IfmMap, stepId: string, dir: -1 | 1): void {
  const list = ordered(m);
  const i = list.findIndex((s) => s.id === stepId);
  const other = list[i + dir];
  const self = list[i];
  if (!self || !other) return;
  const o = other.order;
  other.order = self.order;
  self.order = o;
  renumber(m);
}

/** Remove a step. Its actions are kept and move to "No step". */
export function removeStep(m: IfmMap, stepId: string): void {
  m.actions.forEach((a) => {
    if (a.stepId === stepId) a.stepId = null;
  });
  m.steps = m.steps.filter((s) => s.id !== stepId);
  renumber(m);
}

/* ---------- containers ---------- */

/**
 * Put container `c` inside container `parentId` (or take it out with null).
 * Returns false, and changes nothing, if that would make a loop (A inside B inside A).
 */
export function nest(m: IfmMap, c: Container | null, parentId: string | null): boolean {
  if (!c) return false;
  if (!parentId) {
    c.parentId = null;
    return true;
  }
  let p = byId(m.containers, parentId);
  let guard = 0;
  while (p && guard++ < 1000) {
    if (p.id === c.id) return false;
    p = byId(m.containers, p.parentId);
  }
  c.parentId = parentId;
  return true;
}

/**
 * Put one or more containers (comma, semicolon or line separated) inside a parent.
 * Returns a plain-language error, or "" if all went in.
 */
export function addSubContainers(m: IfmMap, parentName: string, text: string): string {
  const names = String(text).split(/[,;\n]/).map(clean).filter(Boolean);
  if (!names.length) return "";
  const p = ensureContainer(m, parentName);
  if (!p) return "";
  let err = "";
  for (const n of names) {
    if (ci(n) === ci(p.name)) {
      err = "A container can't hold itself.";
      continue;
    }
    const k = ensureContainer(m, n);
    if (nest(m, k, p.id) === false && k) err = `${k.name} already holds ${p.name}, so it can't also sit inside it.`;
  }
  return err;
}

/**
 * Add information to a container's list (comma, semicolon or line separated).
 * A name that matches an existing container (and no information) is nested instead.
 */
export function addFieldsToContainer(m: IfmMap, containerName: string, text: string): void {
  const parts = String(text).split(/[,;\n]/).map(clean).filter(Boolean);
  if (!parts.length) return;
  const cc = ensureContainer(m, containerName);
  if (!cc) return;
  for (const t of parts) {
    const asC = byName(m.containers, t);
    if (asC && !byName(m.information, t)) {
      if (asC !== cc) nest(m, asC, cc.id);
      continue;
    }
    const i = ensureInfo(m, t);
    if (i && !cc.fields.includes(i.id)) cc.fields.push(i.id);
  }
  if (cStatus(cc) === "unknown") cc.contents = "listed";
}

export function deleteContainer(m: IfmMap, containerId: string): void {
  m.containers = m.containers.filter((c) => c.id !== containerId);
  m.containers.forEach((c) => {
    if (c.parentId === containerId) c.parentId = null;
  });
  m.actions.forEach((a) => {
    a.objects = a.objects.filter((x) => x !== containerId);
    a.from = a.from.filter((x) => x !== containerId);
    a.to = a.to.filter((x) => x !== containerId);
  });
}

/* ---------- merging and deleting ---------- */

export type ListKey = "information" | "containers" | "performers";

const uniq = <T,>(arr: T[]): T[] => arr.filter((x, i) => arr.indexOf(x) === i);

/** Merge `dropId` into `keepId`: every reference is repointed, then `dropId` is removed. */
export function merge(m: IfmMap, listKey: ListKey, dropId: string, keepId: string): void {
  if (dropId === keepId) return;
  m.actions.forEach((a) => {
    if (listKey === "information") {
      a.items.forEach((i) => {
        if (i.info === dropId) i.info = keepId;
      });
      const seen = new Set<string>();
      a.items = a.items.filter((i) => (seen.has(i.info) ? false : (seen.add(i.info), true)));
    } else if (listKey === "containers") {
      a.from = uniq(a.from.map((c) => (c === dropId ? keepId : c)));
      a.to = uniq(a.to.map((c) => (c === dropId ? keepId : c)));
      a.objects = uniq(a.objects.map((c) => (c === dropId ? keepId : c)));
    } else {
      if (a.who === dropId) a.who = keepId;
      if (a.toWho === dropId) a.toWho = keepId;
      if (a.fromWho === dropId) a.fromWho = keepId;
    }
  });
  if (listKey === "information") {
    m.containers.forEach((c) => {
      c.fields = uniq(c.fields.map((f) => (f === dropId ? keepId : f)));
    });
  }
  if (listKey === "containers") {
    const keep = byId(m.containers, keepId);
    const drop = byId(m.containers, dropId);
    if (keep && drop) keep.fields = uniq(keep.fields.concat(drop.fields));
    m.containers.forEach((c) => {
      if (c.parentId === dropId) c.parentId = c.id === keepId ? null : keepId;
    });
  }
  if (listKey === "performers") {
    m.containers.forEach((c) => {
      if (c.ownerId === dropId) c.ownerId = keepId;
    });
  }
  if (listKey === "information") m.information = m.information.filter((x) => x.id !== dropId);
  if (listKey === "containers") m.containers = m.containers.filter((x) => x.id !== dropId);
  if (listKey === "performers") m.performers = m.performers.filter((x) => x.id !== dropId);
}

/** Delete a performer and blank out every reference to them. */
export function deletePerformer(m: IfmMap, performerId: string): void {
  m.actions.forEach((a) => {
    if (a.who === performerId) a.who = null;
    if (a.toWho === performerId) a.toWho = null;
    if (a.fromWho === performerId) a.fromWho = null;
  });
  m.containers.forEach((c) => {
    if (c.ownerId === performerId) c.ownerId = null;
  });
  m.performers = m.performers.filter((x) => x.id !== performerId);
}

/** How many actions mention a performer, and how many containers they own. */
export function performerUse(m: IfmMap, performerId: string): { actions: number; owns: number } {
  return {
    actions: m.actions.filter((a) => a.who === performerId || a.toWho === performerId || a.fromWho === performerId).length,
    owns: m.containers.filter((c) => c.ownerId === performerId).length,
  };
}

/* ---------- actions ---------- */

export function actionsAt(m: IfmMap, stepId: string | null): Action[] {
  return m.actions.filter((a) => (a.stepId ?? null) === stepId);
}

/** Swap an action with the previous/next action at the same step. */
export function moveAction(m: IfmMap, actionId: string, dir: -1 | 1): void {
  const a = byId(m.actions, actionId);
  if (!a) return;
  const here = actionsAt(m, a.stepId);
  const other = here[here.indexOf(a) + dir];
  if (!other) return;
  const x = m.actions.indexOf(a);
  const y = m.actions.indexOf(other);
  m.actions[x] = other;
  m.actions[y] = a;
}

export function deleteAction(m: IfmMap, actionId: string): void {
  m.actions = m.actions.filter((a) => a.id !== actionId);
}
