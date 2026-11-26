import { versionLabel } from "../version";

/** Small, always-visible version tag so testers can say which build they used. */
export function VersionBadge() {
  return (
    <span className="version-badge" data-testid="app-version" title="Tell us this number when you send feedback">
      {versionLabel()}
    </span>
  );
}
