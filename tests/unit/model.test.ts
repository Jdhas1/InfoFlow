import { describe, expect, it } from "vitest";
import {
  addFieldsToContainer, addStep, addSubContainers, byName, cStatus, deleteAction, deleteContainer, deletePerformer,
  emptyMap, ensureContainer, ensureInfo, ensurePerformer, mapFromSteps, merge, moveAction, moveStep, nest, ordered,
  performerUse, removeStep, updateMap,
} from "../../src/model/map";
import { commitDraft, draftFromAction, draftIssues, emptyDraft, lineOf, methodsUsed, parseLine } from "../../src/model/draft";
import { lev, similar, slug } from "../../src/model/text";
import { sampleMap } from "../../src/model/sample";
import { SCHEMA_VERSION } from "../../src/model/types";
import { TEMPLATES } from "../../src/model/vocab";

const session = { who: "Pat", channel: "Interview" as const };

describe("text helpers", () => {
  it("measures edit distance", () => {
    expect(lev("kitten", "sitting")).toBe(3);
    expect(lev("", "abc")).toBe(3);
  });
  it("spots near-duplicate names but not identical ones", () => {
    expect(similar("PO #", "PO Number")).toBe(true);
    expect(similar("Job No.", "Job Number")).toBe(true);
    expect(similar("Revison", "Revision")).toBe(true);
    expect(similar("Quote", "quote")).toBe(false);
    expect(similar("Job", "Jab")).toBe(false); // too short to judge
  });
  it("makes file-safe names", () => {
    expect(slug("Dave's shop: order to floor")).toBe("dave-s-shop-order-to-floor");
    expect(slug("")).toBe("map");
    expect(slug("!!!")).toBe("map");
  });
});

describe("maps and steps", () => {
  it("starts empty at the current format version", () => {
    const m = emptyMap("X");
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.steps).toEqual([]);
    expect(m.mapId).toMatch(/^map_/);
  });

  it("builds from a template", () => {
    const t = TEMPLATES[0]!;
    const m = mapFromSteps(t.steps);
    expect(ordered(m).map((s) => s.name)).toEqual(t.steps);
  });

  it("adds, reorders and removes steps; removed steps keep their actions as 'No step'", () => {
    const m = mapFromSteps(["A", "B", "C"]);
    expect(addStep(m, "  ")).toBeNull();
    addStep(m, "D");
    const [a, b] = ordered(m);
    moveStep(m, b!.id, -1);
    expect(ordered(m).map((s) => s.name)).toEqual(["B", "A", "C", "D"]);
    moveStep(m, ordered(m)[0]!.id, -1); // already first: nothing happens
    expect(ordered(m).map((s) => s.name)).toEqual(["B", "A", "C", "D"]);
    commitDraft(m, parseLine("Pat reads Price from Quote sheet"), { stepId: a!.id, session });
    removeStep(m, a!.id);
    expect(ordered(m).map((s) => [s.name, s.order])).toEqual([["B", 0], ["C", 1], ["D", 2]]);
    expect(m.actions[0]!.stepId).toBeNull();
  });

  it("updateMap copies, so the original is untouched", () => {
    const m = emptyMap("A");
    const n = updateMap(m, (d) => { d.title = "B"; }, new Date("2030-01-01T00:00:00Z"));
    expect(m.title).toBe("A");
    expect(n.title).toBe("B");
    expect(n.modifiedAt).toBe("2030-01-01T00:00:00.000Z");
  });

  it("finds by name regardless of case and spacing", () => {
    const m = emptyMap();
    const p = ensurePerformer(m, "  Planner ", "role")!;
    expect(ensurePerformer(m, "planner", "software")).toBe(p);
    expect(p.kind).toBe("role");
    expect(ensureInfo(m, "")).toBeNull();
    expect(byName(m.performers, "PLANNER")).toBe(p);
  });
});

describe("containers", () => {
  it("nests but refuses loops", () => {
    const m = emptyMap();
    const a = ensureContainer(m, "Site")!;
    const b = ensureContainer(m, "Folder")!;
    const c = ensureContainer(m, "File")!;
    expect(nest(m, b, a.id)).toBe(true);
    expect(nest(m, c, b.id)).toBe(true);
    expect(nest(m, a, c.id)).toBe(false);
    expect(a.parentId).toBeUndefined();
    expect(nest(m, c, null)).toBe(true);
    expect(c.parentId).toBeNull();
  });

  it("adds containers inside with plain errors", () => {
    const m = emptyMap();
    expect(addSubContainers(m, "Package", "RFQ PDF, Drawing; Package")).toBe("A container can't hold itself.");
    expect(byName(m.containers, "RFQ PDF")!.parentId).toBe(byName(m.containers, "Package")!.id);
    expect(addSubContainers(m, "RFQ PDF", "Package")).toBe("Package already holds RFQ PDF, so it can't also sit inside it.");
  });

  it("lists information on a container and marks it listed", () => {
    const m = emptyMap();
    const c = ensureContainer(m, "PO")!;
    expect(cStatus(c)).toBe("unknown");
    addFieldsToContainer(m, "PO", "PO Number, Quantity\nDue Date");
    expect(c.fields.length).toBe(3);
    expect(cStatus(c)).toBe("listed");
    ensureContainer(m, "Attachment");
    addFieldsToContainer(m, "PO", "Attachment");
    expect(byName(m.containers, "Attachment")!.parentId).toBe(c.id);
    expect(c.fields.length).toBe(3);
  });

  it("deleting a container removes it from actions and frees children", () => {
    const m = sampleMap();
    const id = byName(m.containers, "Job folder")!.id;
    deleteContainer(m, id);
    expect(m.containers.some((c) => c.id === id)).toBe(false);
    expect(m.actions.some((a) => a.to.includes(id) || a.objects.includes(id))).toBe(false);
  });
});

describe("merging and deleting", () => {
  it("merges information and repoints every action and container", () => {
    const m = sampleMap();
    const keep = byName(m.information, "PO Number")!;
    const drop = byName(m.information, "PO #")!;
    merge(m, "information", drop.id, keep.id);
    expect(byName(m.information, "PO #")).toBeNull();
    expect(m.actions.some((a) => a.items.some((i) => i.info === drop.id))).toBe(false);
    expect(m.actions[1]!.items.map((i) => i.info)).toContain(keep.id);
  });

  it("merges containers, keeping both lists of information", () => {
    const m = emptyMap();
    addFieldsToContainer(m, "Job Log", "Job Number");
    addFieldsToContainer(m, "Job log row", "Due Date");
    const keep = byName(m.containers, "Job Log")!;
    merge(m, "containers", byName(m.containers, "Job log row")!.id, keep.id);
    expect(m.containers.length).toBe(1);
    expect(keep.fields.length).toBe(2);
  });

  it("merges performers including ownership", () => {
    const m = sampleMap();
    const cc = byName(m.performers, "Customer Care Coordinator")!;
    const pl = byName(m.performers, "Planner")!;
    merge(m, "performers", pl.id, cc.id);
    expect(m.actions.filter((a) => a.who === cc.id).length).toBeGreaterThan(7);
    expect(byName(m.containers, "Schedule whiteboard")!.ownerId).toBe(cc.id);
  });

  it("deletes a performer and blanks references", () => {
    const m = sampleMap();
    const mach = byName(m.performers, "Machinist")!;
    expect(performerUse(m, mach.id)).toEqual({ actions: 3, owns: 0 });
    deletePerformer(m, mach.id);
    expect(m.actions.some((a) => a.who === mach.id || a.toWho === mach.id)).toBe(false);
  });

  it("moves actions within a step only", () => {
    const m = sampleMap();
    const atStep1 = () => m.actions.filter((a) => a.stepId === "s1").map((a) => a.id);
    const before = atStep1();
    moveAction(m, before[0]!, -1); // first: no change
    expect(atStep1()).toEqual(before);
    moveAction(m, before[0]!, 1);
    expect(atStep1()).toEqual([before[1], before[0], ...before.slice(2)]);
    deleteAction(m, before[0]!);
    expect(atStep1()).not.toContain(before[0]);
  });
});

describe("recording actions", () => {
  it("reads a typed sentence", () => {
    const d = parseLine("Sam types the PO number from the email into the job log");
    expect(d).toMatchObject({ who: "Sam", verb: "copy", method: "typed", items: [{ name: "the PO number", method: null }], from: ["the email"], to: ["the job log"] });
    expect(lineOf(d)).toBe("Sam types the PO number from the email into the job log");
  });

  it("picks up unsure, per-item methods and 'by hand'", () => {
    const d = parseLine("Clerk copies Part Number (pasted), Revision from Drawing into Router by hand?");
    expect(d.unsure).toBe(true);
    expect(d.method).toBe("typed");
    expect(d.items).toEqual([{ name: "Part Number", method: "paste" }, { name: "Revision", method: null }]);
    expect(methodsUsed(d)).toBe(2);
  });

  it("explains what's missing", () => {
    expect(draftIssues(emptyDraft())).toBe("");
    expect(draftIssues(parseLine("Pat"))).toBe("Pick what they do.");
    expect(draftIssues(parseLine("Pat copies Price"))).toBe("Missing: from where?, into where?, how?. You can still save, and it'll show as a gap.");
    expect(draftIssues(parseLine("Pat receives PO email"))).toContain("from whom?");
  });

  it("saves a draft, creating people, containers and information by name", () => {
    const m = mapFromSteps(["Quote"]);
    const step = m.steps[0]!.id;
    const n = commitDraft(m, parseLine("Customer Care receives RFQ email from Acme"), { stepId: step, session });
    expect(n).toBe(1);
    const a = m.actions[0]!;
    expect(a.verb).toBe("receive");
    expect(byName(m.performers, "Acme")!.kind).toBe("external");
    expect(a.toldBy).toBe("Pat");
    expect(a.channel).toBe("Interview");
    expect(a.confirmed).toBe(true);
  });

  it("splits a copy with mixed methods into one action per method", () => {
    const m = mapFromSteps(["Quote"]);
    const n = commitDraft(m, parseLine("Clerk copies Part Number (pasted), Revision from Drawing into Router by hand"), { stepId: m.steps[0]!.id, session });
    expect(n).toBe(2);
    expect(m.actions.map((a) => a.method).sort()).toEqual(["paste", "typed"]);
  });

  it("won't save without a verb or something to act on", () => {
    const m = emptyMap();
    expect(commitDraft(m, parseLine("Pat"), { stepId: null, session })).toBe(0);
    expect(commitDraft(m, parseLine("Pat reads"), { stepId: null, session })).toBe(0);
    expect(m.actions.length).toBe(0);
  });

  it("editing replaces the action in place", () => {
    const m = sampleMap();
    const target = m.actions[3]!;
    const d = draftFromAction(m, target);
    d.method = "paste";
    commitDraft(m, d, { stepId: target.stepId, session, editingId: target.id });
    expect(m.actions.length).toBe(sampleMap().actions.length);
    expect(m.actions[3]!.method).toBe("paste");
    expect(m.actions.some((a) => a.id === target.id)).toBe(false);
  });

  it("set up / file nests the container", () => {
    const m = emptyMap();
    commitDraft(m, parseLine("Lead sets up Job folder inside Jobs drive"), { stepId: null, session });
    expect(byName(m.containers, "Job folder")!.parentId).toBe(byName(m.containers, "Jobs drive")!.id);
  });

  it("an explicit Source overrides the session; an empty one means nobody", () => {
    const m = emptyMap();
    const d = parseLine("Pat reads Price from Quote");
    commitDraft(m, { ...d, toldBy: "Sam", channel: "Document" }, { stepId: null, session });
    commitDraft(m, { ...d, toldBy: "" }, { stepId: null, session });
    expect(m.actions.map((a) => [a.toldBy, a.channel])).toEqual([["Sam", "Document"], [null, "Interview"]]);
  });
});
