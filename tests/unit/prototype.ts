/**
 * Loads the approved prototype's own script (design/v3/Map Intake v3.dc.html) so tests can check
 * that the rebuilt engine gives the same answers. Test-only; the prototype is never shipped.
 */
import { readFileSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Prototype {
  sampleMap: () => any;
  emptyDraft: (who?: string, kind?: string) => any;
  similar: (a: string, b: string) => boolean;
  norm: (s: string) => string;
  /** A prototype component with `map` loaded, to call its methods (parseLine, gaps, atlasData...). */
  component: (map: any) => any;
}

export function loadPrototype(): Prototype {
  const html = readFileSync("design/v3/Map Intake v3.dc.html", "utf8");
  const m = html.match(/<script type="text\/x-dc" data-dc-script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Prototype script not found");
  const factory = new Function(
    "DCLogic",
    "localStorage",
    `${m[1]}\nreturn { Component, sampleMap, emptyDraft, similar, norm };`,
  );
  class DCLogic {
    state: any = {};
    setState(p: any) {
      this.state = { ...this.state, ...p };
    }
  }
  const fakeStorage = { getItem: () => null, setItem: () => undefined };
  const api = factory(DCLogic, fakeStorage);
  return {
    sampleMap: api.sampleMap,
    emptyDraft: api.emptyDraft,
    similar: api.similar,
    norm: api.norm,
    component(map: any) {
      const c = new api.Component();
      c.state = { ...c.state, map };
      return c;
    },
  };
}
