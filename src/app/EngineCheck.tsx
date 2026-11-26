import { useId, useMemo, useState } from "react";
import { draftIssues, lineOf, parseLine, type Draft } from "../model/draft";
import { gaps } from "../model/gaps";
import { sampleMap } from "../model/sample";
import { atlasData } from "../atlas/convert";
import { MB, VB, kindLabel } from "../model/vocab";

const EXAMPLES = [
  "Sam types the PO number from the email into the job log",
  "Customer Care Coordinator receives RFQ email from Customer",
  "Machinist checks Quantity against Traveler into Inspection log?",
  "Planner tells Run order from Schedule whiteboard to Machinist",
  "Clerk copies Part Number (pasted), Revision from Drawing into Router by hand",
];

function rows(d: Draft): [string, string][] {
  const v = d.verb ? VB[d.verb] : null;
  const out: [string, string][] = [["Who", d.who ? `${d.who} (${kindLabel(d.whoKind).toLowerCase()})` : "—"]];
  out.push(["Does", v ? `${v.label} (${v.group === "info" ? "to information" : "to a container"})` : "—"]);
  if (v?.method) out.push(["How", d.method ? MB[d.method].label : "—"]);
  if (v) out.push([v.group === "container" ? "Which" : "What", (v.group === "container" ? d.objects : d.items.map((i) => (i.method && i.method !== d.method ? `${i.name} (${MB[i.method].label.toLowerCase()})` : i.name))).join(" · ") || "—"]);
  if (v?.from && v.from !== "none") out.push([v.fromLabel ?? "From", d.from.join(" · ") || "—"]);
  if (v?.fromWho) out.push([v.fromWho, d.fromWho || "—"]);
  if (v && v.to !== "none") out.push([v.toLabel ?? "Into", d.to.join(" · ") || "—"]);
  if (v?.toWho) out.push([v.toWho, d.toWho || "—"]);
  out.push(["Unsure", d.unsure ? "Yes (ends with ?)" : "No"]);
  return out;
}

/**
 * Stage 2 test page: try the sentence reader, and see the engine's view of the sample map.
 * Replaced by the real screens from stage 3.
 */
export function EngineCheck() {
  const [line, setLine] = useState(EXAMPLES[0]!);
  const inputId = useId();
  const d = useMemo(() => parseLine(line), [line]);
  const issue = draftIssues(d);
  const sample = useMemo(() => {
    const m = sampleMap();
    const a = atlasData(m);
    return {
      gaps: gaps(m),
      actions: m.actions.length,
      containers: a.containers.filter((c) => !c.memory).length,
      lines: a.transfers.length,
      verbal: a.transfers.filter((t) => t.method === "verbal").length,
    };
  }, []);

  return (
    <>
      <section className="card blueprint" aria-labelledby="reader-title">
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div className="card-kicker">Try it</div>
        <h2 id="reader-title" className="card-title">The sentence reader</h2>
        <p className="muted">Type an action the way you'd say it. The reader splits it into the parts Map Intake records.</p>
        <label htmlFor={inputId} className="field-label">Action</label>
        <input id={inputId} className="input line-input" value={line} onChange={(e) => setLine(e.target.value)} autoComplete="off" spellCheck={false} data-testid="reader-input" />
        <div className="examples" role="group" aria-label="Examples">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" className="btn btn-ghost example" onClick={() => setLine(x)}>{x}</button>
          ))}
        </div>
        <dl className="parsed" data-testid="reader-result">
          {rows(d).map(([k, v]) => (
            <div key={k} className="parsed-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">Read back as: <strong data-testid="reader-lineback">{lineOf(d) || "—"}</strong></p>
        {issue && <p className="issue" data-testid="reader-issue">{issue}</p>}
      </section>

      <section className="card blueprint" aria-labelledby="sample-title">
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div className="card-kicker">Engine check</div>
        <h2 id="sample-title" className="card-title">Sample map: Dave&rsquo;s shop</h2>
        <p className="muted" data-testid="sample-summary">
          {sample.actions} actions recorded. The Atlas would draw {sample.containers} containers and {sample.lines} lines,
          including {sample.verbal} spoken (rust dotted) {sample.verbal === 1 ? "line" : "lines"}.
        </p>
        <ul className="gap-list" data-testid="sample-gaps">
          {sample.gaps.map((g) => (
            <li key={g.key}>
              <span>{g.title}</span>
              <span className="count">{g.items.length}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
