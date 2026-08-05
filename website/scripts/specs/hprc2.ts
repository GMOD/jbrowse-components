import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// HPRC Release 2 (bioRxiv 2026.07.21.739710). The Minigraph-Cactus
// `wave` VCF is the one HPRC2 product a browser can open with no preprocessing at
// all: it ships tabix-indexed beside the graph, and the bucket serves range
// requests with `Access-Control-Allow-Origin: *`, so these figures stream the
// released 2.3 GB file straight off HPRC's S3.
//
// 232 samples, every genotype phased, hence `renderingMode: 'phased'` -> 464
// haplotype rows. Release 2 ships no minigraph/ directory, but its
// Minigraph-Cactus sv.gfa.gz IS rGFA (SR:i:0 on GRCh38#0#chrN), so the graph
// view is not tied to v1.0 -- it needs `assemblyNameToPanSN` because those
// stable names are PanSN. See agent-docs/RGFA_GRAPH_HANDOFF.md.
const CONFIG = 'test_data/hprc2/config.json'

const TRACK = 'hprc2_wave_grch38'

// The MHC window the matrix figures cover: 200 kb of HLA class II/III.
const MHC_WINDOW = 'chr6:32,450,000-32,650,000'

// The wave VCF is fully decomposed, so that window holds 14,321 records and all
// but a couple of hundred are SNPs — 14,000 one-pixel columns of point
// divergence that read as noise (reviewer: "should probably use SV vcf instead
// of snps"). HPRC release 2 publishes no separate SV callset, but the SV tier
// is already in this file: filtering to alleles of 50 bp or more leaves 220
// records over this window, wide enough to see per haplotype. `alleleLength`
// rather than end-start because an insertion consumes no reference — a span
// filter would keep only deletions.
//
// LV is the second half and is not optional. vcfwave decomposed this file (its
// ORIGIN field says so), so a nested child is written as its own record beside
// its parent, PS naming the parent. 22 of those 220 are children of a parent
// that is also in frame, so unfiltered the panel paints those events twice at
// two positions and a reader counting columns counts them twice. LV==0 keeps
// the top-level sites and leaves 198. Every INFO value @gmod/vcf parses is an
// array, including Number=1 fields, hence LV[0].
const SV_FILTER = ['jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50']

// Readiness. The track *name* is a useless gate here — it renders the moment the
// track mounts, long before a byte of the 2.3 GB VCF has been fetched, and
// `waitForDisplayPhases` only means "nothing is loading", which is trivially true
// in the window before the display has entered `loading` at all. So each spec
// waits on its own display wrapper reporting BOTH signals DisplayChrome
// publishes on that element: `-done` (canvasDrawn) and `data-display-phase=ready`
// (the whole fetch finished, not just first paint — an empty canvas flips
// canvasDrawn on its own).
const REGULAR_READY =
  '[data-testid="variant-display-done"][data-display-phase="ready"]'

// A clustered display is ready only once its dendrogram exists AND the reordered
// matrix has repainted. `body:has(dendrogram) <display>` is an AND (a bare `A,B`
// would be a CSS OR and fire on whichever landed first), so this waits for the
// post-clustering frame rather than the pre-clustering one.
const clusteredReady = (base: string) =>
  `body:has([data-testid="tree_sidebar_dendrogram"]) ${base}`

export const hprc2Specs: ScreenshotSpec[] = [
  // The MHC figure: every structural allele (>=50 bp) of the window, one row per
  // haplotype, clustered by genotype so the classical HLA haplotypes fall out of
  // the pangenome alone with no HLA typing involved. `runClustering` runs the
  // real clustering RPC declaratively and `readySelector` waits on the
  // dendrogram, so this stays correct however long clustering takes rather than
  // guessing a delay.
  //
  // The REGULAR multi-sample display, not the matrix (reviewer): 220 SVs at
  // their genomic positions line up with the gene lane above, where matrix mode
  // would spread them evenly across the width and break that correspondence.
  // Matrix mode earns its keep on thousands of tightly-spaced columns, which is
  // exactly what the SV filter removes.
  //
  // A plain LinearVariantDisplay of the SAME calls rides above the haplotype
  // rows (reviewer). The multi-sample display answers "which haplotypes carry
  // it" and says nothing about the call itself; the lane above is one glyph per
  // site, so a column of the matrix has a variant with a width, a type and a
  // popup over it. It is a second track config on the same VCF because a track
  // appears once in a view: same adapter, same jexl filter, so the two lanes
  // cannot disagree about which sites they are showing.
  {
    mode: 'url',
    name: 'hprc2/mhc_clustered',
    url: sessionSpec(CONFIG, {
      // the config declares no gene track, and the reviewer's ask is to see
      // which genes the haplotype blocks sit over
      sessionTracks: [
        {
          type: 'FeatureTrack',
          trackId: 'hg38_ncbiRefSeq_ucsc',
          name: 'NCBI RefSeq genes (hg38)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
                locationType: 'UriLocation',
              },
              indexType: 'CSI',
            },
          },
        },
        {
          type: 'VariantTrack',
          trackId: 'hprc2_wave_grch38_sites',
          name: 'HPRC2 pangenome: structural alleles (>=50 bp)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.wave.vcf.gz',
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: MHC_WINDOW,
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              // five class II genes on one compact row: left to its default the
              // lane spent 145 px of a 780 px frame on ~40 px of glyphs, all of
              // it taken off the matrix, which is what the figure is for
              height: 70,
            },
            {
              trackId: 'hprc2_wave_grch38_sites',
              type: 'LinearVariantDisplay',
              // jexlFiltersSetting, not jexlFilters: on this display family the
              // config slot holds UNPREFIXED expressions and activeFilters()
              // prefixes them on read, so passing the multi-sample display's
              // already-prefixed strings there produces `jexl:jexl:...`
              jexlFiltersSetting: SV_FILTER,
              // NOT collapsed. Collapsed packs every call onto one row, and
              // these calls overlap — a 55 kb allele with dozens of shorter ones
              // inside it came out as one continuous bar, so the lane said
              // "something structural here" and nothing about how many alleles
              // or how big ("hard to tell what is going on with the hprc2
              // structural alleles ... need proper layout i think to see nested
              // features", review). Normal layout stacks them by overlap and
              // `grow` gives the lane however many rows that takes, so a nested
              // allele is drawn inside the span of the one that contains it.
              displayMode: 'normal',
              heightMode: 'grow',
              // Every one of these calls is named for the graph nodes it walks
              // (`>161033067>161046240_24`), so labels on cost more vertical
              // space than the glyphs and say nothing a reader can use. The
              // popup still carries the id.
              showLabels: 'none',
            },
            {
              trackId: TRACK,
              type: 'LinearMultiSampleVariantDisplay',
              // 464 haplotype rows, so height is px per row: at 460 a row was
              // under a pixel and the clustered blocks aliased against each
              // other. This is what the compacted gene lane above frees up.
              height: 515,
              jexlFilters: SV_FILTER,
              runClustering: true,
            },
          ],
        },
      ],
    }),
    readySelector: clusteredReady(REGULAR_READY),
    readyTimeout: 360000,
    viewportWidth: 1200,
    // the gene lane, the SV lane at whatever row count `grow` gives it, the
    // matrix in full, and the view's own bottom edge: at 780 the last haplotype
    // rows ran off the frame, which reads as a clipped track rather than as the
    // bottom of the cohort, and the un-collapsed SV lane added 182 more (the
    // run's own below-the-fold report is what both are measured against, not the
    // PNG)
    viewportHeight: 1092,
    settleMs: 5000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 1150, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
