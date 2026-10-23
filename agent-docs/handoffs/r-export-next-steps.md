---
name: r-export-next-steps
description: "The R script export (view menu → Export R script, plugins/linear-genome-view/src/LinearGenomeView/rExport/) is a doorway to ggjbrowse: reader calls plus one jbrowse_stack(). On main. Open: the ggjbrowse vignette, release and first R users, real-data checks, ggjbrowse matching a bare contig name through the engine's canonical names, and the export passing color_by_cds, amino_acids and band titles."
---

# R export: what is left

The export writes a short script of ggjbrowse reader calls
and one `jbrowse_stack()`; [R_EXPORT.md](../reference/R_EXPORT.md) has where
the code is, what it reads and the settled decisions, and
`website/docs/user_guides/r_export.md` is the user-facing page. ggjbrowse is
the product and the export a doorway to it (Colin, 2026-10-11); in-browser R is
not wanted.

## Next, in order

1. **ggjbrowse for its first users:** a vignette built from ggjbrowse's
   figures script and its README gallery, a tagged release once
   `@jbrowse/tables` publishes, an r-universe build so V8 installs as a
   binary, then two or three R users with their own tracks.
2. **Real data:** an hg38 BAM at a deep locus, a CRAM, a ten-track session.
3. **ggjbrowse names a whole contig by its alias:** on ggjbrowse's main,
   `parsed_regions()` matches a bare name against the file's contigs as
   typed, so `12` for a file spelling it `chr12` is refused while the locus
   `12:1-100` reads. The engine gives `fileRegions` and `regions` a
   `canonical` column and `canonicalNames({ assembly, refNames })`
   (TABLES.md). ggjbrowse's unmerged `engine-calls` branch matches a name's
   canonical against the contigs', and lands with the next bundle.

## Export side

- `jbrowse_features()` takes `color_by_cds =` and `amino_acids =`. The export
  passes neither, so a feature track's CDS coloring and amino acids drop.
- `jbrowse_stack()` titles its bands from named arguments; the export writes
  `jbrowse_stack(a, b)`.
- The menu label reads "Export R script"; "(beta)" is Colin's call.

Small ggjbrowse defects:
[ideas/waiting-on-someone-else/ggjbrowse-rough-edges.md](../ideas/waiting-on-someone-else/ggjbrowse-rough-edges.md).
