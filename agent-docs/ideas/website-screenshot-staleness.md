---
name: website-screenshot-staleness
description: A spec edited without regenerating its PNG makes reviewers re-flag already-fixed figures — one batch went 8 specs, 0 PNGs. Hash the render inputs beside the committed PNG and fail CI when they drift.
---

# Website: screenshot spec ↔ PNG staleness guard

Recurring drift: a screenshot spec is edited and committed but its PNG is not regenerated
(regen needs a jbrowse-web build, so it is easy to skip), so reviewers keep seeing stale
images and re-flag "already fixed" figures. This bit the `6f0392a387` batch hard — 8 specs
fixed, **0 PNGs committed**, all 8 re-marked bad against the old images. A guard could catch
it: hash each spec's *render inputs* (its serialized spec object + the git SHAs of the
source/config files the render depends on) and record that hash next to the committed PNG (a
sidecar, or a field in `screenshot-review.json`); a CI check fails when a spec's current
input-hash ≠ the hash the committed PNG was built from. Cheaper heuristic: fail when a spec
file's git commit time is newer than its PNG's. Either turns "forgot to regen" from a silent
multi-session review loop into one red check. (Related: the review tool already hashes the
PNG bytes to expire verdicts — this is the same idea one step upstream, keyed on the spec's
inputs rather than its output.)
