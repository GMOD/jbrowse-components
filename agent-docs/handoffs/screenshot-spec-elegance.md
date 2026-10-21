---
name: screenshot-spec-elegance
description: "Making the screenshot specs (website/scripts/specs/) and their generator say each thing once. Landed: schema validation of every spec session, an action union, one session URL builder, declarative sorts and track selectors in place of clicks, one frame arranger, display-type inference (a spec names `type` only off the default). Open: the long delays and the spec respell that waits on ADR-238."
---

# Screenshot specs: what is left

Started 2026-10-21 from a scan of the 42K lines under `website/scripts/specs/`
and the generator. Most of the clutter is the app missing a way to say
something, so the larger half of this list is app work.

## Next, each needing a capture A/B on ada

- **The long delays.** After a spec's actions the generator already waits for
  the app to settle (`waitForSpecFrame` → `waitForFrame`), so a delay that ends
  an action list on app work is deleted, and one mid-list becomes
  `{ type: 'waitForAppSettled' }`. 41 of the 138 are that kind:
  - after the ready gate, alone or after `PARK_CURSOR` (16; the MAF, pangenome
    and cactus specs, `inversion_long_read`)
  - after a drawn or settled gate (13; `lgv_track_clicked`,
    `launch_sequence` stage 2, `maf_hprc_pangenome`'s 25 s)
  - after a click that starts app work (12; clustering dialogs, collapse
    introns, the feature-sequence panels)

  Probe each (`probe-app-settled.ts`) and shoot it against a baseline at the
  pre-change commit, since a matrix of sub-pixel rows moves single pixels
  between any two runs. The rest stay: Mol\* camera resets (about 45,
  untracked by the app), tooltip and menu animations, a graph layout settling
  before an anchored action, and a grid filter's debounce.

## Next, no capture needed

- **Comments.** About 37% of spec lines are comments, much of it history.

## Waits on ADR-238 (handoffs/vega-lite-vocabulary.md)

The specs respell once, after each concept lands: rows and facet (seven
spellings), compact (four), constant color (four), the y axis (three homes),
legends, and filters (about half the jexl filters are plain equality).
Table-driven spec families (`synteny.ts` multiway lanes and OrthoFinder stacks)
come after the respell, or they are written twice.

## App changes the specs point at

- Launch keys for MsaView and ProteinView, which ship with the protein3d
  plugin release; 12 `*.session.json` snapshots go then.
- A view's track entry taking `{ uri, ...settings }`, after launch-args step 1.
- Two displays of one track in a view: specs register a second session track
  over the same file today (`ui.ts`, `variants.ts`, `hg002_haplotypes.ts`,
  `pangenome_cactus.ts`). A core change for it gets an ADR first.
