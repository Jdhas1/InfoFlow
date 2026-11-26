/**
 * The built-in sample map, "Dave's shop". Partly captured, with deliberate gaps,
 * so a new user can see what the tool flags. Ported from sampleMap() in the prototype.
 */
import { emptyMap } from "./map";
import type { Action, IfmMap, PerformerKind } from "./types";

export function sampleMap(): IfmMap {
  const m = emptyMap("Dave's shop: order to floor");
  const S = ["Receive PO", "Open job", "Engineering release", "Schedule", "Production", "Inspection", "Ship & invoice"].map((n, i) => {
    m.steps.push({ id: `s${i}`, name: n, order: i });
    return `s${i}`;
  });

  const P: Record<string, string> = {};
  const people: [string, PerformerKind][] = [
    ["Customer", "external"], ["Customer Care Coordinator", "role"], ["ERP", "software"],
    ["Engineering Lead", "role"], ["Planner", "role"], ["Machinist", "role"],
  ];
  people.forEach(([name, kind], i) => {
    P[name] = `w${i}`;
    m.performers.push({ id: `w${i}`, name, kind });
  });

  const I: Record<string, string> = {};
  const info = (n: string): string => {
    if (!I[n]) {
      I[n] = `i${m.information.length}`;
      m.information.push({ id: I[n], name: n });
    }
    return I[n];
  };

  const C: Record<string, string> = {};
  const cnt = (name: string, medium: string, owner: string, fields: string[]) => {
    C[name] = `c${m.containers.length}`;
    m.containers.push({ id: C[name], name, medium, ownerId: P[owner] ?? null, fields: fields.map(info) });
  };
  cnt("Customer PO email", "Email", "Customer Care Coordinator", ["PO Number", "Customer", "Part Number", "Quantity", "Due Date"]);
  cnt("Job Log row", "Spreadsheet", "Customer Care Coordinator", ["Job Number", "PO Number", "Customer", "Part Number", "Due Date"]);
  cnt("ERP sales order", "Business system record", "ERP", ["Job Number", "Customer", "Quantity", "Due Date"]);
  cnt("Job folder", "Printed paper", "Customer Care Coordinator", []);
  const folder = m.containers[m.containers.length - 1]!;
  folder.contents = "pending";
  folder.contentsNote = "Photo of a filled folder from Customer Care";
  cnt("Drawing package", "Shared drive", "Engineering Lead", ["Part Number", "Revision", "Material Spec"]);
  cnt("Router sheet", "Printed paper", "Engineering Lead", ["Job Number", "Part Number", "Revision", "Material Spec", "Operations"]);
  cnt("Schedule whiteboard", "Board or display", "Planner", ["Job Number", "Due Date", "Work Center"]);
  cnt("Traveler", "Printed paper", "Planner", ["Job Number", "Part Number", "Quantity"]);

  const c = (name: string): string => C[name]!;
  const it = (list: string[]) => list.map((n) => ({ info: info(n), method: null }));
  const act = (step: number, who: string, verb: Action["verb"], o: Partial<Action>) => {
    m.actions.push({
      id: `a${m.actions.length}`, stepId: S[step] ?? null, who: P[who] ?? null, verb, method: null,
      items: [], objects: [], from: [], to: [], toWho: null, fromWho: null, confirmed: true,
      toldBy: "Customer Care Coordinator", channel: "Interview", at: m.createdAt,
      ...o,
    });
  };

  act(0, "Customer Care Coordinator", "receive", { objects: [c("Customer PO email")], fromWho: P["Customer"]! });
  act(1, "Customer Care Coordinator", "copy", { method: "typed", items: it(["PO #", "Customer", "Part Number", "Due Date"]), from: [c("Customer PO email")], to: [c("Job Log row")] });
  act(1, "Customer Care Coordinator", "create", { items: it(["Job No."]), to: [c("Job Log row")] });
  act(1, "Customer Care Coordinator", "copy", { method: "typed", items: it(["Job Number", "Due Date"]), from: [c("Job Log row")], to: [c("ERP sales order")] });
  act(1, "ERP", "copy", { method: "auto", items: it(["Customer"]), from: [c("Job Log row")], to: [c("ERP sales order")] });
  act(1, "Customer Care Coordinator", "copy", { method: null, items: it(["Quantity"]), from: [c("Customer PO email")], to: [c("ERP sales order")] });
  act(1, "Customer Care Coordinator", "file", { objects: [c("Customer PO email")], to: [c("Job folder")] });
  act(2, "Engineering Lead", "copy", { method: "typed", items: it(["Job Number", "Part Number", "Revision", "Material Spec"]), from: [c("ERP sales order"), c("Drawing package")], to: [c("Router sheet")], toldBy: "Engineering Lead", confirmed: false });
  act(3, "Planner", "copy", { method: "written", items: it(["Job Number", "Due Date"]), from: [c("ERP sales order")], to: [c("Schedule whiteboard")], toldBy: "Planner" });
  act(3, "Planner", "decide", { items: it(["Work Center"]), from: [c("Router sheet")], to: [c("Schedule whiteboard")], toldBy: "Planner" });
  act(3, "ERP", "copy", { method: "auto", items: it(["Job Number", "Part Number", "Quantity"]), from: [c("ERP sales order")], to: [c("Traveler")], toldBy: null });
  act(4, "Planner", "tell", { items: it(["Run order"]), from: [c("Schedule whiteboard")], toWho: P["Machinist"]!, confirmed: false, toldBy: "Machinist" });
  act(4, "Machinist", "read", { items: it(["Revision", "Material Spec"]), from: [c("Router sheet")], toldBy: "Machinist" });
  act(4, "Machinist", "read", { items: it(["Revision"]), from: [c("Traveler")], toldBy: "Machinist" });
  return m;
}
