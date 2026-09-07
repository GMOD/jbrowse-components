---
name: a-step-list-under-each-video-tutorial-generated-from-the
description: A step list under each video tutorial, generated from the specs' `say` lines
area: tooling-tests-and-docs
---

# A step list under each video tutorial, generated from the specs' `say` lines

costed 2026-08-18 and declined as duplication. The argument for it is
good: `website/CLAUDE.md` says a still is searchable and a clip is not, the
`say` overlays are authored text that exists only as pixels once filmed, and
`gen-live-links` already carries spec data into the site, so the list would
cost one generated field and no re-filming. What kills it is the page above the
embed. Matched case- and wrap-insensitively, 51 of the 74 `say` lines across
the 14 videos appear verbatim in the prose of the page that embeds them —
`tcga_cohort_cnv.md` prints **Clustering → Cluster rows by similarity** from
the track menu three paragraphs above a clip whose three lines are exactly
that. The other 23 are mostly the same step in different words (`Right-click
CDH1`, where the page says to right-click the gene) or narration rather than
route (`An intronic position maps to no residue`). So the list would restate
the paragraph a reader has just read, which is the caption rule ("say what the
picture cannot") applied one element down.
What would earn it is TIMESTAMPS, turning the list into a way back into the
clip — and those are the part the specs do not have. `generate-video` stitches
the film out of per-stretch segments with the `cut` waits removed, so clip time
is on-camera elapsed time and nothing accumulates it. Recording it per `say` is
the prerequisite for both this and the caption track `media-store.ts` says is
next; do that first, and re-cost.
