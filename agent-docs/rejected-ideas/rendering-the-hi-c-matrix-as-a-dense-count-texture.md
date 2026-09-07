---
name: rendering-the-hi-c-matrix-as-a-dense-count-texture
description: Rendering the hi-C matrix as a dense count texture instead of instanced quads
area: performance-and-measurement
---

# Rendering the hi-C matrix as a dense count texture instead of instanced quads

measured 2026-08-13 and declined. The shader is vertex-bound by its
own account (6 verts per ~1.4 px bin, so a full-width triangle emits several
times more vertices than fragments), which argues for rasterizing the counts
into a grid and drawing one quad that inverts the transform per fragment —
the inverse already exists as `hicScreenToData` and hover already trusts it.
The matrix is too sparse. Same file and window: 60,109 contacts over
3,108,771 triangle cells, **1.93% occupancy**, so a dense R32F grid is ~50x
the memory of the sparse instance list it replaces. The auto binsize argument
("bins are ~1.4 px, so texels are screen-sized") holds on the genomic axis and
not on the depth axis, which is compressed a further ~3.3x — the grid is
oversampled ~5.5x against the pixels it feeds.
**What would change the answer:** occupancy, which rises with map depth and
coarser binsizes. Measure it on the target file first; it is one pass over
`getContactRecords` output against `nBins*(nBins+1)/2`.
