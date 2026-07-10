import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// ENCODE GM12878 chromatin interactions rendered as arcs over the intact Hi-C
// contact matrix (test_data/encode_hic_loops.json). The config's own
// defaultSession opens at chr3:122.30-122.92Mb, over the PARP9–DTX3L–PARP14
// interferon-stimulated gene cluster — a locus where the biology and the 3D
// contacts line up: a strong HiCCUPS loop (ENCFF560LOS) brings the PARP9/DTX3L
// promoter region into contact with PARP14 (co-regulated ISGs, active in this
// EBV-transformed B-lymphoblastoid line), its corner dot visible in the matrix,
// and an EPIraction enhancer–gene link (ENCFF266FGY) points at PARP9. Tracks:
// NCBI RefSeq genes (showOnlyGenes, showDescriptions:false so the glyph row
// stays a clean anchor reference), the two arc tracks, and the .hic matrix
// (ENCFF484NFB). All three ENCODE files stream from the encode-public S3 bucket
// (CORS-enabled), so no session override is needed — a bare `?config=` both
// captures locally and opens as a live jbrowse.org instance.
//
// Loading pulls remote ENCODE data (the matrix issues many range requests), so
// the readiness gate and settle are generous; waitForDisplaysDone still blocks
// on the arc tracks' `arc-display-done` testid and the matrix canvas.
export const hicSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'encode_hic_loops_arcs',
    url: '?config=test_data/encode_hic_loops.json',
    readySelector: '[data-testid="arc-display-done"]',
    readyTimeout: 90000,
    // the intact Hi-C matrix issues many range requests and picks a coarser
    // resolution at this ~620 kb window; give it long enough to fill the
    // triangle (not just the diagonal) before capture
    settleMs: 32000,
    viewportHeight: 950,
  },
]
