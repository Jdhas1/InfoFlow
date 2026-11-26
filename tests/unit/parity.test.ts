/**
 * Parity with the approved prototype: the rebuilt engine must give the same answers as the spec.
 * Where beta 1 deliberately differs (approved by Jared), the test says so.
 */
import { describe, expect, it } from "vitest";
import { loadPrototype } from "./prototype";
import { parseLine, lineOf } from "../../src/model/draft";
import { gaps } from "../../src/model/gaps";
import { sampleMap } from "../../src/model/sample";
import { similar, norm } from "../../src/model/text";
import { atlasData } from "../../src/atlas/convert";

const proto = loadPrototype();

const SENTENCES = [
  "Sam types the PO number from the email into the job log",
  "Planner reads Due Date from ERP sales order",
  "Customer Care Coordinator receives RFQ email from Customer",
  "Machinist checks Quantity against Traveler, Shelf into Inspection log?",
  "Planner tells Run order from Schedule whiteboard to Machinist",
  "ERP posts Job Number, Customer and Due Date from Job Log row into ERP sales order",
  "Clerk copies Part Number (pasted), Revision from Drawing into Router by typed",
  "Engineering Lead sets up Job folder",
  "Planner prints Traveler as Traveler copy",
  "Buyer sends Supplier PO to Supplier",
  "Inspector measures Diameter into Inspection report",
  "Customer Care Coordinator files Customer PO email into Job folder",
  "Someone who does nothing in particular",
  "",
];

describe("sentence reader matches the prototype", () => {
  const c = proto.component(proto.sampleMap());
  for (const s of SENTENCES) {
    it(JSON.stringify(s), () => {
      const theirs = c.parseLine(s);
      const ours = parseLine(s, sampleMap().performers);
      expect(ours).toEqual(theirs);
      expect(lineOf(ours)).toBe(c.lineOf(theirs));
    });
  }
});

describe("sentence reader: deliberate fixes over the prototype", () => {
  const c = proto.component(proto.sampleMap());
  it('"by hand" sets the method (the prototype ignored it)', () => {
    const s = "Clerk copies Part Number from Drawing into Router by hand";
    expect(c.parseLine(s).method).toBeNull();
    expect(parseLine(s).method).toBe("typed");
    expect(parseLine(s).to).toEqual(["Router"]);
  });
  it('"inside" is read back the way the sentence is written (the prototype lost it)', () => {
    const s = "Engineering Lead sets up Job folder inside Jobs drive";
    expect(c.parseLine(s).objects).toEqual(["Job folder inside Jobs drive"]);
    const d = parseLine(s);
    expect(d.objects).toEqual(["Job folder"]);
    expect(d.to).toEqual(["Jobs drive"]);
    expect(lineOf(d)).toBe(s);
  });
});

describe("name matching matches the prototype", () => {
  const pairs: [string, string][] = [
    ["PO #", "PO Number"], ["Job No.", "Job Number"], ["Part Numbers", "Part Number"], ["Revison", "Revision"],
    ["Customer", "Customers"], ["Qty", "Quantity"], ["ERP", "ERP"], ["Due Date", "Due Dates"], ["Job", "Jab"],
  ];
  for (const [a, b] of pairs) {
    it(`${a} / ${b}`, () => {
      expect(similar(a, b)).toBe(proto.similar(a, b));
      expect(norm(a)).toBe(proto.norm(a));
    });
  }
});

describe("gaps on the sample map match the prototype", () => {
  it("same groups, same items, same fix buttons", () => {
    const theirs = proto.component(proto.sampleMap()).gaps(proto.sampleMap());
    const ours = gaps(sampleMap());
    const shape = (gs: { title: string; why: string; items: { label: string; where: string; fixLabel?: string; fix?: { label: string } }[] }[]) =>
      gs.map((g) => ({ title: g.title, why: g.why, items: g.items.map((i) => ({ label: i.label, where: i.where, fix: i.fixLabel ?? i.fix?.label ?? null })) }));
    expect(shape(ours)).toEqual(shape(theirs));
  });
});

describe("Atlas conversion of the sample map", () => {
  const theirs = proto.component(proto.sampleMap()).atlasData(proto.sampleMap());
  const ours = atlasData(sampleMap());

  it("has the same steps, information and checks", () => {
    expect(ours.steps).toEqual(theirs.steps);
    expect(ours.information).toEqual(theirs.information);
    expect(ours.checks).toEqual(theirs.checks);
  });

  it("has the same containers, plus head nodes for spoken information (approved change 4.5)", () => {
    expect(ours.containers.filter((c) => !c.memory)).toEqual(theirs.containers);
  });

  it("has the same written transfers, plus rust dotted 'verbal' lines for Tell (approved change 4.5)", () => {
    expect(ours.transfers.filter((t) => t.method !== "verbal")).toEqual(theirs.transfers);
    expect(ours.transfers.filter((t) => t.method === "verbal").length).toBeGreaterThan(0);
  });

  it("keeps the prototype's method styles and adds 'verbal'", () => {
    const theirIds = theirs.methods.map((x: { id: string }) => x.id);
    expect(ours.methods.filter((x) => x.id !== "verbal")).toEqual(theirs.methods);
    expect(theirIds).not.toContain("verbal");
  });
});
