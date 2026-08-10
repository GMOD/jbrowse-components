import { displayPainted } from '@jbrowse/browser-test-utils'

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
//
// 9 Mb, widened from 5.2 (review: "zoom out a bit more to see context"). The
// inversion is MAT 7,822,846-11,688,252, so this is the event plus ~2.5 Mb of
// collinear flank each side rather than ~0.6, centred on the event's own
// midpoint rather than on a round number. The flank is the control, so more of
// it is more control: at 5.2 Mb the crossing reached the frame edge on the left
// and a reader had to take the "and nothing else moved" on faith.
const INVERSION_RANGE = '5,250,000-14,250,000'
const INVERSION_WINDOW_MAT = `chr8_MATERNAL:${INVERSION_RANGE}`
const INVERSION_WINDOW_PAT = `chr8_PATERNAL:${INVERSION_RANGE}`

// GENES, WHICH THE DEMO CONFIG DOES NOT CARRY (review, on both figures: "if
// possible, show gene tracks too. not sure if available, but would be cool").
// They are available, from the Q100 project's own S3 beside the assembly, and
// they need no rehosting: the JHU Liftoff v0.6 annotation ships one bgzipped
// GFF per haplotype with a `.tbi`, contig names that already match
// (`chr8_MATERNAL`), a `gene_name` attribute, and `Access-Control-Allow-Origin:
// *` on ranged reads. Session tracks rather than config tracks, so nothing has
// to be deployed to jbrowse.org/demos/hg002/config.json for a figure to use
// them.
//
// THEY ARE v1.1 COORDINATES ON A v1.2 ASSEMBLY, which is worth knowing and is
// why the track names say v1.1. There is no v1.2 gene annotation published --
// the annotation directory has v1.2 hetsites, microsatellites and chains and
// no genes. What the version gap costs was measured off the published
// `hg002v1.1_to_hg002v1.2.chain.gz` (47 chains, one per contig, no
// rearrangement in any of them): summing dq-dt along each chain, the largest
// cumulative shift anywhere in the genome is 6,115 bp on chr6_MATERNAL and
// every other contig is under 70 bp. On chr8 it is 1-3 bp across both windows
// here, which is a third of a pixel at the base-level figure and invisible at
// the 9 Mb one. A proper lift would need the GFF re-emitted and hosted; at this
// magnitude that buys nothing these two figures can show.
const GENE_TRACK_BASE =
  'https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/JHULiftoff/v0.6/hg002v1.1'

function geneTrack(hap: 'MAT' | 'PAT') {
  const uri = `${GENE_TRACK_BASE}.${hap}.loff.v0.6.gff.gz`
  return {
    type: 'FeatureTrack',
    trackId: `hg002_genes_${hap.toLowerCase()}`,
    name: `Genes (JHU Liftoff v0.6, HG002 v1.1 ${hap})`,
    assemblyNames: ['hg002v1.2'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri, locationType: 'UriLocation' },
      index: {
        location: { uri: `${uri}.tbi`, locationType: 'UriLocation' },
        indexType: 'TBI',
      },
    },
    // LABEL FROM `gene_name`, NOT FROM THE ID. The Liftoff GFF carries no
    // `Name`, so the default `name || id` falls through to the assembly's own
    // ordinal identifier and the lane draws `hg002_chr8_maternal_195` where the
    // gene is ENPP7P1 -- true, and useless as a label. `gene_name` is on every
    // gene record (the README's own ID scheme keeps the HUGO symbol in it).
    //
    // It goes on the TRACK's display config rather than as an inline key on the
    // session spec's `tracks` entry: `labels` is a sub-schema, not a slot, so
    // the `setSlot` pass that folds inline keys onto the display would skip it
    // silently.
    displays: [
      {
        type: 'LinearBasicDisplay',
        displayId: `hg002_genes_${hap.toLowerCase()}-LinearBasicDisplay`,
        labels: {
          name: "jexl:get(feature,'gene_name') || get(feature,'name') || get(feature,'id')",
        },
      },
    ],
  }
}

// The panel entry for one haplotype's gene lane. `geneGlyphMode:
// 'longestCoding'` collapses the isoform stack -- the Liftoff annotation
// carries every RefSeq transcript, and this is a context lane, not a
// transcript figure.
function geneLane(hap: 'MAT' | 'PAT', extra: Record<string, unknown> = {}) {
  return {
    trackId: `hg002_genes_${hap.toLowerCase()}`,
    type: 'LinearBasicDisplay',
    geneGlyphMode: 'longestCoding',
    ...extra,
  }
}

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

type PanelTracks = (string | Record<string, unknown>)[]

// A panel with no tracks draws a centered "No tracks active" chip and an OPEN
// TRACK SELECTOR button, which in a two-row frame outweighs the ribbons the
// figure is about. Each panel therefore carries the chain blocks on its OWN
// haplotype's coordinates -- and that is the SAME SyntenyTrack the ribbons come
// from, not a second file. In a plain LGV a SyntenyTrack draws as
// LGVSyntenyDisplay (the only display registered for that pair), whose colorBy
// already promotes to `strand`, so this needs no display config at all.
//
// It resolves per panel because the published chain carries BOTH directions:
// every alignment appears once with the maternal contig as query and once with
// the paternal one, so the maternal panel's fetch returns the mat-as-query
// records and the paternal panel's the pat-as-query records. That is exactly
// the split the mat2pat / pat2mat bigChain pair used to provide, from one file
// instead of two, which is also what stops the blocks and the ribbons from
// disagreeing. Nine records either side across this window, against a het-site
// track that is orders of magnitude over the feature gate here.
// At 5.2 Mb the CIGAR layer buries the thing this lane is for: a whole-genome
// chain carries indels every few kb, and they draw as a wall of ticks over the
// strand color. The blocks and their boundaries are what the page reads off
// these lanes. (`showInterbaseIndicators` is NOT the other half of this: those
// marks live in the coverage band, which this display defaults off, so setting
// it here changes nothing.)
const CHAIN_BLOCKS = {
  trackId: 'hg002v1.2_mat_vs_pat',
  height: 40,
  showMismatches: false,
}

function haplotypeSession(
  matLoc: string,
  patLoc: string,
  matTracks: PanelTracks = [],
  patTracks: PanelTracks = matTracks,
) {
  return sessionSpec(HG002_CONFIG, {
    sessionTracks: [geneTrack('MAT'), geneTrack('PAT')],
    views: [
      {
        type: 'LinearSyntenyView',
        // strand is the whole point here: it is what makes the inverted block
        // the one sweep crossing an otherwise same-color frame
        colorBy: 'strand',
        drawCurves: true,
        tracks: [['hg002v1.2_mat_vs_pat']],
        views: [
          { assembly: 'hg002v1.2', loc: matLoc, tracks: matTracks },
          { assembly: 'hg002v1.2', loc: patLoc, tracks: patTracks },
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
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 120000,
  settleMs: 10000,
} satisfies Partial<ScreenshotSpec>

export const hg002HaplotypeSpecs: ScreenshotSpec[] = [
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_8p23_inversion',
    url: haplotypeSession(
      INVERSION_WINDOW_MAT,
      INVERSION_WINDOW_PAT,
      // Genes under the chain blocks on each side. At 9 Mb across 1400 px
      // (~6.4 kb/px) a label is not readable and a whole isoform stack is a
      // mat, so this is the density lane: longest coding isoform, no labels,
      // one row deep enough to pack. What it is here for is the context the
      // review asked for -- the inverted segment is ordinary gene-carrying
      // euchromatin, not a blank block that happened to flip.
      [CHAIN_BLOCKS, geneLane('MAT', { showLabels: 'none', height: 60 })],
      [CHAIN_BLOCKS, geneLane('PAT', { showLabels: 'none', height: 60 })],
    ),
    viewportHeight: 640,
  },
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_hetsites',
    url: haplotypeSession(
      COLLINEAR_WINDOW_MAT,
      COLLINEAR_WINDOW_PAT,
      // 70 kb, so here the genes ARE readable, and each panel gets its own
      // haplotype's annotation: the point of the figure is that two panels
      // agreeing structurally still differ base by base, and a gene lane per
      // side says which genes those bases are in.
      [
        geneLane('MAT', { displayMode: 'compact', height: 60 }),
        {
          trackId: 'hg002v1.2_hetsites',
          // each site's name is its own coordinate and alleles
          // (chr8_PATERNAL_7653684_C_T_F), so labels here are the coordinate
          // written twice -- once on the ruler and once over the feature --
          // and they cover the track at this density
          showLabels: 'none',
          height: 70,
        },
      ],
      [
        geneLane('PAT', { displayMode: 'compact', height: 60 }),
        {
          trackId: 'hg002v1.2_hetsites',
          showLabels: 'none',
          height: 70,
        },
      ],
    ),
    viewportHeight: 700,
  },
]
