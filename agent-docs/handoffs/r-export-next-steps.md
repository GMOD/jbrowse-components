---
name: r-export-next-steps
description: "The R script export (view menu → Export R script, plugins/linear-genome-view/src/LinearGenomeView/rExport/) is a doorway to ggjbrowse: reader calls plus one jbrowse_stack(). On main. Open: the ggjbrowse vignette, release and first R users, and real-data checks."
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
   figures script and its README gallery, a tagged release (its
   blocker, `@jbrowse/tables`, is on npm as 5.0.0-beta.13), an r-universe build so V8 installs as a
   binary, then two or three R users with their own tracks.
2. **Real data:** an hg38 BAM at a deep locus, a CRAM, a ten-track session.

## Export side

- The menu label reads "Export R script"; "(beta)" is Colin's call.

Small ggjbrowse defects:
[ideas/waiting-on-someone-else/ggjbrowse-rough-edges.md](../ideas/waiting-on-someone-else/ggjbrowse-rough-edges.md).
