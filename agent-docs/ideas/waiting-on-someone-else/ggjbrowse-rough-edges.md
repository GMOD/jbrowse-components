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
