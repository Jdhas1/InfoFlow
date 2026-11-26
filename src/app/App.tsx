import { VersionBadge } from "./VersionBadge";

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
 * Stage 1 placeholder. It proves the build, fonts, design tokens and version number work.
 * The real start screen replaces this in stage 3.
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
            The beta is being built. This page confirms the foundations are in place: the app builds, the design&rsquo;s
            fonts and colours load from inside the app, and the version number shows.
          </p>
        </div>
        <section className="card blueprint" aria-labelledby="progress-title">
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <div className="card-kicker">Build progress</div>
          <h2 id="progress-title" className="card-title">
            Stage 1 of {STAGES.length}
          </h2>
          <ol className="stage-list">
            {STAGES.map((s, i) => (
              <li key={s} className={i === 0 ? "is-current" : undefined} aria-current={i === 0 ? "step" : undefined}>
                <span className="stage-n">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
                {i === 0 && <span className="tag tag-accent">In review</span>}
              </li>
            ))}
          </ol>
        </section>
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
