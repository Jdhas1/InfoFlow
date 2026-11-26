# InfoFlow

InfoFlow is a browser tool for mapping how information moves through a business process. It answers questions like: who does what to which information, in which containers (spreadsheets, forms, systems, paper), and how it moves (typed by hand, pasted, automatic...).

It has two parts:

1. **Map Intake** is the capture tool a consultant uses during interviews and floor walks.
2. **Atlas** is the visual map drawn from what was captured. It highlights where information is re-keyed, copied, or at risk.

> **Status:** beta 1 is being built in stages. See [`design/v3/HANDOFF.md`](design/v3/HANDOFF.md) for the brief. The approved design prototype in [`design/v3/`](design/v3/) is the spec.

## Privacy by design

InfoFlow is a static website: there is no server and there are no accounts. Map data stays in the user's own browser and in the `.ifm.json` files they choose to save.

## Running it on your computer

You need [Node.js](https://nodejs.org) version 20 or newer (version 22 is recommended; see `.nvmrc`).

```bash
npm install      # one time: download the building blocks
npm run dev      # start a local copy, then open the address it prints (usually http://localhost:5173)
```

## Testing

| Command | What it checks |
| --- | --- |
| `npm run typecheck` | The code's data shapes are consistent (TypeScript). |
| `npm test` | Unit tests: fast checks of the logic (Vitest). |
| `npm run test:e2e` | End-to-end tests: a robot browser clicks through the built app (Playwright). Run `npx playwright install chromium` once first. |
| `npm run check` | All of the above, plus a production build. |

The same checks run automatically on every pull request (see `.github/workflows/ci.yml`).

## Building for release

```bash
npm run build    # writes the finished static site to dist/
npm run preview  # serves dist/ locally to try it
```

`dist/` can be hosted on any static host. Beta 1 will be hosted on Cloudflare Pages behind Cloudflare Access, so only invited testers can open it. `public/_headers` sets Cloudflare response headers that keep the beta out of search engines.

## Project layout

| Path | What's there |
| --- | --- |
| `src/` | The app source code (TypeScript and React). |
| `src/styles/industry.css` | The design system's tokens and components, copied from `design/v3/ds-industry.css` without the Google Fonts import (fonts are bundled instead). |
| `tests/unit/` | Unit tests. |
| `tests/e2e/` | End-to-end browser tests. |
| `design/v3/` | The approved prototype and brief. Reference only; never shipped. |

## Version number

The version shown in the app comes from `version` in `package.json`.
