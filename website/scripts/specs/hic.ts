import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// ENCODE GM12878 chromatin interactions rendered as arcs over the intact Hi-C
// contact matrix (test_data/encode_hic_loops.json). The config's own
// defaultSession opens tight (chr3:122.48-122.78Mb) so the one strong HiCCUPS
// loop (ENCFF560LOS) joins two promoter anchors ~125kb apart and the SAME
// contact reads as the off-diagonal corner dot in the matrix directly below the
// arc apex; two `init.highlight` bands label the anchors. The .hic matrix
// (ENCFF484NFB) uses useLogScale + resolutionBias:3 so the loop dot reads above
// the diagonal at this zoom. All three ENCODE files stream from the
// encode-public S3 bucket (CORS-enabled), so no session override is needed — a
// bare `?config=` both captures locally and opens live on jbrowse.org.
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
    // the intact Hi-C matrix issues many range requests at this ~300 kb window;
    // give it long enough to fill the triangle (not just the diagonal) before
    // capture
    settleMs: 32000,
    viewportHeight: 950,
  },
]
