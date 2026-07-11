import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// ENCODE GM12878 chromatin loops rendered as arcs over the intact Hi-C contact
// matrix (test_data/encode_hic_loops.json). The config's own defaultSession
// opens on a ~2Mb window (chr3:121.6-123.6Mb) so the HiCCUPS loops (ENCFF560LOS)
// read against the broader TAD structure and each arc's contact reads as an
// off-diagonal dot in the matrix directly below it; two `init.highlight` bands
// label the PARP9/PARP14 promoter anchors. The .hic matrix (ENCFF484NFB) uses
// useLogScale so the loop dots read above the diagonal. The enhancer-gene
// prediction track is intentionally left out — the figure is just the Hi-C
// matrix and the loops called from it. The ENCODE files stream from the
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
    annotations: [
      {
        type: 'text',
        // open right area of the loops track, clear of the arc apex
        x: 960,
        y: 300,
        maxWidth: 330,
        fontSize: 16,
        text: 'HiCCUPS loops (arcs, top) are the off-diagonal dots in the contact matrix below.',
      },
    ],
  },
]
