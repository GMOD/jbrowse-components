---
name: vega-lite-vocabulary
description: "ADR-238's migration of every display's settings to Vega-Lite's words. Landed: the predicate compiler and every filter, the synteny views' mark, axis, coord and data words, the alignments and MAF parts, the color channel (Pass A), the y channel (Pass B), wiggle and Hi-C `data`, the tree sidebar's axis, the pileup's `mark.height`, the comparative `indels` part, the band layers' filters, `pileup.bases.unmodified`, `coverage.alleles.show`, and the feature display's labels parts, `tooltip`, `mark.height` and `representative`. Open: the multi-way mates' attribute filters, and the writers. Read before adding or renaming any display or view setting."
---

# Vega-Lite vocabulary: what is left

[ADR-238](../architecture-decision-records/adr-238-every-display-speaks-vega-lite.md)
holds the end state, amended by
[ADR-240](../architecture-decision-records/adr-240-the-alignments-display-speaks-vega-lite.md)
and [ADR-241](../architecture-decision-records/adr-241-a-color-object-is-unset-a-value-or-a-field.md).
This file orders the work. Claim a step here before starting it.

- A session reshaping a display's settings writes the ADR's spelling, and adds
  no `min*`, `max*`, `show*` or `hide*` setting and no color-object variant.

## Done

Predicate `filter` on every display and view; the synteny views' `mark`,
`coord.ratio`, `axis`, `offscreen`, `render.antialias`, `navigation` and
`data.resolution`; wiggle's and the mark display's `mark` object; the
alignments and MAF `{ show }` parts; the chord displays' `mark.depth`;
Pass A, `encoding.color` on every display with `legend.show` display-wide; and
Pass B, `encoding.y` on every value axis; the feature display's amendment
(labels parts, `tooltip`, `mark.height`, `representative`, `utrs`); and the
wiggle display's `mark.extent` and `encoding.color.field` (ADR-251). Git
history has each landing.

## Next

ADR-238's 2026-10-27 amendment rules the layout words, the multi-way
leftovers and the zoom and density gates. One multi-way gap stays open:
off-screen mate marks honor only the `length` filter, since the worker sends
no attribute lanes with the mates.

## Open from the 2026-10-24 pressure test

Landed on main: predicate missing-value rule, whole-list filter counts,
`range`, emptied entries dropped, opacity `domainMin`/`domainMax`, synteny
`reference` filter, unread-field warnings on synteny, canvas, mark and
multi-sample variant displays, config-doc row paths,
`x2.refName`, VcfFeature site fields, matrix `reverse` by name, Edit plot
filter defaults, type checking in every product, threshold ramp fill,
`span` → `rect`, with ggjbrowse re-pinned and the circular synteny demo
deployed. Still open, each needing no further call:

- **jb2hubs and the graph plugin write main's spellings** (2026-10-26),
  targeting `main` and, once hosted, v5.0.0-beta.18 (jb2hubs' ADR 0002
  amendment and its todo `beta18-joins-host-versions`). The Trix adapter's
  `textSearchAdapterId` and `metaFilePath` stay until the merge lambda
  dedupes on `ixFilePath`.

The cross-display color test is built:
`products/jbrowse-web/src/schemaTests/colorConformance.test.ts` runs one
table of color specs through every display's resolver, and its `EXCEPTIONS`
list names each divergence and can only shrink.

## Writers to update after each landing

- **ggjbrowse:** Its R code, docs and tutorials write every setting above in
  its current spelling. Each rename needs a ggjbrowse engine re-pin, an R
  respell and a tutorial re-knit (memory `a-config-rename-reaches-ggjbrowse`),
  since the closed-schema bundle drops an old key silently. A new key needs
  the re-pin too. The engine and tutorial pin is `d0feecc145`, which writes
  the feature display's amendment. `dog10k_lof` keeps its `557791197f` knit
  until the callset host's certificate is renewed.
- **Figure specs:** `pnpm check-specs` (in `website/`) refuses a key the
  display does not declare, so a rename that misses a spec fails there. A jexl
  filter never trips it: an equality or a bound is a predicate, and the jexl
  ones left are negations, arithmetic and function calls.
- **Tutorials and `demos/` configs:** `pnpm verify --full` and the pre-commit
  config check catch a dead key, and a jexl filter never trips them.
