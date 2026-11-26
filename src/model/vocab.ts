/**
 * The fixed vocabulary of Map Intake: verbs, copy methods, performer kinds, channels and templates.
 * Ported from design/v3/Map Intake v3.dc.html (VERBS, METHODS, VERB_WORDS, METHOD_ALIAS...).
 */
import type { Channel, ContentsStatus, MethodKey, PerformerKind, VerbKey } from "./types";

/** "req" = must be filled in, "opt" = may be, "none" = not asked. */
export type SlotNeed = "req" | "opt" | "none";

export interface VerbDef {
  k: VerbKey;
  label: string;
  /** The word used in a sentence, e.g. "copies". */
  word: string;
  /** "info" verbs act on information; "container" verbs act on whole containers. */
  group: "info" | "container";
  from?: SlotNeed;
  fromLabel?: string;
  to: SlotNeed;
  toLabel?: string;
  /** Asks who receives it (label shown). */
  toWho?: string;
  toWhoOpt?: boolean;
  /** Asks who it came from (label shown). */
  fromWho?: string;
  /** Asks how it moved (typed, pasted...). */
  method?: boolean;
  /** Asks what happens if it fails (checks). */
  onFail?: boolean;
  hint: string;
}

export const VERBS: readonly VerbDef[] = [
  { k: "create", label: "Create", word: "creates", group: "info", from: "none", to: "req", hint: "Brings a value into being: assigns a number, raises an order" },
  { k: "copy", label: "Type / copy into", word: "copies", group: "info", from: "req", to: "req", method: true, hint: "Moves values from one container into another" },
  { k: "read", label: "Read / use", word: "reads", group: "info", from: "req", to: "none", hint: "Looks at a value to do the work. Nothing is written" },
  { k: "check", label: "Check / verify", word: "checks", group: "info", from: "opt", fromLabel: "Looked at", to: "opt", toLabel: "Result into", toWho: "Result told to", toWhoOpt: true, onFail: true, hint: "Looks to confirm a value: what's on hand, whether it's right. Add a second place if they compare. A control point" },
  { k: "tell", label: "Tell verbally", word: "tells", group: "info", from: "opt", to: "none", toWho: "Told to", hint: "Says it to someone. No record" },
  { k: "decide", label: "Decide", word: "decides", group: "info", from: "opt", to: "opt", hint: "Makes the call, maybe from inputs, maybe writes it down" },
  { k: "measure", label: "Measure", word: "measures", group: "info", from: "opt", to: "req", hint: "Reads it off the work or an instrument" },
  { k: "calculate", label: "Calculate", word: "calculates", group: "info", from: "req", to: "req", hint: "Works it out from other values" },
  { k: "update", label: "Update / change", word: "updates", group: "info", from: "opt", to: "req", hint: "Changes a value already there" },
  { k: "setup", label: "Set up / create", word: "sets up", group: "container", to: "opt", toLabel: "Inside", hint: "Makes a new container: a SharePoint folder, a spreadsheet, a binder, a job traveler. Add where it lives if it sits inside something" },
  { k: "file", label: "File / move", word: "files", group: "container", to: "req", toLabel: "Into", hint: "Puts a container somewhere: a folder, a rack, a drive" },
  { k: "print", label: "Print / copy", word: "prints", group: "container", to: "req", toLabel: "As", hint: "Makes a copy that can drift from the original" },
  { k: "receive", label: "Receive", word: "receives", group: "container", to: "none", fromWho: "From whom", hint: "Gets it from someone: a customer, a supplier, another role" },
  { k: "send", label: "Send", word: "sends", group: "container", to: "none", toWho: "Sent to", hint: "Hands it to someone else" },
  { k: "archive", label: "Archive / discard", word: "archives", group: "container", to: "none", hint: "Takes it out of circulation" },
];

export const VB: Readonly<Record<VerbKey, VerbDef>> = Object.fromEntries(VERBS.map((v) => [v.k, v])) as Record<VerbKey, VerbDef>;

export function isVerb(k: unknown): k is VerbKey {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(VB, k);
}

export interface MethodDef {
  k: MethodKey;
  label: string;
  word: string;
}

export const METHODS: readonly MethodDef[] = [
  { k: "typed", label: "Typed by hand", word: "types" },
  { k: "paste", label: "Copy & paste", word: "pastes" },
  { k: "auto", label: "Automatically", word: "posts" },
  { k: "scan", label: "Scanned / imported", word: "scans" },
  { k: "written", label: "Hand-written", word: "writes" },
];

export const MB: Readonly<Record<MethodKey, MethodDef>> = Object.fromEntries(METHODS.map((m) => [m.k, m])) as Record<MethodKey, MethodDef>;

export function isMethod(k: unknown): k is MethodKey {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(MB, k);
}

/** Words the sentence reader recognises: [word, verb, method implied by the word]. */
export const VERB_WORDS: readonly (readonly [string, VerbKey, MethodKey | null])[] = [
  ["types", "copy", "typed"], ["keys", "copy", "typed"], ["enters", "copy", "typed"], ["rekeys", "copy", "typed"],
  ["pastes", "copy", "paste"], ["posts", "copy", "auto"], ["syncs", "copy", "auto"], ["transfers", "copy", "auto"],
  ["scans", "copy", "scan"], ["imports", "copy", "scan"], ["writes", "copy", "written"], ["copies", "copy", null],
  ["sets up", "setup", null], ["opens", "setup", null], ["starts", "setup", null],
  ["creates", "create", null], ["generates", "create", null], ["assigns", "create", null], ["raises", "create", null],
  ["reads", "read", null], ["uses", "read", null], ["references", "read", null],
  ["checks", "check", null], ["verifies", "check", null], ["confirms", "check", null], ["compares", "check", null], ["reconciles", "check", null],
  ["tells", "tell", null], ["says", "tell", null], ["calls", "tell", null],
  ["decides", "decide", null], ["chooses", "decide", null],
  ["measures", "measure", null], ["inspects", "measure", null], ["counts", "measure", null], ["weighs", "measure", null],
  ["calculates", "calculate", null], ["computes", "calculate", null],
  ["updates", "update", null], ["changes", "update", null], ["corrects", "update", null], ["edits", "update", null],
  ["files", "file", null], ["moves", "file", null], ["puts", "file", null], ["stores", "file", null],
  ["prints", "print", null], ["photocopies", "print", null],
  ["receives", "receive", null], ["gets", "receive", null],
  ["sends", "send", null], ["emails", "send", null], ["mails", "send", null], ["hands", "send", null], ["ships", "send", null],
  ["archives", "archive", null], ["discards", "archive", null], ["shreds", "archive", null],
];

/** Words that name a method, e.g. "... by hand" or "Due Date (pasted)". */
export const METHOD_ALIAS: Readonly<Record<string, MethodKey>> = {
  typed: "typed", "by hand": "typed", keyed: "typed",
  paste: "paste", pasted: "paste",
  auto: "auto", automatic: "auto", automatically: "auto",
  scan: "scan", scanned: "scan",
  written: "written", "hand-written": "written",
};

export const KINDS: readonly (readonly [PerformerKind, string])[] = [
  ["role", "Role"],
  ["external", "Outside party"],
  ["software", "Software"],
];

export function kindLabel(k: PerformerKind): string {
  return KINDS.find((x) => x[0] === k)?.[1] ?? "Role";
}

export const CHANNELS: readonly Channel[] = ["Interview", "Floor walk", "Document", "Workshop"];

export const STATUSES: readonly (readonly [ContentsStatus, string])[] = [
  ["listed", "Listed"],
  ["pending", "List later"],
  ["unknown", "Not asked yet"],
];

export interface Template {
  name: string;
  steps: string[];
}

export const TEMPLATES: readonly Template[] = [
  { name: "Job shop: quote to cash", steps: ["Quote", "Receive PO", "Open job", "Engineering release", "Purchasing", "Schedule", "Production", "Inspection", "Ship & invoice"] },
  { name: "Office: order to invoice", steps: ["Inquiry", "Quote", "Order entry", "Credit check", "Fulfilment", "Invoice", "Collect"] },
];

/** Verbs that write information into their "to" containers. */
export const WRITES: ReadonlySet<VerbKey> = new Set<VerbKey>(["create", "copy", "decide", "measure", "calculate", "update"]);

/** Formats offered when describing a container. */
export const MEDIA: readonly string[] = [
  "Email", "Spreadsheet", "Business system record", "Shared drive", "Printed paper", "Form",
  "Board or display", "Someone’s memory", "Physical location", "Physical part or tag",
];
