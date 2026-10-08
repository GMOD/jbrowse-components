---
name: the-doc-config-checker-drops-warnings-and-skips-fragments
description: The docs' config checker keeps only schema errors and reads only whole-config fences, so a guide taught a display removed a month earlier, and a tutorial's session fence wrote settings the app drops, with every docs gate green. Listed by the 2026-10-07 grammar audit, which fixed the docs and left the checker; filed here because nothing about v5.0.0 turns on it.
---

# The doc config checker drops warnings and skips fragments

Moved out of the 2026-10-07 grammar release audit when its handoff closed. The
audit found eleven docs teaching config the app no longer takes, fixed them,
and traced each to something `pnpm check-docs` does not read. The docs are
right as of that date; the gaps that let them drift are still open.

## What is not checked

- **Warnings.** `website/scripts/check-config-blocks.ts` reports a problem
  only where `p.level === 'error'`, and an unregistered display type is a
  warning. `variant_track.md` taught `LDDisplay` for a month after
  `53bb2b9551` removed it.
- **Anything that is not a whole config.** A display fragment, a `marks`
  fragment, JSON inside a table cell, a session fence and commented JSON are
  never validated. `tutorials/chromhmm.md` wrote `rows` and `height` on a
  display snapshot in a session fence, where the app drops both.
- **The generated `config/` pages.** Each `#example` block in a schema's
  docstring is published and unread; the Manhattan example wrote a constant
  color as a field there.
- **The CLI README**, regenerated only on prepack, so
  `generate-cli-doc --check` passes over stale text between releases.
- **What a build script writes.** `scripts/build_circular_synteny.sh` and its
  siblings emit a config into a hosted demo, and nothing validates the output
  until someone opens the demo.

## What is checked now

`scripts/inTreeConfigLiterals.test.ts` reads the config literals written in
TypeScript: the examples sites' demos, the browser-test suites and probes, and
the figure specs under `website/scripts/specs`. ADR-216's `mark: 'heatmap'`
broke three of those at load with every gate green before it existed.

## First move

Count before building: run `validateBlock` over the docs with warnings kept
and see how many are real. If most are, failing on a warning is a one-line
change with a short allowlist; if most are noise, the unregistered-type
warning alone is worth promoting to an error.
