---
name: colour-and-render-review-followups
description: What a 2026-09-21 review of the overnight colour-object, shader-loading and multiway landings found and did not fix, the synteny mate and follow findings excepted (those are synteny-mates-and-follow-review). Its calls are all decided; four measurements remain, each deciding whether anything is built. Read before touching the colour objects' menus, the mark rule list, the shader loaders or the multiway demos.
---

# Colour, shader-loading and multiway follow-ups

The review read the overnight changes to `agent-docs/` and checked each claim
against the code. What it fixed has landed. What follows is the rest: file each
item into [ideas/](../ideas/README.md) or [TODO.md](../TODO.md) once someone
decides it, and delete this file when none is left.

## Waiting on a number

- **First paint over a slow connection.** Pinned to WebGL2, an alignments
  display fetches 18 GLSL chunks before its first frame
  ([reference/EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md) §"Shader text
  loads when a HAL is built"). Grouping a plugin's text into one chunk was
  declined with no latency figure; time first paint under a throttled network
  before reopening it.
- **Multiway lane stability.** A 2026-09-20 re-run of
  `plugins/linear-comparative-view/benches/multiwayLaneStability.probe.ts` had
  peach at 8 rung changes with a new oscillation where the record says 7, and
  lane motion now shows a flip the vote takes back as a fold and unfold. Re-run the probe and regenerate the
  record before quoting it
  ([ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)).
- **Where config time goes in a browser.** Creating 262 track config nodes
  took 159 ms under jsdom, five times plugin registration
  (`agent-docs/measurements/config-schema-construction.json`, EAGER_BUNDLE
  §"Not worth chasing: building those config schemas"). Measure it in a
  browser before proposing anything.
- **Whether every alignments figure paints as it did under ADR-149.** The
  per-base layer split its own `baseColor` object off `color`, and no suite
  checks the claim that a modification layer over the plain fill draws the old
  picture. Capture the methylation and bisulfite figures
  (`test_data/arabidopsis_methylation`, `test_data/methylation_test`) against
  their goldens.
