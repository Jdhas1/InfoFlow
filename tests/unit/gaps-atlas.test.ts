import { describe, expect, it } from "vitest";
import { applyFix, gaps } from "../../src/model/gaps";
import { byName, emptyMap, mapFromSteps } from "../../src/model/map";
import { commitDraft, parseLine } from "../../src/model/draft";
import { sampleMap } from "../../src/model/sample";
import { atlasData, headId, UNKNOWN_HEAD, UNUSED_STEP } from "../../src/atlas/convert";

const session = { who: "Pat", channel: "Interview" as const };
const group = (m: ReturnType<typeof emptyMap>, key: string) => gaps(m).find((g) => g.key === key);

describe("gaps", () => {
  it("an empty map has none", () => {
    expect(gaps(emptyMap())).toEqual([]);
  });

  it("the sample map shows its deliberate gaps", () => {
    const keys = gaps(sampleMap()).map((g) => g.key);
    expect(keys).toEqual(expect.arrayContaining(["incomplete", "unconfirmed", "nobodyBehind", "duplicates", "pending"]));
  });

  it("every fix button does what it says and clears its gap", () => {
    const m = sampleMap();
    for (const key of ["notListed", "unknown", "unusedContainer", "noContainerOrigin", "unconfirmed", "duplicates"]) {
      const g = group(m, key);
      if (!g) continue;
      const before = g.items.length;
      const item = g.items.find((i) => i.fix)!;
      applyFix(m, item.fix!.action);
      expect(group(m, key)?.items.length ?? 0, key).toBeLessThan(before);
    }
  });

  it("flags checks with no result and no plan", () => {
    const m = mapFromSteps(["Inspect"]);
    commitDraft(m, parseLine("Inspector checks Quantity against Traveler"), { stepId: m.steps[0]!.id, session });
    expect(group(m, "checkNoResult")!.items[0]!.where).toContain("result stays in Inspector's head");
    expect(group(m, "checkNoPlan")!.items.length).toBe(1);
    m.actions[0]!.onFail = "Recount";
    expect(group(m, "checkNoPlan")).toBeUndefined();
  });

  it("points each item at the step or container to open", () => {
    const g = group(sampleMap(), "incomplete")!;
    expect(g.items[0]!.target).toMatchObject({ type: "action" });
    const p = group(sampleMap(), "pending")!;
    expect(p.items[0]!.target).toMatchObject({ type: "container" });
  });
});

describe("Atlas conversion", () => {
  it("follows the data contract shape", () => {
    const d = atlasData(sampleMap());
    expect(d.version).toBe(1);
    expect(d.name).toBe("Dave's shop: order to floor");
    for (const t of d.transfers) {
      expect(d.containers.some((c) => c.id === t.from)).toBe(true);
      expect(d.containers.some((c) => c.id === t.to)).toBe(true);
      expect(d.information.some((i) => i.id === t.information)).toBe(true);
      expect(d.methods.some((x) => x.id === t.method)).toBe(true);
    }
    for (const c of d.containers) expect(d.steps.some((s) => s.id === c.step)).toBe(true);
  });

  it("draws Tell as a rust dotted 'verbal' line into the listener's head", () => {
    const d = atlasData(sampleMap());
    const verbal = d.methods.find((x) => x.id === "verbal")!;
    expect(verbal.style).toBe("dotted");
    const machinist = byName(sampleMap().performers, "Machinist")!;
    const t = d.transfers.find((x) => x.method === "verbal")!;
    expect(t.to).toBe(headId(machinist.id));
    expect(t.from).toBe(byName(sampleMap().containers, "Schedule whiteboard")!.id);
    const head = d.containers.find((c) => c.id === t.to)!;
    expect(head).toMatchObject({ name: "Machinist (in their head)", memory: true, system: "In someone's head", step: "s4" });
  });

  it("a Tell with no source starts in the speaker's head; no listener goes to 'someone'", () => {
    const m = mapFromSteps(["Plan"]);
    commitDraft(m, parseLine("Planner tells Run order"), { stepId: m.steps[0]!.id, session });
    const d = atlasData(m);
    const planner = byName(m.performers, "Planner")!;
    expect(d.transfers).toEqual([{ information: m.information[0]!.id, from: headId(planner.id), to: UNKNOWN_HEAD, method: "verbal" }]);
  });

  it("read-only actions draw no line; a copy with no method is 'unknown'", () => {
    const m = mapFromSteps(["A"]);
    commitDraft(m, parseLine("Pat reads Price from Quote"), { stepId: m.steps[0]!.id, session });
    commitDraft(m, parseLine("Pat copies Price from Quote into Order"), { stepId: m.steps[0]!.id, session });
    expect(atlasData(m).transfers.map((t) => t.method)).toEqual(["unknown"]);
  });

  it("containers no action touches go in a 'Not used in any step yet' column", () => {
    const m = mapFromSteps(["A"]);
    m.containers.push({ id: "c1", name: "Binder", medium: null, ownerId: null, fields: [] });
    const d = atlasData(m);
    expect(d.containers[0]!.step).toBe(UNUSED_STEP);
    expect(d.steps.at(-1)).toEqual({ id: UNUSED_STEP, order: 1, label: "Not used in any step yet" });
  });

  it("guesses an owner from who fills or files a container", () => {
    const m = mapFromSteps(["A"]);
    commitDraft(m, parseLine("Pat types Price from Quote into Order"), { stepId: m.steps[0]!.id, session });
    const d = atlasData(m);
    expect(d.containers.find((c) => c.name === "Order")!.owner).toBe("Pat");
  });
});
