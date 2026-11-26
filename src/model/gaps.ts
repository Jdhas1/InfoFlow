/**
 * Gap detection: what's missing or suspicious in a map. Ported from facts() and gaps() in the prototype.
 * Results are plain data; the fix buttons are described by a `GapFix` that `applyFix` carries out.
 */
import { summary } from "./draft";
import { byId, cStatus, deleteContainer, merge, ordered, stepIdx, type ListKey } from "./map";
import { clean, similar } from "./text";
import { NOSTEP } from "./types";
import type { Action, IfmMap } from "./types";
import { VB, WRITES } from "./vocab";

/* ---------- facts: who writes, reads and touches what ---------- */

export interface Facts {
  /** "containerId|infoId" -> actions that write that information into that container. */
  writes: Map<string, Action[]>;
  reads: Map<string, Action[]>;
  /** containerId -> set of step ids (NOSTEP for none) where an action touches it. */
  touched: Map<string, Set<string>>;
  /** "containerId|infoId" for information carried when the whole container moves. */
  moved: Set<string>;
}

export const fkey = (c: string, i: string): string => `${c}|${i}`;

function push(map: Map<string, Action[]>, k: string, a: Action) {
  const l = map.get(k);
  if (l) l.push(a);
  else map.set(k, [a]);
}

export function facts(m: IfmMap): Facts {
  const f: Facts = { writes: new Map(), reads: new Map(), touched: new Map(), moved: new Set() };
  for (const a of m.actions) {
    if (VB[a.verb].group === "container") {
      for (const o of a.objects) {
        for (const field of byId(m.containers, o)?.fields ?? []) {
          f.moved.add(fkey(o, field));
          if (a.verb === "print") {
            for (const t of a.to) {
              push(f.writes, fkey(t, field), a);
              push(f.reads, fkey(o, field), a);
            }
          }
        }
      }
    }
    const s = a.stepId || NOSTEP;
    for (const c of [...a.from, ...a.to, ...a.objects]) {
      if (!f.touched.has(c)) f.touched.set(c, new Set());
      f.touched.get(c)!.add(s);
    }
    for (const it of a.items) {
      if (WRITES.has(a.verb)) for (const c of a.to) push(f.writes, fkey(c, it.info), a);
      for (const c of a.from) push(f.reads, fkey(c, it.info), a);
    }
  }
  return f;
}

/* ---------- gaps ---------- */

export type GapTarget = { type: "action"; actionId: string; stepId: string } | { type: "container"; containerId: string } | { type: "none" };

export type GapFix =
  | { op: "defineField"; containerId: string; infoId: string }
  | { op: "listLater"; containerId: string }
  | { op: "deleteContainer"; containerId: string }
  | { op: "setPreexisting"; containerId: string; value: boolean }
  | { op: "confirm"; actionId: string }
  | { op: "merge"; listKey: ListKey; dropId: string; keepId: string };

export interface GapItem {
  label: string;
  where: string;
  target: GapTarget;
  fix?: { label: string; action: GapFix };
}

export type GapKey =
  | "incomplete" | "checkNoResult" | "checkNoPlan" | "notListed" | "untouched" | "ghost"
  | "pending" | "unknown" | "unusedContainer" | "noContainerOrigin" | "setupPreexisting"
  | "noOrigin" | "sourceNotTraced" | "neverUsed" | "unconfirmed" | "nobodyBehind" | "duplicates";

export interface GapGroup {
  key: GapKey;
  title: string;
  why: string;
  items: GapItem[];
}

/** Every gap in the map, grouped. Groups with nothing in them are left out. */
export function gaps(m: IfmMap): GapGroup[] {
  const F = facts(m);
  const out: GapGroup[] = [];
  const steps = ordered(m);
  const name = (lst: { id: string; name: string }[], id: string | null) => byId(lst, id)?.name ?? "?";
  const stepLabel = (a: Action) => {
    const i = stepIdx(m, a.stepId);
    return i >= 0 ? `${i + 1}. ${steps[i]!.name}` : "No step";
  };
  const goA = (a: Action): GapTarget => ({ type: "action", actionId: a.id, stepId: a.stepId || NOSTEP });
  const goC = (id: string): GapTarget => ({ type: "container", containerId: id });
  const aItem = (a: Action, label: string, extra: Partial<GapItem> = {}): GapItem => ({
    label,
    where: `${stepLabel(a)} · ${a.who ? name(m.performers, a.who) : "nobody"} ${VB[a.verb].word}`,
    target: goA(a),
    ...extra,
  });
  const add = (key: GapKey, title: string, why: string, items: GapItem[]) => out.push({ key, title, why, items });

  add("incomplete", "Incomplete actions", "Something the action needs wasn't recorded.",
    m.actions.flatMap((a) => {
      const v = VB[a.verb];
      const miss: string[] = [];
      if (!a.who) miss.push("who");
      if (v.from === "req" && !a.from.length) miss.push("from where");
      if (v.to === "req" && !a.to.length) miss.push(v.toLabel ? `${v.toLabel.toLowerCase()} what` : "into where");
      if (v.toWho && !v.toWhoOpt && !a.toWho) miss.push(v.toWho.toLowerCase());
      if (v.fromWho && !a.fromWho) miss.push("from whom");
      if (v.method && !a.method) miss.push("how");
      return miss.length ? [aItem(a, `Missing ${miss.join(", ")}`)] : [];
    }));

  const checks = m.actions.filter((a) => a.verb === "check");
  const ck = (a: Action) => summary(m, a).replace(/^[^:]+: /, "");
  add("checkNoResult", "Check result not recorded", "The check happens, but the outcome isn't written down or told to anyone.",
    checks.filter((a) => !a.to.length && !a.toWho).map((a) =>
      aItem(a, ck(a), { where: `${stepLabel(a)} · result stays in ${a.who ? name(m.performers, a.who) : "someone"}'s head` })));
  add("checkNoPlan", "No plan if a check fails", "Nobody has said what happens when it doesn't match.",
    checks.filter((a) => !a.onFail).map((a) => aItem(a, ck(a))));

  const notListed: GapItem[] = [];
  F.writes.forEach((acts, k) => {
    const [cid, iid] = k.split("|") as [string, string];
    const c = byId(m.containers, cid);
    if (c && c.fields.length && !c.fields.includes(iid))
      notListed.push(aItem(acts[0]!, `${name(m.information, iid)} into ${c.name}`, { fix: { label: "Define it", action: { op: "defineField", containerId: cid, infoId: iid } } }));
  });
  add("notListed", "Not listed as held", "Written into a container that isn't meant to hold it. Real, or a mistake?", notListed);

  add("untouched", "Defined but untouched", "Information a container holds that nobody fills and nobody reads.",
    m.containers.flatMap((c) => c.fields
      .filter((f) => !F.writes.has(fkey(c.id, f)) && !F.reads.has(fkey(c.id, f)) && !F.moved.has(fkey(c.id, f)))
      .map((f) => ({ label: `${name(m.information, f)} on ${c.name}`, where: "Defined, but no action fills or reads it", target: goC(c.id) }))));

  const ghost: GapItem[] = [];
  F.reads.forEach((acts, k) => {
    const [cid, iid] = k.split("|") as [string, string];
    const c = byId(m.containers, cid);
    if (c && !F.writes.has(k) && !c.fields.includes(iid)) ghost.push(aItem(acts[0]!, `${name(m.information, iid)} from ${c.name}`));
  });
  add("ghost", "Taken from where it isn't", "Read or copied from a container that never receives it and doesn't define it.", ghost);

  const pending: GapItem[] = [];
  const unknown: GapItem[] = [];
  for (const c of m.containers) {
    const s = cStatus(c);
    if (s === "pending")
      pending.push({ label: c.name, where: c.contentsNote ? `Find out from: ${c.contentsNote}` : "Nobody noted who can tell you what's on it", target: goC(c.id) });
    else if (s === "unknown" && F.touched.has(c.id))
      unknown.push({ label: c.name, where: "Used in the process, but nothing is listed on it", target: goC(c.id), fix: { label: "List later", action: { op: "listLater", containerId: c.id } } });
  }
  add("pending", "Contents pending", "Marked List later. Fill in when you have the form.", pending);
  add("unknown", "Contents not asked yet", "Used in the process, but nobody has said what's on it.", unknown);
  add("unusedContainer", "Container not used", "Set up, but no saved action uses it at any step. Add it to an action, or delete it.",
    m.containers.filter((c) => !F.touched.has(c.id)).map((c) => ({
      label: c.name,
      where: c.fields.length ? `${c.fields.length} information item${c.fields.length === 1 ? "" : "s"} held` : "Nothing listed on it",
      target: goC(c.id),
      fix: { label: "Delete", action: { op: "deleteContainer", containerId: c.id } },
    })));

  const born = new Set<string>();
  for (const a of m.actions) {
    if (a.verb === "setup" || a.verb === "receive") a.objects.forEach((o) => born.add(o));
    if (a.verb === "print") a.to.forEach((o) => born.add(o));
  }
  add("noContainerOrigin", "Container has no origin", "Used in the process, but nobody sets it up, receives it or prints it, and it isn't marked as already existing.",
    m.containers.filter((c) => F.touched.has(c.id) && !c.preexisting && !born.has(c.id)).map((c) => ({
      label: c.name,
      where: "Add a Set up action, or mark it as already existing",
      target: goC(c.id),
      fix: { label: "Already exists", action: { op: "setPreexisting", containerId: c.id, value: true } },
    })));
  add("setupPreexisting", "Set up, but already exists", "One of these is wrong: either it's made during the process, or it was there before.",
    m.actions.filter((a) => a.verb === "setup").flatMap((a) => a.objects.flatMap((o) => {
      const c = byId(m.containers, o);
      return c && c.preexisting
        ? [aItem(a, c.name, { where: "Set up here, but marked as already existing before this process", fix: { label: "Not pre-existing", action: { op: "setPreexisting", containerId: c.id, value: false } } })]
        : [];
    })));

  // Information that arrives from outside: on a received document, on a standing source, or taken from one.
  const received = new Set<string>();
  for (const a of m.actions) if (a.verb === "receive") for (const o of a.objects) byId(m.containers, o)?.fields.forEach((f) => received.add(f));
  const pre = new Set<string>();
  for (const c of m.containers) if (c.preexisting) { pre.add(c.id); c.fields.forEach((f) => received.add(f)); }
  for (const a of m.actions) if (a.from.some((c) => pre.has(c))) a.items.forEach((it) => received.add(it.info));
  const noOrigin: GapItem[] = [];
  const deadEnd: GapItem[] = [];
  for (const i of m.information) {
    const acts = m.actions.filter((a) => a.items.some((x) => x.info === i.id));
    if (!acts.length) continue;
    if (!received.has(i.id) && !acts.some((a) => a.verb === "create" || a.verb === "measure" || a.verb === "decide" || a.verb === "calculate"))
      noOrigin.push(aItem(acts[0]!, i.name, { where: "Moved around, but never created, measured, decided or calculated" }));
    if (!acts.some((a) => a.from.length)) deadEnd.push(aItem(acts[0]!, i.name, { where: "Recorded, but no action ever takes it from anywhere" }));
  }
  add("noOrigin", "No origin", "Never created, measured, decided, calculated, received on a document, or taken from something that already exists.", noOrigin);
  add("sourceNotTraced", "Existing source, not traced", "Already exists before this process. Note who keeps it up to date and where it comes from.",
    m.containers.filter((c) => c.preexisting && (!c.ownerId || !clean(c.preexistingNote))).map((c) => {
      const miss: string[] = [];
      if (!c.ownerId) miss.push("who keeps it");
      if (!clean(c.preexistingNote)) miss.push("where it comes from");
      return { label: c.name, where: `Missing ${miss.join(" and ")}`, target: goC(c.id) };
    }));
  add("neverUsed", "Never used", "Written down, then nothing reads or passes it on.", deadEnd);

  add("unconfirmed", "Unconfirmed", "Marked as unsure. Check with someone who does the work.",
    m.actions.filter((a) => !a.confirmed).map((a) => aItem(a, summary(m, a), { fix: { label: "Confirm", action: { op: "confirm", actionId: a.id } } })));
  add("nobodyBehind", "Nobody behind it", "No record of who told us. Edit the action and set its Source.",
    m.actions.filter((a) => !a.toldBy).map((a) => aItem(a, summary(m, a))));

  const dups: GapItem[] = [];
  const kinds: [ListKey, string][] = [["information", "information item"], ["containers", "container"], ["performers", "person or system"]];
  for (const [key, label] of kinds) {
    const lst: { id: string; name: string }[] = m[key];
    for (let x = 0; x < lst.length; x++)
      for (let y = x + 1; y < lst.length; y++) {
        const A = lst[x]!;
        const B = lst[y]!;
        if (!similar(A.name, B.name)) continue;
        dups.push({
          label: `“${A.name}” / “${B.name}”`,
          where: `Same ${label} under two names?`,
          target: { type: "none" },
          fix: { label: "Merge", action: { op: "merge", listKey: key, dropId: B.id, keepId: A.id } },
        });
      }
  }
  add("duplicates", "Possible duplicates", "Merge keeps the first name and repoints every action.", dups);

  return out.filter((g) => g.items.length);
}

/** Carry out a gap's fix button. Changes `m`. */
export function applyFix(m: IfmMap, fix: GapFix): void {
  switch (fix.op) {
    case "defineField": {
      const c = byId(m.containers, fix.containerId);
      if (c && !c.fields.includes(fix.infoId)) c.fields.push(fix.infoId);
      return;
    }
    case "listLater": {
      const c = byId(m.containers, fix.containerId);
      if (c) c.contents = "pending";
      return;
    }
    case "deleteContainer":
      deleteContainer(m, fix.containerId);
      return;
    case "setPreexisting": {
      const c = byId(m.containers, fix.containerId);
      if (c) c.preexisting = fix.value;
      return;
    }
    case "confirm": {
      const a = byId(m.actions, fix.actionId);
      if (a) a.confirmed = true;
      return;
    }
    case "merge":
      merge(m, fix.listKey, fix.dropId, fix.keepId);
      return;
  }
}
