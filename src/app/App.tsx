import { EngineCheck } from "./EngineCheck";
import { VersionBadge } from "./VersionBadge";

const CURRENT = 1; // 0-based index of the stage in review

const STAGES = [
  "Foundation",
  "The engine: data model, sentence reader, gaps, saving",
  "Start and setup screens",
  "Capture, part 1: recording actions",
  "Capture, part 2: containers and the side panel",
  "Atlas map view",
  "Hardening: storage warnings, accessibility, end-to-end test",
  "Beta delivery",
];

/**
 * Build-in-progress page: proves the build, fonts, design tokens and version number work,
 * and (from stage 2) lets you try the engine. The real start screen replaces this in stage 3.
 */
export function App() {
  return (
    <div className="page">
      <header className="topbar">
        <span className="kicker">Information Flow Mapper</span>
        <VersionBadge />
      </header>
      <main className="placeholder">
        <div className="placeholder-intro">
          <h1 className="display">MAP INTAKE</h1>
          <p className="lede">
            The beta is being built. This page lets you try the engine underneath Map Intake: the sentence reader, and
            the checks it runs on a map. The real screens arrive in stage 3.
          </p>
        </div>
        <section className="card blueprint" aria-labelledby="progress-title">
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <div className="card-kicker">Build progress</div>
          <h2 id="progress-title" className="card-title">
            Stage {CURRENT + 1} of {STAGES.length}
          </h2>
          <ol className="stage-list">
            {STAGES.map((s, i) => (
              <li key={s} className={i === CURRENT ? "is-current" : i < CURRENT ? "is-done" : undefined} aria-current={i === CURRENT ? "step" : undefined}>
                <span className="stage-n">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
                {i < CURRENT && <span className="tag tag-neutral">Done</span>}
                {i === CURRENT && <span className="tag tag-accent">In review</span>}
              </li>
            ))}
          </ol>
        </section>
        <EngineCheck />
      </main>
      <footer className="footer">
        <VersionBadge />
        <span className="feedback-placeholder" data-testid="feedback-placeholder">
          Send feedback: <em>placeholder, the form link arrives before beta delivery</em>
        </span>
      </footer>
    </div>
  );
}
