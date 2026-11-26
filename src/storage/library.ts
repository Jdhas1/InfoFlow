/**
 * Saving maps in the browser ("Saved on this computer").
 *
 * Keys (unchanged from the prototype so its saved maps carry over):
 * - "ifm-library-v3": { [mapId]: { map, session, savedAt } } — every saved map.
 * - "ifm-intake-v3":  { map, session } — the map last worked on.
 * - "ifm-intake-v2":  older single-map key; read once and added to the library.
 *
 * Browser storage can be full, blocked (some private windows, strict settings) or cleared by the user.
 * Every call here reports that instead of throwing, so the UI can warn and point to "Save to file".
 */
import { uid } from "../model/map";
import type { IfmMap, Session } from "../model/types";
import { readMap } from "./file";

export const LIB_KEY = "ifm-library-v3";
export const CURRENT_KEY = "ifm-intake-v3";
export const LEGACY_KEY = "ifm-intake-v2";
const PROBE_KEY = "ifm-probe";

export interface LibraryEntry {
  map: IfmMap;
  session: Session | null;
  /** Milliseconds since 1970, when it was last saved here. */
  savedAt: number;
}

export type Library = Record<string, LibraryEntry>;

export type StoreProblem = "blocked" | "full" | "unknown";

export type SaveResult = { ok: true; savedAt: number } | { ok: false; problem: StoreProblem; message: string };

export interface LoadResult {
  library: Library;
  /** The id of the map last worked on, if any. */
  currentId: string | null;
  currentSession: Session | null;
  /** Plain-language notes about anything that couldn't be read. */
  problems: string[];
  /** false when the browser won't let us store anything at all. */
  available: boolean;
}

const MESSAGES: Record<StoreProblem, string> = {
  blocked: "This browser isn't letting InfoFlow save on this computer (this can happen in private windows). Use Save to file to keep your work.",
  full: "This computer's browser storage for InfoFlow is full, so your latest changes aren't saved here. Use Save to file now, then delete old maps you don't need.",
  unknown: "Couldn't save on this computer. Use Save to file to keep your work.",
};

function problemOf(e: unknown): StoreProblem {
  if (e instanceof DOMException) {
    if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014) return "full";
    if (e.name === "SecurityError") return "blocked";
  }
  return "unknown";
}

function defaultStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // Accessing localStorage itself can throw when storage is blocked.
  }
}

export class BrowserStore {
  private readonly storage: Storage | null;
  private readonly now: () => number;

  constructor(storage: Storage | null = defaultStorage(), now: () => number = Date.now) {
    this.storage = storage;
    this.now = now;
  }

  /** Whether anything can be stored at all. */
  available(): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(PROBE_KEY, "1");
      this.storage.removeItem(PROBE_KEY);
      return true;
    } catch (e) {
      // A full store still "works" for reading; only report blocked when it's truly unusable.
      return problemOf(e) === "full";
    }
  }

  private get(key: string): string | null {
    try {
      return this.storage ? this.storage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  private set(key: string, value: string): SaveResult {
    if (!this.storage) return { ok: false, problem: "blocked", message: MESSAGES.blocked };
    try {
      this.storage.setItem(key, value);
      return { ok: true, savedAt: this.now() };
    } catch (e) {
      const problem = problemOf(e);
      return { ok: false, problem, message: MESSAGES[problem] };
    }
  }

  /** The raw library object, keeping entries this version can't read so nothing is lost. */
  private rawLibrary(problems: string[]): Record<string, unknown> {
    const text = this.get(LIB_KEY);
    if (!text) return {};
    try {
      const v: unknown = JSON.parse(text);
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
      throw new Error("not an object");
    } catch {
      // Keep the damaged data under a backup key instead of overwriting it.
      const backup = `${LIB_KEY}-damaged-${this.now()}`;
      this.set(backup, text);
      this.storage?.removeItem(LIB_KEY);
      problems.push("The list of maps saved on this computer was damaged and couldn't be read. A backup copy was kept in the browser.");
      return {};
    }
  }

  /** Read every saved map. Also carries over the prototype's "current map" keys. */
  load(): LoadResult {
    const problems: string[] = [];
    const available = this.available();
    const raw = this.rawLibrary(problems);
    const library: Library = {};
    let skipped = 0;
    for (const [key, entry] of Object.entries(raw)) {
      const e = entry as Partial<LibraryEntry> | null;
      const r = e && e.map ? readMap(e.map) : null;
      if (!r || !r.ok) {
        skipped++;
        continue;
      }
      r.map.mapId = key;
      library[key] = { map: r.map, session: e?.session ?? null, savedAt: typeof e?.savedAt === "number" ? e.savedAt : Date.parse(r.map.modifiedAt) || 0 };
    }
    if (skipped) problems.push(`${skipped} saved map${skipped === 1 ? "" : "s"} on this computer couldn't be read and ${skipped === 1 ? "is" : "are"} hidden. ${skipped === 1 ? "It was" : "They were"} left in place, not deleted.`);

    // Carry over the "map last worked on" from the prototype (v3) or older (v2) keys.
    let currentId: string | null = null;
    let currentSession: Session | null = null;
    const curText = this.get(CURRENT_KEY) ?? this.get(LEGACY_KEY);
    if (curText) {
      try {
        const d = JSON.parse(curText) as { map?: unknown; session?: Session };
        const r = d.map ? readMap(d.map) : null;
        if (r && r.ok) {
          currentId = r.map.mapId;
          currentSession = d.session ?? null;
          if (!library[currentId]) {
            const entry: LibraryEntry = { map: r.map, session: currentSession, savedAt: Date.parse(r.map.modifiedAt) || this.now() };
            library[currentId] = entry;
            raw[currentId] = entry;
            this.set(LIB_KEY, JSON.stringify(raw));
          }
        }
      } catch {
        /* An unreadable "last map" is not worth bothering the user about; the library is the record. */
      }
    }
    return { library, currentId, currentSession, problems, available };
  }

  /** Save (or replace) one map in the library and remember it as the current map. */
  save(map: IfmMap, session: Session | null): SaveResult {
    const raw = this.rawLibrary([]);
    const savedAt = this.now();
    raw[map.mapId] = { map, session, savedAt } satisfies LibraryEntry;
    const r = this.set(LIB_KEY, JSON.stringify(raw));
    if (!r.ok) return r;
    // The "current map" copy is a convenience; failing it is not worth a warning on its own.
    this.set(CURRENT_KEY, JSON.stringify({ map, session }));
    return { ok: true, savedAt };
  }

  remove(mapId: string): SaveResult {
    const raw = this.rawLibrary([]);
    delete raw[mapId];
    const r = this.set(LIB_KEY, JSON.stringify(raw));
    if (r.ok) {
      const cur = this.get(CURRENT_KEY);
      try {
        if (cur && (JSON.parse(cur) as { map?: { mapId?: string } }).map?.mapId === mapId) this.storage?.removeItem(CURRENT_KEY);
      } catch {
        /* ignore */
      }
    }
    return r;
  }
}

/* ---------- importing a file that may already be saved ---------- */

/** The saved map an imported map would overwrite, if any (same map id). */
export function importConflict(library: Library, map: IfmMap): LibraryEntry | null {
  return library[map.mapId] ?? null;
}

/** Prepare an imported map to sit alongside an existing copy: new id, "(copy)" on the title. */
export function asCopy(map: IfmMap, now: Date = new Date()): IfmMap {
  return { ...map, mapId: uid("map"), title: `${map.title || "Untitled map"} (copy)`, modifiedAt: now.toISOString() };
}
