/**
 * The action being recorded (the "draft"), the typed-sentence reader, and saving a draft into the map.
 * Ported from parseLine(), lineOf(), draftIssues() and commit() in the prototype.
 */
import { byId, byName, ensureContainer, ensureInfo, ensurePerformer, nest, uid } from "./map";
import { ci, clean } from "./text";
import type { Action, Channel, IfmMap, MethodKey, PerformerKind, VerbKey } from "./types";
import { MB, METHOD_ALIAS, VB, VERB_WORDS, WRITES } from "./vocab";

export interface DraftItem {
  name: string;
  /** Set when this one item moved differently from the rest. */
  method: MethodKey | null;
}

/** An action still being written. Everything is by name; ids are found or made when it is saved. */
export interface Draft {
  who: string;
  whoKind: PerformerKind;
  verb: VerbKey | null;
  method: MethodKey | null;
  items: DraftItem[];
  objects: string[];
  from: string[];
  to: string[];
  toWho: string;
  fromWho: string;
  onFail: string;
  unsure: boolean;
  /** null = use the session's "Told by". */
  toldBy: string | null;
  /** null = use the session's channel. */
  channel: Channel | null;
}

export function emptyDraft(who = "", kind: PerformerKind = "role"): Draft {
  return { who, whoKind: kind, verb: null, method: null, items: [], objects: [], from: [], to: [], toWho: "", fromWho: "", onFail: "", unsure: false, toldBy: null, channel: null };
}

const list = (s: string): string[] => s.split(/,|\band\b/i).map(clean).filter(Boolean);

/**
 * Read a typed line like "Sam types the PO number from the email into the job log" into a draft.
 * `performers` is used to recognise people already on the map (to pick up their kind).
 */
export function parseLine(text: string, performers: IfmMap["performers"] = [], defaultKind: PerformerKind = "role"): Draft {
  let t = clean(text);
  const d = emptyDraft("", defaultKind);
  if (!t) return d;
  if (/\?\s*$/.test(t)) {
    d.unsure = true;
    t = t.replace(/\?\s*$/, "").trim();
  }
  const low = t.toLowerCase();
  let hit: { index: number; len: number; w: (typeof VERB_WORDS)[number] } | null = null;
  for (const w of VERB_WORDS) {
    const mm = new RegExp(`(^|\\s)${w[0]}(\\s|$)`).exec(low);
    if (mm && (!hit || mm.index < hit.index)) hit = { index: mm.index + mm[1]!.length, len: w[0].length, w };
  }
  if (!hit) {
    d.who = t;
    return d;
  }
  d.who = clean(t.slice(0, hit.index));
  d.verb = hit.w[1];
  d.method = hit.w[2];
  let rest = t.slice(hit.index + hit.len);
  const bm = rest.match(/\s+by\s+(.+)$/i);
  // "by hand" is accepted as well as "by typed" etc. (the prototype only matched the latter).
  const byWord = bm ? (METHOD_ALIAS[ci(bm[1])] ?? METHOD_ALIAS[`by ${ci(bm[1])}`]) : undefined;
  if (bm && bm.index != null && byWord) {
    d.method = byWord;
    rest = rest.slice(0, bm.index);
  }
  const parts = { what: "", from: "", into: "", to: "" };
  let cur: keyof typeof parts = "what";
  // "inside" is read like "into" so that "X sets up Folder inside Drive" reads back the way lineOf writes it.
  for (const seg of rest.split(/(\bfrom\b|\bagainst\b|\binto\b|\bonto\b|\binside\b|\bto\b|\bas\b)/i)) {
    const k = seg.toLowerCase();
    if (k === "from" || k === "against") cur = "from";
    else if (k === "into" || k === "onto" || k === "inside" || k === "as") cur = "into";
    else if (k === "to") cur = "to";
    else parts[cur] += seg;
  }
  const v = VB[d.verb];
  const whatList = list(parts.what);
  if (v.group === "container") d.objects = whatList;
  else
    d.items = whatList.map((n) => {
      const mm = n.match(/^(.*?)\s*\(([^)]+)\)$/);
      return mm ? { name: clean(mm[1]), method: METHOD_ALIAS[ci(mm[2])] ?? null } : { name: n, method: null };
    });
  d.from = list(parts.from);
  d.to = list(parts.into);
  if (parts.to) {
    if (v.toWho) d.toWho = clean(parts.to);
    else d.to = d.to.concat(list(parts.to));
  }
  if (v.fromWho) {
    d.fromWho = clean(parts.from);
    d.from = [];
  }
  const ex = byName(performers, d.who);
  if (ex) d.whoKind = ex.kind;
  return d;
}

/** Turn a draft back into a sentence (the reverse of parseLine). */
export function lineOf(d: Draft): string {
  if (!d.verb) return d.who;
  const v = VB[d.verb];
  const word = v.k === "copy" && d.method ? MB[d.method].word : v.word;
  const what =
    v.group === "container"
      ? d.objects.join(", ")
      : d.items.map((i) => i.name + (i.method && i.method !== d.method ? ` (${MB[i.method].label.toLowerCase()})` : "")).join(", ");
  let s = clean(`${d.who} ${word} ${what}`);
  if (d.from.length) s += (d.verb === "check" ? " against " : " from ") + d.from.join(", ");
  if (d.fromWho) s += ` from ${d.fromWho}`;
  if (d.to.length) s += (d.verb === "print" ? " as " : d.verb === "setup" ? " inside " : " into ") + d.to.join(", ");
  if (d.toWho) s += ` to ${d.toWho}`;
  if (d.unsure) s += " ?";
  return s;
}

/** What's missing from a draft, in plain words. "" when complete. */
export function draftIssues(d: Draft): string {
  if (!d.verb) return d.who ? "Pick what they do." : "";
  const v = VB[d.verb];
  const out: string[] = [];
  if (!clean(d.who)) out.push("who?");
  if (v.group === "container" ? !d.objects.length : !d.items.length) out.push(v.group === "container" ? "which container?" : "what information?");
  if (v.from === "req" && !d.from.length) out.push("from where?");
  if (v.to === "req" && !d.to.length) out.push(v.toLabel ? `${v.toLabel.toLowerCase()} what?` : "into where?");
  if (v.toWho && !v.toWhoOpt && !clean(d.toWho)) out.push(`${v.toWho.toLowerCase()}?`);
  if (v.fromWho && !clean(d.fromWho)) out.push("from whom?");
  if (v.method && !d.method) out.push("how?");
  return out.length ? `Missing: ${out.join(", ")}. You can still save, and it'll show as a gap.` : "";
}

/** How many actions a draft will be saved as (a copy with mixed methods splits into one per method). */
export function methodsUsed(d: Draft): number {
  if (!d.verb || !VB[d.verb].method) return 1;
  return new Set(d.items.map((i) => i.method || d.method || "")).size || 1;
}

/** Whether a draft has enough to be saved at all (a verb, and something to act on). */
export function canCommit(d: Draft): boolean {
  if (!d.verb) return false;
  return VB[d.verb].group === "container" ? d.objects.length > 0 : d.items.length > 0;
}

export interface CommitContext {
  /** The step being captured; null = "No step". */
  stepId: string | null;
  session: { who: string; channel: Channel };
  /** When editing, the action being replaced. */
  editingId?: string | null;
  now?: Date;
}

/**
 * Save a draft into the map. Changes `m`. Returns how many actions were written (0 if the draft
 * can't be saved yet). A copy whose items moved in different ways is split into one action per way.
 */
export function commitDraft(m: IfmMap, d: Draft, ctx: CommitContext): number {
  if (!d.verb || !canCommit(d)) return 0;
  const v = VB[d.verb];
  const at = (ctx.now ?? new Date()).toISOString();
  const who = clean(d.who) ? ensurePerformer(m, d.who, d.whoKind) : null;
  const cids = (names: string[]) => names.map((n) => ensureContainer(m, n)).filter((c) => c !== null).map((c) => c.id);
  const base = {
    stepId: ctx.stepId,
    who: who ? who.id : null,
    verb: d.verb,
    objects: cids(d.objects),
    from: cids(d.from),
    to: cids(d.to),
    toWho: v.toWho && clean(d.toWho) ? (ensurePerformer(m, d.toWho, "role")?.id ?? null) : null,
    onFail: v.onFail && clean(d.onFail) ? clean(d.onFail) : null,
    fromWho: v.fromWho && clean(d.fromWho) ? (ensurePerformer(m, d.fromWho, "external")?.id ?? null) : null,
    confirmed: !d.unsure,
    toldBy: (d.toldBy != null ? clean(d.toldBy) : clean(ctx.session.who)) || null,
    channel: d.channel ?? ctx.session.channel,
    at,
  };
  if ((d.verb === "setup" || d.verb === "file") && base.to[0]) {
    const into = base.to[0];
    base.objects.forEach((o) => nest(m, byId(m.containers, o), into));
  }

  const groups: { method: MethodKey | null; items: Action["items"] }[] = [];
  if (v.group === "info") {
    const byMethod = new Map<string, Action["items"]>();
    for (const i of d.items) {
      const mk = v.method ? i.method || d.method || "" : "";
      const info = ensureInfo(m, i.name);
      if (!info) continue;
      if (!byMethod.has(mk)) byMethod.set(mk, []);
      const bucket = byMethod.get(mk)!;
      if (!bucket.some((x) => x.info === info.id)) bucket.push({ info: info.id, method: null });
    }
    byMethod.forEach((items, mk) => groups.push({ method: (mk || null) as MethodKey | null, items }));
  } else groups.push({ method: null, items: [] });

  let pos = m.actions.length;
  if (ctx.editingId) {
    const idx = m.actions.findIndex((a) => a.id === ctx.editingId);
    if (idx >= 0) {
      pos = idx;
      m.actions.splice(idx, 1);
    }
  }
  const made: Action[] = groups.map((g) => ({ id: uid("act"), ...base, method: v.method ? g.method : null, items: g.items }));
  m.actions.splice(pos, 0, ...made);
  return made.length;
}

/** Load a saved action back into a draft for editing. */
export function draftFromAction(m: IfmMap, a: Action): Draft {
  const nm = (lst: { id: string; name: string }[], id: string | null) => byId(lst, id)?.name ?? "";
  const w = byId(m.performers, a.who);
  return {
    who: w?.name ?? "",
    whoKind: w?.kind ?? "role",
    verb: a.verb,
    method: a.method,
    items: a.items.map((it) => ({ name: nm(m.information, it.info), method: null })),
    objects: a.objects.map((c) => nm(m.containers, c)),
    from: a.from.map((c) => nm(m.containers, c)),
    to: a.to.map((c) => nm(m.containers, c)),
    toWho: nm(m.performers, a.toWho),
    fromWho: nm(m.performers, a.fromWho),
    onFail: a.onFail ?? "",
    unsure: !a.confirmed,
    toldBy: a.toldBy ?? "",
    channel: a.channel ?? null,
  };
}

/** Short label like "Check / verify: Quantity, Due Date". */
export function summary(m: IfmMap, a: Action): string {
  const v = VB[a.verb];
  const what =
    v.group === "container"
      ? a.objects.map((c) => byId(m.containers, c)?.name ?? "?")
      : a.items.map((i) => byId(m.information, i.info)?.name ?? "?");
  return `${v.label}: ${what.join(", ")}`;
}

/** Re-exported so callers can tell whether a verb writes into its "to" containers. */
export const writes = (verb: VerbKey): boolean => WRITES.has(verb);
