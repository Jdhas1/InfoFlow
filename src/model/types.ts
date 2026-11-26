/**
 * The InfoFlow map: everything captured during intake.
 * This is the shape saved in `.ifm.json` files (see src/storage/file.ts) and in the browser.
 */

export const SCHEMA_VERSION = "4.0.0";

export type VerbKey =
  | "create" | "copy" | "read" | "check" | "tell" | "decide" | "measure" | "calculate" | "update"
  | "setup" | "file" | "print" | "receive" | "send" | "archive";

export type MethodKey = "typed" | "paste" | "auto" | "scan" | "written";

export type PerformerKind = "role" | "external" | "software";

export type Channel = "Interview" | "Floor walk" | "Document" | "Workshop";

/** Whether anyone has said what is on a container. */
export type ContentsStatus = "listed" | "pending" | "unknown";

export interface Step {
  id: string;
  name: string;
  /** Position in the process, 0 first. Kept as 0..n-1 by renumber(). */
  order: number;
}

/** A role, an outside party, or a piece of software. */
export interface Performer {
  id: string;
  name: string;
  kind: PerformerKind;
}

/** Where information lives: a spreadsheet, a form, an email, a whiteboard... */
export interface Container {
  id: string;
  name: string;
  /** The format, e.g. "Email", "Spreadsheet". */
  medium: string | null;
  ownerId: string | null;
  /** Information ids this container is meant to hold. */
  fields: string[];
  contents?: ContentsStatus;
  /** For "List later": who or what will tell you what's on it. */
  contentsNote?: string;
  /** The container this one sits inside. */
  parentId?: string | null;
  /** Already exists before this process starts. */
  preexisting?: boolean;
  /** For pre-existing containers: where it comes from. */
  preexistingNote?: string;
}

/** A single piece of information, e.g. "PO Number". */
export interface Information {
  id: string;
  name: string;
}

export interface ActionItem {
  info: string;
  method: MethodKey | null;
}

/** One recorded action: who does what to which information or containers. */
export interface Action {
  id: string;
  /** null means "No step" (its step was removed). */
  stepId: string | null;
  who: string | null;
  verb: VerbKey;
  /** How it moved. Only used by the "copy" verb. */
  method: MethodKey | null;
  /** Information acted on (information verbs). */
  items: ActionItem[];
  /** Containers acted on (container verbs). */
  objects: string[];
  from: string[];
  to: string[];
  toWho: string | null;
  fromWho: string | null;
  onFail?: string | null;
  /** false means the consultant marked it as unsure. */
  confirmed: boolean;
  /** Who told us this. */
  toldBy: string | null;
  channel: Channel | null;
  /** ISO time it was recorded. */
  at: string;
}

export interface IfmMap {
  schemaVersion: typeof SCHEMA_VERSION;
  mapId: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  steps: Step[];
  performers: Performer[];
  containers: Container[];
  information: Information[];
  actions: Action[];
}

/** The interview session: who is talking to you and how. Saved alongside a map in the browser. */
export interface Session {
  who: string;
  channel: Channel;
}

/** Marker for "Actions with no step" when used as an active step. */
export const NOSTEP = "__none";
