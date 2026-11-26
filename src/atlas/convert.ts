/**
 * Turn a captured map into the data the Atlas draws (see design/v3/SCHEMA.md).
 * Ported from atlasData() in the prototype, plus one approved change:
 * "Tell verbally" actions now draw a rust dotted line (method "verbal") into the listener's head.
 */
import { facts } from "../model/gaps";
import { byId, ordered, stepIdx } from "../model/map";
import { NOSTEP } from "../model/types";
import type { Action, IfmMap } from "../model/types";
import { WRITES } from "../model/vocab";

export interface AtlasMethod {
  id: string;
  label: string;
  style: "solid" | "dashed" | "dotted";
  risk: number;
  speed: number;
  manual?: boolean;
}

export interface AtlasStep {
  id: string;
  order: number;
  label: string;
}

export interface AtlasContainer {
  id: string;
  name: string;
  step: string;
  owner: string;
  system: string;
  category: string;
  /** Not touched by any action at any step yet. */
  unused: boolean;
  preexisting: boolean;
  /** For pre-existing containers: where it comes from. */
  origin: string | null;
  /** The container this one sits inside. */
  parent: string | null;
  /** Information ids this container is meant to hold. */
  fields: string[];
  /** A person's memory: where spoken information ends up. Only on nodes made for "Tell" actions. */
  memory?: boolean;
}

export interface AtlasInformation {
  id: string;
  name: string;
  category: string;
}

export interface AtlasTransfer {
  information: string;
  from: string;
  to: string;
  method: string;
}

export interface AtlasCheck {
  step: string | null;
  information: string[];
  against: string[];
  resultTo: string[];
  resultToWho: string | null;
  onFail: string | null;
}

export interface AtlasData {
  version: 1;
  name: string;
  steps: AtlasStep[];
  methods: AtlasMethod[];
  containers: AtlasContainer[];
  information: AtlasInformation[];
  transfers: AtlasTransfer[];
  checks: AtlasCheck[];
}

export const UNUSED_STEP = "__unused";
export const UNKNOWN_HEAD = "__head_unknown";
export const headId = (performerId: string | null): string => (performerId ? `__head_${performerId}` : UNKNOWN_HEAD);

/** How each kind of movement looks and how risky it is. */
export const ATLAS_METHODS: readonly AtlasMethod[] = [
  { id: "typed", label: "Typed by hand", style: "dashed", risk: 2.2, speed: 0.17 },
  { id: "paste", label: "Copy & paste", style: "dashed", risk: 1.8, speed: 0.22 },
  { id: "written", label: "Hand-written", style: "dashed", risk: 2.0, speed: 0.18 },
  { id: "scan", label: "Scanned / imported", style: "dashed", risk: 1.5, speed: 0.24 },
  { id: "auto", label: "Automatically", style: "solid", risk: 0.2, speed: 0.58 },
  { id: "calculate", label: "Calculated", style: "solid", risk: 0.6, speed: 0.45 },
  { id: "decide", label: "Decided", style: "solid", risk: 0.8, speed: 0.4 },
  { id: "measure", label: "Measured", style: "solid", risk: 0.5, speed: 0.45 },
  { id: "update", label: "Updated", style: "dashed", risk: 1.2, speed: 0.3 },
  { id: "verbal", label: "Told verbally", style: "dotted", risk: 3.4, speed: 0.1 },
  { id: "unknown", label: "Method not recorded", style: "dotted", risk: 3, speed: 0.1 },
];

function methodOf(a: Action): string {
  if (a.verb === "copy") return a.method || "unknown";
  if (a.verb === "tell") return "verbal";
  return a.verb;
}

export function atlasData(m: IfmMap): AtlasData {
  const F = facts(m);
  const steps = ordered(m);
  const byStep = (a: string, b: string) => stepIdx(m, a) - stepIdx(m, b);
  const firstStep = (cid: string): string | null =>
    [...(F.touched.get(cid) ?? [])].filter((s) => s !== NOSTEP && stepIdx(m, s) >= 0).sort(byStep)[0] ?? null;

  const transfers: AtlasTransfer[] = [];
  for (const a of m.actions) {
    if (!WRITES.has(a.verb) || !a.from.length || !a.to.length) continue;
    for (const it of a.items) for (const f of a.from) for (const t of a.to) if (f !== t) transfers.push({ information: it.info, from: f, to: t, method: methodOf(a) });
  }

  // Spoken information: from what they looked at (or from the speaker's own head) into the listener's head.
  const heads = new Map<string, { performerId: string | null; steps: Set<string>; fields: Set<string> }>();
  const head = (pid: string | null, stepId: string | null, infos: string[]) => {
    const id = headId(pid);
    if (!heads.has(id)) heads.set(id, { performerId: pid, steps: new Set(), fields: new Set() });
    const h = heads.get(id)!;
    if (stepId && stepIdx(m, stepId) >= 0) h.steps.add(stepId);
    infos.forEach((i) => h.fields.add(i));
    return id;
  };
  for (const a of m.actions) {
    if (a.verb !== "tell" || !a.items.length) continue;
    const infos = a.items.map((i) => i.info);
    const to = head(a.toWho, a.stepId, infos);
    const from = a.from.length ? a.from : [head(a.who, a.stepId, [])];
    for (const it of a.items) for (const f of from) if (f !== to) transfers.push({ information: it.info, from: f, to, method: "verbal" });
  }

  const containers: AtlasContainer[] = m.containers.map((c) => {
    // Owner: set on the container, else whoever most often receives it, fills it or files it.
    let o = byId(m.performers, c.ownerId);
    if (!o) {
      const tally = new Map<string, number>();
      for (const a of m.actions) {
        if (!a.who) continue;
        const w = a.to.includes(c.id) || a.objects.includes(c.id) ? 2 : a.from.includes(c.id) ? 1 : 0;
        if (w) tally.set(a.who, (tally.get(a.who) ?? 0) + w);
      }
      const best = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
      o = best ? byId(m.performers, best[0]) : null;
    }
    const sys = (c.medium || "Format not set") + (c.preexisting ? " · existing source" : "");
    const fs = firstStep(c.id);
    return {
      id: c.id, name: c.name, step: fs ?? UNUSED_STEP, unused: !fs, preexisting: !!c.preexisting,
      origin: c.preexistingNote || null, parent: c.parentId || null, owner: o ? o.name : "No owner recorded",
      system: sys, category: sys, fields: c.fields.slice(),
    };
  });
  heads.forEach((h, id) => {
    const p = byId(m.performers, h.performerId);
    const fs = [...h.steps].sort(byStep)[0] ?? null;
    containers.push({
      id, name: p ? `${p.name} (in their head)` : "Someone (not recorded)", step: fs ?? UNUSED_STEP, unused: !fs,
      preexisting: false, origin: null, parent: null, owner: p ? p.name : "No owner recorded",
      system: "In someone's head", category: "In someone's head", fields: [...h.fields], memory: true,
    });
  });

  const anyUnused = containers.some((c) => c.unused);
  return {
    version: 1,
    name: m.title || "Untitled map",
    steps: steps
      .map((s, i) => ({ id: s.id, order: i, label: s.name }))
      .concat(anyUnused ? [{ id: UNUSED_STEP, order: steps.length, label: "Not used in any step yet" }] : []),
    methods: ATLAS_METHODS.map((x) => ({ ...x })),
    containers,
    information: m.information.map((i) => ({ id: i.id, name: i.name, category: "Information" })),
    transfers,
    checks: m.actions.filter((a) => a.verb === "check").map((a) => ({
      step: a.stepId, information: a.items.map((i) => i.info), against: a.from.slice(), resultTo: a.to.slice(), resultToWho: a.toWho, onFail: a.onFail || null,
    })),
  };
}
