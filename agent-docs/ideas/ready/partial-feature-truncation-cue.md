---
name: partial-feature-truncation-cue
description: NCBI eukaryote GFFs mark truncated annotations with partial=true and start_range/end_range, and JBrowse draws them with an ordinary square cap. A ragged cap on the open end is a full vertical slice — a worker-derived open-end flag, a packed byte, a slang cap and its Canvas2D twin.
---

# A cue for a partial feature's open end

Split out of the data-formats collection on 2026-09-27.

NCBI eukaryote GFFs pervasively mark
incomplete annotations with `partial=true` plus `start_range=.,N` / `end_range=N,.`
(a `.` on the open side) — a gene/mRNA/CDS whose true boundary runs off the
assembled sequence or past an assembly gap. Today these render with an ordinary
square cap, so a biologically truncated feature looks identical to a complete one
and the "this is partial" signal is silently dropped. Cue: draw a ragged/open
(zig-zag or feathered) cap on the open end(s) — only the end flagged `.` gets it,
so a 5'-partial gene is ragged on the left only. Cost is a full vertical slice, not
a tweak: the **worker** reads the attrs in `RenderFeatureDataRPC` and derives a
per-feature 2-bit open-end flag (5'/3', strand-corrected); that flag is threaded
through the **packed render arrays** as a new per-feature byte (mind the
byte-offset/UBO layout invariants called out in CLAUDE.md and
`featureGlyphShapes.ts`); and the **glyph** draws the open cap in a new
`.slang` source (run `pnpm gen:shaders`, never hand-edit `*.generated.ts`) with a
matching Canvas2D fallback path. Worth a dedicated task with browser verification
on a real NCBI eukaryote GFF (e.g. a partial gene near a contig edge) before
sweeping the shader/packing layers. Companion to the gff-nostream parser fix that
stopped dropping top-level discontinuous features (cDNA_match/EST_match).
