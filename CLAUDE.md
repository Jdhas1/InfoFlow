# InfoFlow: rules for Claude Code

This file is read at the start of every Claude Code session in this repo.

## What this is
InfoFlow is a browser tool for mapping how information moves through a business process: who does what to which information, in which containers (spreadsheets, forms, systems, paper), and how it is moved (typed by hand, pasted, automatic...). It has two parts:
1. **Map Intake**: the capture tool a consultant uses during interviews and floor walks.
2. **Atlas**: the visual map drawn from what was captured, highlighting where information is re-keyed, copied, or at risk.

## Source of truth
- `design/v3/` holds the approved design prototype. **It is the spec.** Build what it does and how it looks.
- `design/v3/HANDOFF.md` is the brief. Read it before starting any work.
- There is no earlier codebase to reuse. The project was deliberately restarted from scratch. Do not look for, restore, or imitate any previous version.
- The `.dc.html` files run on a design-tool runtime (`support.js`, `<sc-if>`, `<sc-for>`, `{{ }}` bindings). Do not ship that runtime or those templates. Re-implement the behaviour in normal, maintainable code.

## Working rules
- The owner (Jared) is not a developer. Explain plans and results in plain language, with short numbered lists, and no jargon without a one-line explanation.
- Always propose a plan and wait for approval before large changes.
- Work on a branch and open a pull request. Never push straight to `main`.
- Keep the stack simple and boring: a static site with no server and no accounts unless Jared asks for one. All map data stays in the user's browser and in files they save.
- Every change that touches the data model, saving/loading, or import must come with tests.
- Do not change the saved-file format (`.ifm.json`, `schemaVersion`) or the Atlas data contract (`design/v3/SCHEMA.md`) without saying so explicitly and adding a migration.
- Times shown to Jared are in Mountain Time (Denver).
