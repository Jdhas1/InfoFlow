# Handoff brief: InfoFlow beta 1

Prepared 26 Nov 2026 from the "Information flow mapping tool" design project (Map Intake v3).

## 1. Goal
Build a robust, production-quality version of **Map Intake v3** (with its built-in **Atlas** view) from the prototype in this folder, ready for a first closed round of customer beta testing.

## 2. Files in this folder
| File | What it is |
| --- | --- |
| `Map Intake v3.dc.html` | **The main spec.** Markup, styling and all behaviour (script starts around line 557). |
| `Information Flow Atlas.dc.html` | The Atlas visualisation, embedded in Intake's "Map" view and openable in its own tab. |
| `SCHEMA.md` | The data contract the Atlas reads (`flow-map.json` shape). |
| `flow-map.json` | Sample Atlas data for testing. |
| `ds-industry.css`, `_ds/` | Design tokens and styles (colours, type, spacing). Match these. |
| `support.js`, `compat.json` | The design tool's runtime. Needed only to open the prototypes for reference; do not ship it. |

To see the prototype running, serve this folder locally (e.g. `npx serve design/v3`) and open `Map Intake v3.dc.html` in a browser.

## 3. What the prototype does (must be preserved)
1. **Start screen**: start blank, start from a template (two step lists), import a saved `.ifm.json` file, open the built-in sample map, and a "Saved on this computer" list with open/delete.
2. **Step setup**: name the map and set up and reorder the process steps.
3. **Capture workspace**, organised by step:
   - Record actions as "who does what to which information/containers". Fifteen verbs, split into information verbs (create, copy, read, check, tell, decide, measure, calculate, update) and container verbs (set up, file, print, receive, send, archive), each with its own required and optional from/to fields.
   - Copy methods: typed, paste, auto, scan, hand-written. Methods can be set per item.
   - A quick-entry sentence parser (`VERB_WORDS`, `METHOD_ALIAS`) that turns lines like "Sam types the PO number from the email into the job log" into a draft action.
   - Performers of three kinds: role, outside party, software. Interview channel (interview, floor walk, document, workshop), plus "unsure" and "told by" attribution.
   - Containers with a medium, an owner, nesting (inside another container), a list of fields, and a contents status (listed / list later / not asked yet).
   - Near-duplicate name detection (`norm`, `lev`, `similar`).
   - Side panel tabs: Gaps, Containers, Information, Who.
   - Editing and deleting recorded actions.
4. **Map view**: converts the captured map into the Atlas format (`atlasData()`, around line 1129) and shows the Atlas.
5. **Saving**: autosaves to the browser (`ifm-library-v3` library and `ifm-intake-v3` current map, migrating from `ifm-intake-v2`), and "Save to file" downloads `<title>.ifm.json` (`schemaVersion: "4.0.0-draft"`).

## 4. What "robust and beta-ready" means
1. **Real code structure**: a small, readable codebase with the data model, parser, Atlas conversion, storage and UI in separate modules. Choose the simplest stack that does the job, and explain the choice to Jared before building.
2. **Data safety**:
   - Validate every imported file and show a plain-language error when it's wrong.
   - Version the saved format and migrate older versions.
   - Handle browser storage being full, blocked or cleared, and warn the user.
   - Remind users to "Save to file" so beta testers don't lose work.
3. **Tests**: unit tests for the model, parser, `atlasData()` conversion, and save/load/import round trips, plus at least one end-to-end test of the main flow (start, add steps, capture actions, view map, save, re-import).
4. **Accessibility and polish**: keyboard use, labels, visible focus, sensible empty and error states, and usable on a laptop screen at minimum.
5. **Repo hygiene**: a README (what it is, how to run it, how to test it), a `.gitignore`, and a GitHub Actions workflow that runs the tests on every pull request.
6. **Beta delivery**:
   - Deploy to a private-ish URL. GitHub Pages is acceptable; flag the option of password protection if customer data is sensitive.
   - Show a visible version number.
   - Add a "Send feedback" link (destination to be confirmed with Jared).
   - Write a short `BETA-NOTES.md` for testers: what to try, known limits, and how to send feedback.

## 5. Out of scope for beta 1
User accounts, servers, cloud sync, multi-user editing, payments.

## 6. Open questions to ask Jared
1. Where should beta feedback go (email, form, GitHub Issues)?
2. Is a public URL acceptable, or do testers need a password?
3. Should the standalone Atlas page (loading `flow-map.json`) ship too, or only the Atlas inside Intake?
