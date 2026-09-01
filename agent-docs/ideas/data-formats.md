---
name: data-formats
description: Partial-feature cues, circular genomes.
---

# Data formats

**Partial-feature truncation cue.** NCBI eukaryote GFFs pervasively mark
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
`GpuCanvasFeatureRenderer.ts`); and the **glyph** draws the open cap in a new
`.slang` source (run `pnpm gen:shaders`, never hand-edit `*.generated.ts`) with a
matching Canvas2D fallback path. Worth a dedicated task with browser verification
on a real NCBI eukaryote GFF (e.g. a partial gene near a contig edge) before
sweeping the shader/packing layers. Companion to the gff-nostream parser fix that
stopped dropping top-level discontinuous features (cDNA_match/EST_match).

**Circular genomes / origin-spanning features.** NCBI GFF3 encodes a feature that
crosses the origin of a circular replicon as a single line whose `end` runs past
the sequence length into "virtual space" (and flags the landmark with
`Is_circular=true`) — common in the bacterial/organellar/viral genomes we serve
from jb2hubs. Today this misrenders three ways: the feature draws into virtual
space past the contig end (best case clipped at the displayed-region edge); the
wrapped portion is unreachable at the origin (its tabix-indexed start sits near
the contig end, so a `0..N` query never returns it — and redispatch only expands
to bounds of features *already found*); and there's no topology flag anywhere in
core (`Region` is `refName/start/end/reversed` only; assembly/refseq have no
`isCircular`; the parsed `Is_circular` is inert; the circular-view plugin is a
chord diagram, not a feature viewer). Two architectures: **(B) a true circular
(polar) viewer** — biologically honest but a whole new rendering + GPU-layout
stack; the chords-only circular-view is not a starting point. **(A)
repeated-linear concatenation (recommended)** — the key unlock is that
`displayedRegions` *already is* linear concatenation (LGV space sums `Region[]`
end-to-end, each region carrying true coords), so listing the contig twice gives
the `2L` space, scroll-through-origin, and true-coordinate location box/search
*for free*. Seam-abutment: region1 `chr:0-L` + region2 `chr:0-L` with zero
`interRegionPadding` makes a `[L-1200, L+1200]` gene draw as `[L-1200,L]` +
`[0,1200]` halves that *touch* at the seam and read continuous (the one
unsolvable bit is a connector line crossing the seam — JBrowse never lays out one
glyph across a region boundary). The only real new code is a **circular adapter
decorator** (parameterized by `L`): re-emit any feature with `end > L` as two
halves, issue a modular wrap-fetch of `[L-margin, L]` when querying near the
origin (same muscle as `readTabixLinesRedispatched` in `packages/core/src/util/tabix.ts`), and key both halves
by canonical `pos mod L` so copies/halves reconcile. De-risk cheaply: **Step 0 is
zero code** — hand-set displayedRegions to the contig twice with seam padding
zeroed on pneumobrowse to eyeball the UX before building the decorator. Confirm
first whether jb2hubs has origin-*spanning features* or just `Is_circular`
contigs with no crossing genes (if the latter, this is purely a cosmetic origin
marker).

