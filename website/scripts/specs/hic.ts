import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// ENCODE GM12878 chromatin interactions rendered as arcs over the intact Hi-C
// contact matrix (test_data/encode_hic_loops.json). The config's own
// defaultSession opens, at chr1:202.9-203.8Mb, an NCBI RefSeq gene track, the
// HiCCUPS loop calls (ENCFF560LOS) and EPIraction enhancer-gene links
// (ENCFF266FGY) as LinearPairedArcDisplay arcs, and the .hic matrix
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
    settleMs: 20000,
    viewportHeight: 950,
  },
]
