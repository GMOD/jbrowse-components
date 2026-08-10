import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// T2T-HG002 v1.2 ships both haplotypes as contigs of ONE assembly
// (chr1_MATERNAL, chr1_PATERNAL, ...), so comparing them is a self-alignment:
// two panels of the same assembly, framed on the two haplotypes of a
// chromosome. The demo config carries the Q100 project's own maternal-to-
// paternal chain, so nothing here is aligned by us.
const HG002_CONFIG = 'https://jbrowse.org/demos/hg002/config.json'

// The 8p23.1 inversion, the largest inverted chain in that file by about five
// times (the next is 747 kb on chr7, of 493 inverted chains genome-wide). Read
// off the chain rather than off a paper:
//
//   chr8_MATERNAL:7,822,846-11,688,252  (-)  <-> chr8_PATERNAL:7,774,085-11,631,556
//
// flanked by collinear (+) blocks on both sides. Note the chain's `-` strand
// query coordinates are REVERSE-COMPLEMENT: reading qStart directly puts this
// near 135 Mb, on the wrong arm, which is the easiest way to get this locus
// wrong. The published polymorphism is a 3.8-4.5 Mb segment between the REPD
// and REPP duplication blocks; HG002 is heterozygous for it, which is the only
// reason it is visible in a maternal-vs-paternal comparison at all.
//
// The window is the inversion plus enough flank that the collinear blocks
// either side are in frame. That is the figure's own control: an inversion is
// only legible as one because the sequence around it did not move. Both panels
// take the SAME coordinates here, which is what makes the crossing read as a
// crossing; the collinear pair below deliberately does not.
//
// "Collinear flank" is true at this scale and not below it: a 38 kb inverted
// chain sits at MAT 7,568,742-7,606,984 and a 12 kb one at 12,035,255-12,047,327,
// and both draw as thin off-color threads among the flank ribbons. The page
// says so rather than claiming one off-strand block in frame.
const INVERSION_RANGE = '7,300,000-12,500,000'
const INVERSION_WINDOW_MAT = `chr8_MATERNAL:${INVERSION_RANGE}`
const INVERSION_WINDOW_PAT = `chr8_PATERNAL:${INVERSION_RANGE}`

// The base-level half of the comparison, and the figure that keeps the one
// above honest: a window inside the COLLINEAR block just left of the inversion,
// where the ribbon is one band (bar a single indel wedge) and the het sites
// underneath it are what separate the haplotypes. Structural agreement and
// sequence identity are different claims, and this is the frame that shows the
// second one failing where the first one holds.
//
// It has to be its own figure for two reasons. The 5.2 Mb inversion frame is
// over the het track's too-many-features gate, so the track renders a warning
// there rather than data. And a window ON the breakpoint cannot work at all:
// the flank maps to chr8_PATERNAL ~7.6 Mb while the inverted side maps to
// ~11.6 Mb, so no single paternal window contains both and the ribbons come
// back empty -- which is what the first attempt at this figure did.
//
// Paternal coordinates are the maternal ones through the collinear block's own
// offset (MAT 7,618,894-7,822,846 -> PAT 7,475,532-7,681,207, so -143,362),
// which is what puts the same sequence in both panels.
const COLLINEAR_WINDOW_MAT = 'chr8_MATERNAL:7,700,000-7,770,000'
const COLLINEAR_WINDOW_PAT = 'chr8_PATERNAL:7,556,638-7,626,638'

function haplotypeSession(
  matLoc: string,
  patLoc: string,
  panelTracks: (string | Record<string, unknown>)[] = [],
) {
  return sessionSpec(HG002_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        // strand is the whole point here: it is what makes the inverted block
        // the one sweep crossing an otherwise same-color frame
        colorBy: 'strand',
        drawCurves: true,
        tracks: [['hg002v1.2_mat_vs_pat']],
        views: [
          { assembly: 'hg002v1.2', loc: matLoc, tracks: panelTracks },
          { assembly: 'hg002v1.2', loc: patLoc, tracks: panelTracks },
        ],
      },
    ],
  })
}

// Both frames wait on the same synteny-canvas signal and pay the same remote
// fetch (a whole-genome chain read in one go), so the capture settings are
// shared and only the viewport height differs.
const CAPTURE = {
  mode: 'url',
  viewportWidth: 1400,
  readySelector: '[data-testid="synteny_canvas_done"]',
  readyTimeout: 120000,
  settleMs: 10000,
} satisfies Partial<ScreenshotSpec>

export const hg002HaplotypeSpecs: ScreenshotSpec[] = [
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_8p23_inversion',
    url: haplotypeSession(INVERSION_WINDOW_MAT, INVERSION_WINDOW_PAT),
    viewportHeight: 460,
  },
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_hetsites',
    url: haplotypeSession(COLLINEAR_WINDOW_MAT, COLLINEAR_WINDOW_PAT, [
      {
        trackId: 'hg002v1.2_hetsites',
        // each site's name is its own coordinate and alleles
        // (chr8_PATERNAL_7653684_C_T_F), so labels here are the coordinate
        // written twice -- once on the ruler and once over the feature -- and
        // they cover the track at this density
        showLabels: 'none',
        height: 70,
      },
    ]),
    viewportHeight: 502,
  },
]
