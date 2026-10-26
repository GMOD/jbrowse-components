---
name: screenshot-spec-elegance
description: "Making the screenshot specs (website/scripts/specs/) and their generator say each thing once. Landed: schema validation of every spec session, an action union, one session URL builder, declarative sorts and track selectors in place of clicks, one frame arranger, display-type inference (a spec names `type` only off the default). Open: the long delays left on menus, tooltips and Mol* cameras, and the spec respell that waits on ADR-238."
---

# Screenshot specs: what is left

Started 2026-10-21 from a scan of the 42K lines under `website/scripts/specs/`
and the generator. Most of the clutter is the app missing a way to say
something, so the larger half of this list is app work.

## Next, each needing a capture A/B on ada

- **The long delays** (`LONG_DELAY_BASELINE`, 87 on 2026-10-26). 46 went on 2026-10-21: 40 ended an action
  list on app work and were deleted, and 6 mid-list became
  `{ type: 'waitForAppSettled' }`. Their 40 figures came out byte-identical
  to a baseline shoot of the parent commit. What stays:
  - Mol\* camera resets, which the app never sees: `protein_variants.ts`
    (`RESET_ZOOM`, `hoverCodon`) and `tp53_nmr_ensemble`
  - hover tooltips (`maf_codon_tooltip`, the circular hovers,
    `rgfa_hover_sync`) and the waits before an action anchored on a graph
    layout (`hprc_haplotype_launch`, `rgfa_hover_sync`)
  - `openFeatureSequence`'s three, the sequence fetch between its clicks
  - form debounces (`sv_inspector_importform_filtered`, the group-by-tag
    preview, `highlight_list_edit_label`) and `search_feature_highlight`
  - menu, dialog and drawer delays, most in `ui.ts`, `synteny.ts`'s import
    forms and `cancer_sv.ts`. The frame gate's settle hold lasts 1 s, longer
    than any MUI transition, so one ENDING an action list is likely deletable
    too; shoot each against a baseline first.

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
