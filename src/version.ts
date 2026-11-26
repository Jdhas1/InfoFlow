/** The version shown to testers. It comes from package.json, so there is one place to change it. */
export const APP_VERSION: string = __APP_VERSION__;

/** The human-facing label, e.g. "Beta 0.1.0". */
export function versionLabel(version: string = APP_VERSION): string {
  return `Beta ${version}`;
}
