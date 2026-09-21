---
name: colour-and-render-review-followups
description: What a 2026-09-21 review of the overnight colour-object, shader-loading and multiway landings found and did not fix, the synteny mate and follow findings excepted (those are synteny-mates-and-follow-review). Two calls for Colin — `scales.y.title` null meaning derive, and re-hosting the multiway tutorials' gene colours — and three measurements that decide whether anything is built; the plain fill's lost scale kind and both gaps moved to colour-object-and-jexl-branches. Read before touching the colour objects' menus, the mark rule list, the shader loaders or the multiway demos.
---

# Colour, shader-loading and multiway follow-ups

The review read the overnight changes to `agent-docs/` and checked each claim
against the code. What it fixed has landed. What follows is the rest: file each
item into [ideas/](../ideas/README.md) or [TODO.md](../TODO.md) once someone
decides it, and delete this file when none is left.

## Waiting on a call

- **The plain fill forgets a declared scale kind.** Decided on 2026-09-21:
  drop `none` and keep the way back in display state. [colour-object-and-jexl-branches](colour-object-and-jexl-branches.md)
  step 2 carries it.
- **`scales.y.title: null` means "derive the caption"**
  ([ADR-146](../architecture-decision-records/adr-146-null-is-the-json-spelling-of-a-slot-reset.md)
  §Consequences), the opposite of Vega-Lite's and GenomeSpy's `title: null`,
  and `""` is the spelling for no caption. This cycle already breaks
  compatibility, so flipping it costs no migration.
- **The E. coli and primate multiway tutorials colour genes with
  `jexl:feature.name ? randomColor(feature.name) : '#b0b0b0'`**
  (`website/docs/tutorials/ecoli_orthologs_synteny.md`,
  `primate_orthologs_synteny.md`, `demos/ecoli_orthologs/config.json`,
  `demos/primate_orthologs/config.json`). The gene colour channel now takes
  `{ field: 'cluster' }`
  ([ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
  §"Left open by the 2026-09-20 review"). Moving them is a `deploy-demo.sh`
  redeploy and a reshoot, which is why it waits on a yes.

## Gaps

Both moved to [colour-object-and-jexl-branches](colour-object-and-jexl-branches.md): the ramp-domain
report is its step 3, and the alignments colour joins `colorEncodingOf` on
its colour branch.

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
