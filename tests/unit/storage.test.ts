import { beforeEach, describe, expect, it } from "vitest";
import { fileNameFor, readMap, readMapText, serializeMap } from "../../src/storage/file";
import { asCopy, BrowserStore, CURRENT_KEY, importConflict, LEGACY_KEY, LIB_KEY } from "../../src/storage/library";
import { sampleMap } from "../../src/model/sample";
import { commitDraft, parseLine } from "../../src/model/draft";
import { mapFromSteps } from "../../src/model/map";
import { SCHEMA_VERSION } from "../../src/model/types";

/** A pretend browser storage we can fill up or break on purpose. */
class FakeStorage implements Storage {
  data = new Map<string, string>();
  limit = Infinity;
  blocked = false;
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { if (this.blocked) throw new DOMException("no", "SecurityError"); return this.data.get(k) ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) {
    if (this.blocked) throw new DOMException("no", "SecurityError");
    const size = [...this.data.entries()].filter(([x]) => x !== k).reduce((s, [, x]) => s + x.length, 0) + v.length;
    if (size > this.limit) throw new DOMException("full", "QuotaExceededError");
    this.data.set(k, v);
  }
}

describe("saved files: round trip", () => {
  it("save then open gives back the same map", () => {
    const m = sampleMap();
    const r = readMapText(serializeMap(m));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.map).toEqual(m);
      expect(r.warnings).toEqual([]);
      expect(r.upgradedFrom).toBeNull();
    }
  });

  it("round-trips a map built by recording actions", () => {
    const m = mapFromSteps(["Quote", "Order"], "Test");
    const session = { who: "Pat", channel: "Floor walk" as const };
    commitDraft(m, parseLine("Clerk copies Part Number (pasted), Revision from Drawing into Router by hand?"), { stepId: m.steps[0]!.id, session });
    commitDraft(m, parseLine("Inspector checks Quantity against Traveler into Log"), { stepId: m.steps[1]!.id, session });
    const r = readMapText(serializeMap(m));
    expect(r.ok && r.map).toEqual(m);
  });

  it("writes format 4.0.0 and a tidy file name", () => {
    const m = sampleMap();
    expect(JSON.parse(serializeMap(m)).schemaVersion).toBe("4.0.0");
    expect(fileNameFor(m)).toBe("dave-s-shop-order-to-floor.ifm.json");
  });
});

describe("saved files: upgrading older versions", () => {
  it("opens prototype files (4.0.0-draft) and upgrades them", () => {
    const old = { ...JSON.parse(serializeMap(sampleMap())), schemaVersion: "4.0.0-draft" };
    const r = readMap(old);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.map.schemaVersion).toBe(SCHEMA_VERSION);
      expect(r.upgradedFrom).toBe("4.0.0-draft");
      expect(r.map.actions.length).toBe(sampleMap().actions.length);
    }
  });

  it("fills in fields older files left out", () => {
    const r = readMap({
      steps: [{ id: "s", name: "A", order: 5 }], performers: [], information: [{ id: "i", name: "X" }],
      containers: [{ id: "c", name: "Box" }],
      actions: [{ id: "a", verb: "read", items: [{ info: "i" }], from: ["c"] }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.map.mapId).toMatch(/^map_/);
      expect(r.map.containers[0]).toMatchObject({ medium: null, ownerId: null, fields: [] });
      expect(r.map.actions[0]).toMatchObject({ stepId: null, who: null, confirmed: true, channel: null, method: null });
      expect(r.map.steps[0]!.order).toBe(0);
    }
  });
});

describe("saved files: plain-language errors", () => {
  const cases: [string, string, RegExp][] = [
    ["not JSON", "hello", /can't be read as JSON/],
    ["a list, not a map", "[]", /isn't an InfoFlow map/],
    ["older intake model", JSON.stringify({ steps: [] }), /has no performers.*older intake model/],
    ["newer version", JSON.stringify({ ...JSON.parse(serializeMap(sampleMap())), schemaVersion: "5.1.0" }), /newer version of InfoFlow/],
    ["unknown version", JSON.stringify({ ...JSON.parse(serializeMap(sampleMap())), schemaVersion: "2.0" }), /can't open/],
  ];
  for (const [name, text, msg] of cases) it(name, () => {
    const r = readMapText(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });

  it("names the damaged action", () => {
    const f = JSON.parse(serializeMap(sampleMap()));
    f.actions[2].verb = "teleports";
    const r = readMap(f);
    expect(!r.ok && r.error).toBe("That map file looks damaged: action 3 has an action type this version doesn't know.");
  });

  it("rejects duplicate ids", () => {
    const f = JSON.parse(serializeMap(sampleMap()));
    f.steps[1].id = f.steps[0].id;
    const r = readMap(f);
    expect(!r.ok && r.error).toMatch(/two steps share the id/);
  });

  it("repairs broken links and says what it did", () => {
    const f = JSON.parse(serializeMap(sampleMap()));
    f.steps = f.steps.filter((s: { id: string }) => s.id !== "s1");
    f.performers = f.performers.filter((p: { name: string }) => p.name !== "Machinist");
    f.containers[0].parentId = f.containers[1].id;
    f.containers[1].parentId = f.containers[0].id;
    const r = readMap(f);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.join(" ")).toMatch(/6 actions pointed at a step that no longer exists/);
      expect(r.warnings.join(" ")).toMatch(/person or system that no longer exists/);
      expect(r.map.containers[0]!.parentId && r.map.containers[1]!.parentId).toBeFalsy();
    }
  });
});

describe("browser storage", () => {
  let s: FakeStorage;
  beforeEach(() => { s = new FakeStorage(); });

  it("saves, lists, and deletes maps", () => {
    const store = new BrowserStore(s, () => 1000);
    const m = sampleMap();
    expect(store.save(m, { who: "Pat", channel: "Interview" })).toEqual({ ok: true, savedAt: 1000 });
    const loaded = store.load();
    expect(Object.keys(loaded.library)).toEqual([m.mapId]);
    expect(loaded.library[m.mapId]!.map).toEqual(m);
    expect(loaded.currentId).toBe(m.mapId);
    expect(store.remove(m.mapId).ok).toBe(true);
    expect(store.load().library).toEqual({});
    expect(s.getItem(CURRENT_KEY)).toBeNull();
  });

  it("reports full storage in plain words", () => {
    s.limit = 100;
    const r = new BrowserStore(s).save(sampleMap(), null);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problem).toBe("full");
      expect(r.message).toMatch(/full.*Save to file/);
    }
  });

  it("reports blocked storage, including no storage at all", () => {
    s.blocked = true;
    const r = new BrowserStore(s).save(sampleMap(), null);
    expect(!r.ok && r.problem).toBe("blocked");
    expect(new BrowserStore(s).load().available).toBe(false);
    const none = new BrowserStore(null);
    expect(none.load()).toMatchObject({ available: false, library: {} });
    expect(!none.save(sampleMap(), null).ok).toBe(true);
  });

  it("keeps a backup of a damaged library instead of wiping it", () => {
    s.setItem(LIB_KEY, "{broken");
    const r = new BrowserStore(s, () => 42).load();
    expect(r.problems[0]).toMatch(/damaged.*backup/);
    expect(s.getItem(`${LIB_KEY}-damaged-42`)).toBe("{broken");
  });

  it("hides unreadable saved maps without deleting them", () => {
    const store = new BrowserStore(s);
    store.save(sampleMap(), null);
    const raw = JSON.parse(s.getItem(LIB_KEY)!);
    raw.bad = { map: { nope: true }, savedAt: 1 };
    s.setItem(LIB_KEY, JSON.stringify(raw));
    const r = store.load();
    expect(Object.keys(r.library).length).toBe(1);
    expect(r.problems[0]).toMatch(/1 saved map .* couldn't be read/);
    store.save(sampleMap(), null);
    expect(JSON.parse(s.getItem(LIB_KEY)!).bad).toBeTruthy();
  });

  it("carries over the prototype's last map (v2 key) into the library", () => {
    const m = { ...JSON.parse(serializeMap(sampleMap())), schemaVersion: "4.0.0-draft" };
    s.setItem(LEGACY_KEY, JSON.stringify({ map: m, session: { who: "Dana", channel: "Workshop" } }));
    const r = new BrowserStore(s).load();
    expect(r.currentId).toBe(m.mapId);
    expect(r.library[m.mapId]!.map.schemaVersion).toBe("4.0.0");
    expect(r.currentSession).toEqual({ who: "Dana", channel: "Workshop" });
    expect(JSON.parse(s.getItem(LIB_KEY)!)[m.mapId]).toBeTruthy();
  });

  it("opens maps saved by the prototype in its own format", () => {
    const m = { ...JSON.parse(serializeMap(sampleMap())), schemaVersion: "4.0.0-draft" };
    s.setItem(LIB_KEY, JSON.stringify({ [m.mapId]: { map: m, session: null, savedAt: 5 } }));
    const r = new BrowserStore(s).load();
    expect(r.library[m.mapId]).toMatchObject({ savedAt: 5, map: { schemaVersion: "4.0.0" } });
  });
});

describe("importing a map that's already saved", () => {
  it("detects the clash and can keep both", () => {
    const m = sampleMap();
    const lib = { [m.mapId]: { map: m, session: null, savedAt: 1 } };
    expect(importConflict(lib, m)).toBe(lib[m.mapId]);
    const copy = asCopy(m);
    expect(copy.mapId).not.toBe(m.mapId);
    expect(copy.title).toBe("Dave's shop: order to floor (copy)");
    expect(importConflict(lib, copy)).toBeNull();
  });
});
