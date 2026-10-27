---
name: ggjbrowse-rough-edges
description: Small ggjbrowse defects and layout options left from the 2026-10-11 API and gallery reviews, none checked against ggjbrowse 0.10.0. Read before a ggjbrowse review round, so it does not re-find them.
---

# ggjbrowse rough edges

Each item lives in ggjbrowse's repo and waits on its owner. Re-check one
against ggjbrowse's main before fixing it.

- `inherit.aes = FALSE` drops plot-level aesthetics.
- A join on `features` does not reach `geom_jbrowse_glyphs`' other tables.
- R reads a locus past its contig's end without a warning.
- `width` and `px_per_bp` name one thing twice.
- Printed regions are 0-based.
- Two tracks on different contigs with the same span stack under one label.
- At 1 px a row the browser blends a bar into a tint; R draws its height within
  the row, which reads as fine stripes.
- The strand facet could stack every section's coverage above every section's
  reads, the old R layout, as an option in both apps.
- R stacks multi-way lanes `MULTIWAY_GUTTER_PX` (100) apart with its own
  ruler and box rows, but the engine decides each ribbon's `thin` and fade at
  the display's geometry over `display.height`. The multiway table returns
  that geometry (`height`, `lanes.yTop`/`yBottom`, `ribbons.yTop`/`yBottom`,
  px down from the stack's top), so `multiway_on_axis()` can draw at
  `height - y` and drop its three constants. That changes every multi-way
  figure, so it wants a look at the gallery before and after.
- The `dog10k_lof` tutorial page was not re-knit at the 2026-10-23 pin: its
  callset host, kiddlabshare.med.umich.edu, serves an expired TLS certificate,
  so the knit and ggjbrowse's Docs CI fail on it. Re-knit it with ggjbrowse's
  tutorials script, naming `dog10k_lof`, once the certificate is renewed.
