import { displayPainted } from '@jbrowse/browser-test-utils'

import { PARK_CURSOR, sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, local, referencePositionColor } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// hg38 NCBI RefSeq (UCSC hub build, jbrowse.org/ucsc/hg38) as a session track —
// reviewer's preferred gene track over the MANE bigBed in a few figures.
// geneGlyphMode: 'longestCoding' on the display collapses isoforms the way
// MANE Select did.
export const HG38_NCBI_GENE_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ncbi_genes_hg38_ucsc',
  name: 'NCBI RefSeq (UCSC)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: {
      uri: 'https://jbrowse.org/ucsc/hg38/hg38.gff.gz',
      locationType: 'UriLocation',
    },
    index: {
      location: {
        uri: 'https://jbrowse.org/ucsc/hg38/hg38.gff.gz.csi',
        locationType: 'UriLocation',
      },
      indexType: 'CSI',
    },
  },
}

// Thin local config wiring the ce11 assembly + the real UCSC ce11 26-way multiz
// MAF (data hosted on jbrowse.org/demos/ce + UCSC) to the *built-in* MAF
// support. The jbrowse.org/demos/ce config itself loads the old external
// mafviewer UMD plugin, which would shadow the built-in conservation band and
// trip the cross-origin-plugin trust dialog — so a local config path is used to
// render with the local build's code instead.
export const CE_MAF = 'test_data/ce_maf.json'

// Same ce11 26-way MAF, plus an `annotationAdapter` sub-adapter (a local bigBed
// built from the real UCSC ce11 multiz26wayFrames data) on the MAF adapter, so
// the per-species CDS reading-frame overlay + codon view render.
export const CE_MAF_FRAMES = 'test_data/ce_maf_frames.json'

// UCSC hg38 470-way multiz (Zoonomia + more) config.
export const HG38_470WAY = 'test_data/hg38_multiz470way.json'

// A representative ~30-species slice of the hg38 470-way spanning the major
// mammalian clades (primates, rodents+glires, laurasiatheria, afrotheria,
// xenarthra) plus opossum and platypus as marsupial/monotreme outgroups — close
// to the classic UCSC "30-way vertebrate" sampling. Exact leaf names from
// hg38.470way.nh (the Cactus alignment uses HL-prefixed names for many
// assemblies). Used as a `subtreeFilter`; the pruned guide tree then reads as a
// clean ~30-leaf dendrogram instead of the full 470-species tree.
export const HG38_470WAY_30 = [
  'hg38', // human
  'panTro6', // chimp
  'gorGor6', // gorilla
  'ponAbe3', // orangutan
  'rheMac10', // rhesus macaque
  'HLcalJac4', // marmoset
  'otoGar3', // bushbaby
  'mm39', // mouse
  'rn6', // rat
  'cavPor3', // guinea pig
  'hetGla2', // naked mole-rat
  'oryCun2', // rabbit
  'tupBel1', // tree shrew
  'bosTau9', // cow
  'HLoviAri5', // sheep
  'susScr11', // pig
  'vicPac2', // alpaca
  'turTru2', // dolphin
  'equCab3', // horse
  'cerSim1', // white rhino
  'felCat9', // cat
  'canFam4', // dog
  'ursMar1', // polar bear
  'myoLuc2', // little brown bat
  'eriEur2', // hedgehog
  'HLloxAfr4', // elephant
  'echTel2', // tenrec
  'oryAfe1', // aardvark
  'dasNov3', // armadillo
  'monDom5', // opossum
  'HLornAna3', // platypus
]

// MANE Select (v1.4, RefSeq/NCBI) as a session track: one curated transcript
// per gene, so the GAPDH exon/CDS structure lines up above the 470-way heatmap
// without the isoform clutter of the full RefSeq set. The hg38 assembly in the
// 470way config carries refNameAliases, so this chr-named BigBed aligns to the
// numeric ('12') MAF refnames.
const HG38_MANE_TRACK = {
  type: 'FeatureTrack',
  trackId: 'mane_hg38',
  name: 'MANE Select 1.4 (NCBI RefSeq)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigBedAdapter',
    bigBedLocation: {
      uri: 'https://jbrowse.org/genomes/GRCh38/mane/MANE.GRCh38.v1.4.refseq.bb',
      locationType: 'UriLocation',
    },
  },
}

// maf_470way swaps in HG38_NCBI_GENE_TRACK (jbrowse.org/ucsc/hg38 hub build)
// below, in place of the MANE bigBed — per reviewer ask. Same chr-named
// refnames resolved via the 470way config's refNameAliases.

// ce11 NCBI RefSeq (curated) genes as a session track (hosted at jbrowse.org/ucsc,
// generated from UCSC), so the C. elegans maf figures carry gene context. Chrom
// names are chrI/chrII/... matching the maf's roman-numeral refnames.
const CE11_GENE_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ce11_ncbi_refseq',
  name: 'NCBI RefSeq genes (ce11)',
  assemblyNames: ['ce11'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: {
      uri: 'https://jbrowse.org/ucsc/ce11/ncbiRefSeqCurated.gff.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'CSI',
      location: {
        uri: 'https://jbrowse.org/ucsc/ce11/ncbiRefSeqCurated.gff.gz.csi',
        locationType: 'UriLocation',
      },
    },
  },
}

// The rows maf_hprc_pangenome draws, out of the alignment's 464. Sixteen
// samples, both haplotypes each, in the order the callset lists them, plus the
// reference. Not a curated set: nothing about C4 picks these, and saying "the
// first sixteen" is honest where "a representative selection" would not be.
//
// `<sample>.<haplotype>` is what the display calls a row here. The TAF's source
// tokens are `HG00235.2.CM094400.1` and parseAssemblyAndChr keeps a numeric
// second field with the genome, so the haplotype is part of the row name and
// the contig is the rest. The sample ids come from the wave VCF's own header
// (the same 232 samples), not from a hand-typed list.
const HPRC_MAF_ROWS = [
  'GRCh38',
  'CHM13.1',
  'CHM13.2',
  'HG00097.1',
  'HG00097.2',
  'HG00099.1',
  'HG00099.2',
  'HG00126.1',
  'HG00126.2',
  'HG00128.1',
  'HG00128.2',
  'HG00133.1',
  'HG00133.2',
  'HG00140.1',
  'HG00140.2',
  'HG00146.1',
  'HG00146.2',
  'HG002.1',
  'HG002.2',
  'HG00232.1',
  'HG00232.2',
  'HG00235.1',
  'HG00235.2',
  'HG00253.1',
  'HG00253.2',
  'HG00280.1',
  'HG00280.2',
  'HG00290.1',
  'HG00290.2',
  'HG00320.1',
  'HG00320.2',
  'HG00321.1',
  'HG00321.2',
]

// The C4 window maf_hprc_pangenome opens, as the two shapes the session needs:
// a locus for the linear view and a region for the subgraph the graph pane cuts.
// One pair of numbers, because the reference-position ramp below is a function
// of the graph's own loadedRegion — a second copy is how a block above and a
// node below come out different colors for the same bp.
const HPRC_C4_LOCUS = 'chr6:31,972,057-32,055,418'
const HPRC_C4_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 31972056,
  end: 32055418,
}

// CYP21A1P and TNXA, the pseudogene pair of the second RCCX module. Marked
// because it is the span the alignment rows disagree about: read off the drawn
// figure, seven of the thirty-two haplotypes have no aligned sequence there,
// one each of HG00099, HG00280, HG00290, HG00320 and HG00321 and both of
// HG00146. A band there crosses the genes, the segments and the callset in one
// column.
const HPRC_C4_MARKED = 'chr6:32,005,691-32,011,057'

// The alignment itself, as a session track over the graph config: the fixture
// the graph figures load carries the graph, the callset and the genes, and the
// MAF is the one product of release 2 it has no track for. Same four fields the
// tutorial's own fence prints.
const HPRC_MAF_TRACK = {
  type: 'MafTrack',
  trackId: 'hprc_v2_0_mc_grch38',
  name: 'HPRC release 2 pangenome alignment (464 haplotypes)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BgzipTaffyAdapter',
    uri: 'https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz',
  },
}

// UNFILTERED, where every other HPRC figure on the page cuts the callset to
// `LV==0 && alleleLength>=50`, and both halves of that filter were measured out
// of this frame rather than dropped by preference.
//
// The size half empties the lane: C4 is a copy-number locus, minigraph
// collapses what it rearranges, and the structural tier captured here as one
// grey block with a single insertion in it.
//
// The `LV==0` half puts a BLANK COLUMN in the middle of the lane, and that is
// the trap worth recording, because a blank column in a genotype matrix reads
// as "nobody varies here". Counted off the file itself, chr6:32,000,000-
// 32,020,000 holds 349 records and not one of them is LV=0 — the whole span is
// nested inside a top-level bubble that starts before it, so a filter on the
// parent flag removes every record the window contains. The blank ran across
// CYP21A1P and TNXA, which is exactly where the alignment rows below it drop
// out.
//
// What the lane is for here is the base-level variation the alignment rows are
// made of, and every record is that.

// The 26-way alignment's rows minus `ce11` itself, for the two figures that
// show the whole stack (review: "consider removing the ce11 row"). The
// reference is one of the MAF's own `s` lines, so it draws as a row — and under
// mismatch rendering a sequence against itself has no mismatches, so that row is
// a solid grey band that reads as a broken lane rather than as the reference.
// `subtreeFilter` is the display's own "show these leaves" mechanism and prunes
// the guide tree to match (pruneNewickToLeaves), so the dendrogram beside the
// rows stays the tree of what is drawn. Left alone in maf_codon_tooltip, where
// the reference codon row is what the tooltip is compared against.
//
// Names are the leaf labels of test_data/ce11.26way.nh, in its order.
const CE11_26WAY_NON_REFERENCE = [
  'caePb3',
  'caeRem4',
  'cb4',
  'caeJap4',
  'caeSp111',
  'caeAng2',
  'caeSp51',
  'hetBac1',
  'strRat2',
  'panRed1',
  'ancCey1',
  'necAme1',
  'haeCon2',
  'ascSuu1',
  'priExs1',
  'priPac3',
  'melHap1',
  'melInc2',
  'burXyl1',
  'dirImm1',
  'loaLoa1',
  'oncVol1',
  'bruMal2',
  'triSpi1',
  'triSui1',
]

export const mafSpecs: ScreenshotSpec[] = [
  {
    // The UCSC ce11 26-way multiz alignment (real cross-species nematode data):
    // the coverage band on top, then one row per aligned species (guide tree on
    // the left from the track's .nh), zoomed in enough to read bases — each
    // colored where a species differs from the reference. Remote 26-way data is
    // slow to fetch + render, so the settle is long.
    mode: 'url',
    name: 'maf_track',
    url: sessionSpec(CE_MAF, {
      // gene context above the alignment: the ce11 RefSeq gene lane so the
      // conserved coding blocks line up with the per-species mismatch columns
      sessionTracks: [CE11_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'ce11',
          // wider window (~6kb) so the per-species mismatch columns read as a
          // conservation pattern under the genes, not just a handful of bases
          loc: 'chrI:2,997,000-3,003,000',
          tracks: [
            {
              trackId: 'ce11_ncbi_refseq',
              type: 'LinearBasicDisplay',
              // grow mode: the gene lane expands to show every transcript row
              // rather than scrolling, so the full dnj-28 / nduf-5 structure
              // sits above the alignment
              heightMode: 'grow',
            },
            {
              trackId: 'ce11.26way',
              // Compact preset (rowHeight 8, rowProportion 0.9): a fixed small
              // per-row height so all 26 species fit without scrolling and the
              // conservation banding reads as one texture
              type: 'LinearMafDisplay',
              rowHeight: 8,
              rowProportion: 0.9,
              subtreeFilter: CE11_26WAY_NON_REFERENCE,
            },
          ],
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 716,
    settleMs: 18000,
    hideTooltip: true,
    // park the cursor in the nav bar so no coverage-band hover tooltip lingers
    // over the capture
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
  },
  {
    // Codon-view hover tooltip: in the per-species codon translation, hovering a
    // codon cell reads out the species codon + amino acid alongside the reference
    // codon + amino acid and the syn/nonsyn classification, so a specific change
    // is identifiable rather than inferred from the cell color.
    mode: 'url',
    name: 'maf_codon_tooltip',
    // the tooltip IS the figure here, so the run should complain if it ever
    // stops appearing rather than quietly capturing the frame without it
    expectTooltip: true,
    url: sessionSpec(CE_MAF_FRAMES, {
      sessionTracks: [CE11_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'ce11',
          loc: 'chrI:2,999,200-2,999,370',
          trackLabels: 'offset',
          colorByCDS: true,
          tracks: [
            // compact gene lane, collapsed to the longest coding transcript, so
            // the dnj-28 / nduf-5 CDS context sits above the codon translation
            // without pushing the rows far down
            {
              trackId: 'ce11_ncbi_refseq',
              type: 'LinearBasicDisplay',
              displayMode: 'compact',
              geneGlyphMode: 'longestCoding',
            },
            {
              trackId: 'ce11.26way',
              type: 'LinearMafDisplay',
              height: 470,
              showTranslation: true,
            },
          ],
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    // wider capture so more of the codon alignment is visible (reviewer)
    viewportWidth: 1250,
    // tall enough for the whole 470px display: at 640 the frame cut the last
    // species row in half, which reads as a rendering fault rather than as a
    // list that continues. Raised from 780 when the height above was fixed —
    // it had been spelled `heightOverride`, a dead key silently dropped, so the
    // display was capturing at its fit-to-content height rather than at 470.
    viewportHeight: 810,
    settleMs: 12000,
    actions: [
      // an ORANGE cell in a non-reference row. The hover used to land on the
      // ce11 row, which is the reference: its tooltip necessarily reads
      // "Change: none", so the figure demonstrated the readout on the one case
      // where there is nothing to read. This is caePb3's S -> L against it.
      //
      // Both halves of that come off the figure itself rather than off a
      // viewport point: the tooltip in the committed capture names the codon
      // (chrI:2,999,247), and caePb3 is the second species row, 68px down from
      // the display's top edge — the rows are 16px apart under a ~50px coverage
      // summary, so this is the row and not the gap above or below it.
      {
        type: 'hover',
        anchor: {
          track: 'ce11.26way',
          locus: 'chrI:2,999,247',
          fracY: 0,
          dy: 68,
        },
      },
      { type: 'delay', ms: 2000 },
    ],
  },
  {
    // Color-by-source-chromosome SV mode on the 26-way alignment: each species'
    // alignment blocks are filled by a stable color of their source chromosome
    // (MCGV "color by chromosome"), so a row drawing from more than one source
    // chromosome changes color — a translocation/rearrangement flag with no
    // extra fetch. A compact legend (top-right) maps each visible source
    // chromosome to its color.
    mode: 'url',
    name: 'maf_color_by_chromosome',
    url: sessionSpec(CE_MAF_FRAMES, {
      sessionTracks: [CE11_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'ce11',
          loc: 'chrI:2,995,000-3,003,000',
          trackLabels: 'offset',
          tracks: [
            {
              // gene context: the source-chromosome recoloring spans these ce11
              // genes (supr-1 / dnj-28 / nduf-5); grow mode expands the lane to
              // show every transcript row
              trackId: 'ce11_ncbi_refseq',
              type: 'LinearBasicDisplay',
              heightMode: 'grow',
            },
            {
              trackId: 'ce11.26way',
              // Compact preset so all 26 species fit without scrolling
              type: 'LinearMafDisplay',
              rowHeight: 8,
              rowProportion: 0.9,
              colorByChromosome: true,
              subtreeFilter: CE11_26WAY_NON_REFERENCE,
            },
          ],
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // taller frame so all 26 compact rows + the grow-mode gene lane sit inside
    viewportHeight: 716,
    settleMs: 12000,
    hideTooltip: true,
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
  },
  {
    // Dense comparative view: the UCSC hg38 470-way multiz (mammals + more), all
    // ~470 species at once over the GAPDH gene with the per-row identity heatmap
    // pinned on (red = divergent, blue = conserved). The coding exons light up as
    // conserved blue bands across the whole phylogeny while the introns stay red
    // — genome-scale conservation read at a glance. Remote UCSC data, generous
    // timeout.
    mode: 'url',
    name: 'maf_470way',
    url: sessionSpec(HG38_470WAY, {
      sessionTracks: [HG38_NCBI_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // a focused ~700bp window over a few GAPDH exons rather than the whole
          // gene: at 470 rows the full-gene view is an unreadable wall, so
          // narrowing widens each alignment column enough that the conserved
          // (blue) exon bands and divergent (red) intron columns are legible
          loc: '12:6,536,700-6,537,400',
          trackLabels: 'offset',
          tracks: [
            // NCBI RefSeq gene track on top (longest-coding transcript only):
            // the exon/CDS structure of GAPDH lines up with the conserved
            // (blue) coding bands in the heatmap below. showOnlyGenes drops
            // the individual transcript features (each drawn under its own
            // UUID id, since GAPDH has several isoforms here) down to one
            // gene-level glyph per locus (reviewer).
            {
              trackId: 'ncbi_genes_hg38_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              showOnlyGenes: true,
            },
            {
              trackId: 'hg38.multiz470way',
              // fit-to-display-height: the `height` config slot pins the whole
              // display to 600px while rowHeight stays at its default 0 (fit
              // mode), so all ~470 rows squeeze into 600px at ~1px each. Rows go
              // sub-pixel but the conserved/divergent banding still reads as a
              // texture, and the whole phylogeny is visible at once instead of
              // scrolling off. The top-right legend names the red/blue ramp.
              type: 'LinearMafDisplay',
              height: 600,
              rowIdentityMode: 'heatmap',
              rowIdentityAutoZoom: false,
              // The byte gate is live at this zoom — it has no span floor
              // (`gateActive`, RegionTooLargeMixin), so it measures at
              // whatever is on screen — and a 470-way is over the 1MB default at
              // any span — so without this the capture is the too-large banner,
              // not the heatmap. `readyText` is the ruler, so nothing would have
              // failed; the figure would just have been wrong. This is the case
              // the `forceLoad` slot documents: a view no one can click.
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: '6,53',
    readyTimeout: 120000,
    viewportWidth: 1100,
    // tall enough that the whole 600px fit-to-height display + the view header
    // sit inside the frame with no scroll-off
    viewportHeight: 940,
    // all ~470 species over remote UCSC data — long settle so the heatmap is
    // fully painted and the loading indicator has cleared before capture
    settleMs: 35000,
    hideTooltip: true,
    actions: [{ type: 'delay', ms: 2000 }],
  },
  {
    // The hg38 470-way narrowed to a representative ~30 mammals (subtreeFilter,
    // HG38_470WAY_30) in codon view over a conserved GAPDH exon: each species'
    // coding sequence is translated in the human reading frame, so conserved
    // residues line up and the few amino-acid changes in the more distant
    // species stand out. With the tree-pruning fix the guide tree on the left is
    // the pruned ~30-leaf dendrogram (not the full 470-species tree). Chromosome-
    // level human reference reads far cleaner than a fragmented scaffold MAF.
    //
    // The conservation band on top is in codon mode (`conservationMode: 'codon'`):
    // each bar is the fraction of species whose *amino acid* matches the human
    // reference, so synonymous (silent) 3rd-position changes read as conserved and
    // the profile tracks protein-level constraint rather than nucleotide drift —
    // exactly the metric a coding alignment calls for.
    mode: 'url',
    name: 'maf_470way_codon',
    url: sessionSpec(HG38_470WAY, {
      sessionTracks: [HG38_MANE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          trackLabels: 'offset',
          colorByCDS: true,
          // window trimmed to sit fully inside one GAPDH coding exon: the
          // original ran a few bp past the exon 3' end, so the species that have
          // no aligned block there drew empty "bridge" e-lines on the right that
          // read as artifacts. The codon view is now gap-free across the window:
          // reviewers earlier saw blank columns spanning every row (reference
          // included) where a reference codon's three bases straddle a MAF
          // alignment-block boundary — those codons were dropped
          // (computeVisibleCodons required all three in one block) while the
          // block-agnostic per-base coverage stayed continuous.
          // computeVisibleCodons/computeCodonConservation now stitch a codon
          // across blocks (locateCodon resolves each base to whichever block
          // holds it), so the codon layer lines up with the coverage band above.
          loc: '12:6,536,485-6,536,590',
          tracks: [
            // MANE gene track: confirms the window sits inside a GAPDH coding
            // exon and lines the CDS up with the per-codon translation below.
            // Compact + a pinned height: one MANE transcript needs one row,
            // not the default display's reserved multi-row space (reviewer:
            // reduce height of gene track).
            {
              trackId: 'mane_hg38',
              type: 'LinearBasicDisplay',
              displayMode: 'compact',
              height: 40,
            },
            {
              trackId: 'hg38.multiz470way',
              // fit-to-display-height, shrunk from 560: the ~30 filtered rows
              // still fill the track tall enough to read the per-codon amino
              // acids at a more compact per-row height (reviewer).
              type: 'LinearMafDisplay',
              height: 460,
              showTranslation: true,
              showConservation: true,
              conservationMode: 'codon',
              subtreeFilter: HG38_470WAY_30,
              // Same reason as `maf_470way`: the gate is live below 20kb now.
              // `subtreeFilter` narrows the rows *drawn*, not the download — the
              // adapter still pulls all 470 species and the worker filters — so
              // the estimate is the full 470-way's whatever the filter says.
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: '6,536,5',
    readyTimeout: 120000,
    viewportWidth: 1000,
    // gene lane(40) + coverage/conservation bands + ~30 fitted rows at the
    // shrunk display height. Lowered from 830 when the height above was fixed —
    // it had been spelled `heightOverride`, a dead key silently dropped, so the
    // display had been taller than the 460 the spec asked for.
    viewportHeight: 765,
    settleMs: 18000,
    hideTooltip: true,
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
  },

  // The two halves of the summary tier, on one track at two zooms. Same
  // session, same ~30 mammals, same region centre — only the width changes, so
  // the figure isolates what the `summaryAdapter` does rather than confounding
  // it with a different locus or a different species set. Both parts pin
  // `height` and `subtreeFilter` identically, so the two panels stack at the
  // same width with the same species on the same lines.
  //
  // Each half carries its own label. A compose has no annotation layer — the
  // parts are captured separately and `-append`ed — so without one the stack is
  // two near-identical browser frames whose only difference is the ruler text,
  // which is not a before/after a reader can see at a glance.
  ...(
    [
      [
        'maf_summary_zoomed_out',
        // ~180kb, past the 20kb force-load floor. That floor is exactly where
        // the full alignment fetch is blocked and where `showSummary` hands the
        // rows to the summary file instead: one bar per species per aligned
        // run, no sequence fetched at all.
        '12:6,450,000-6,630,000',
        'Zoomed out (180 kb): one bar per species, from the summary file',
      ],
      [
        'maf_summary_zoomed_in',
        // the same track ~900x closer, inside a GAPDH exon, where the alignment
        // itself is affordable and the rows resolve into per-base cells
        '12:6,537,000-6,537,200',
        'Zoomed in (200 bp): the alignment itself, one cell per base',
      ],
    ] as const
  ).map(([name, loc, label]) => ({
    mode: 'url' as const,
    name,
    url: sessionSpec(HG38_470WAY, {
      sessionTracks: [HG38_NCBI_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc,
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'ncbi_genes_hg38_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              showOnlyGenes: true,
            },
            {
              trackId: 'hg38.multiz470way',
              type: 'LinearMafDisplay',
              height: 380,
              subtreeFilter: HG38_470WAY_30,
              // Needed by both halves, for different reasons, which is fitting
              // since they are deliberately one display spec at two zooms. The
              // 200bp half is below the 20kb floor, where the byte gate is live
              // anyway (it has none — `gateActive`) and a 470-way alignment
              // is over the cap at any span. The 180kb half is in summary mode, which is
              // gated too now — against the summary file rather than the
              // alignment (`byteGateAdapterConfig`) — and a 470-way summary over
              // 180kb is a lot of per-species runs. Either way the banner would
              // replace exactly what the figure exists to show.
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: '12',
    readyTimeout: 120000,
    // the two halves sit side by side (reviewer), so each is narrower and
    // shorter than it was as a stacked pair: 1000x800 twice over was a
    // 4000px-wide figure
    viewportWidth: 780,
    // sized off the run's own CLIPPED/blank report, not off the PNG: 800 was
    // right for the 460px display, and the display is 380 now.
    viewportHeight: 720,
    settleMs: 18000,
    hideTooltip: true,
    annotations: [
      {
        type: 'text' as const,
        text: label,
        fontSize: 20,
        // bottom-left of the track band, `dx` clear of the tree sidebar and its
        // species names.
        anchor: {
          track: 'hg38.multiz470way',
          alignX: 'left' as const,
          alignY: 'bottom' as const,
        },
        dx: 220,
        dy: -26,
      },
    ],
    actions: [{ type: 'delay' as const, ms: 2000 }],
  })),
  {
    mode: 'compose',
    name: 'maf_summary_tier',
    // side by side (reviewer): the two panels are the same track at two zooms,
    // and stacked the second read as the next step rather than the alternative
    direction: 'horizontal',
    parts: ['maf_summary_zoomed_out', 'maf_summary_zoomed_in'],
  },
  // HPRC release 2's minigraph-cactus multiple alignment, read straight off the
  // human-pangenomics bucket by BgzipTaffyAdapter: a 5.96 GB TAF plus its taffy
  // .tai, no conversion step and no local copy.
  //
  // TAF rather than the 53 GB MAF beside it, and the reason is the build rather
  // than the size. The alignment is published as MAF only under v2.1, while the
  // graph and the callset the tutorial pairs this with are v2.0 — and v2.0
  // publishes the same alignment as `full.taf.gz` + `.tai`. So the TAF is the
  // one that matches the rest of the page. Both index the same 195 GRCh38
  // contigs and name sequences the same way (`GRCh38.chr6`), so the swap is the
  // adapter and the URL.
  //
  // Measured off the two .tai files with the repo's own queryBlockSpan, chr6:
  // the 83 kb window below is a 292 KB read against the MAF's 878 KB, and a
  // 10 kb locus is 134 KB against 598 KB. That is also why no fetchSizeLimit is
  // set here any more: the read is well under the 1 MB default the byte gate
  // uses, where the MAF needed the gate raised to draw at all.
  //
  // The locus is C4, which is the example HPRCv2's own README reaches for, and
  // the window is the README's own: GRCh38#0#chr6:31972057-32055418. It used to
  // be narrowed to a 30 kb C4A/CYP21A1P core "so the fetch stays sane", which
  // was a guess and a costly one — C4A is chr6:31,982,057-32,002,681 and C4B is
  // chr6:32,014,795-32,035,418, so the narrow window held C4A alone while the
  // figure's whole claim (and its caption) is about copy number ACROSS C4A and
  // C4B. Widening to the full module costs 103 KB more, measured above, because
  // the read is bgzf-block granular rather than proportional to span: 70 kb and
  // 90 kb both resolve to the same 292 KB. C4A/C4B are copy-number variable in
  // humans, so the thing to see is not phylogeny — every row is a human — but
  // which haplotypes carry which copies. The 470-way figures above are the
  // contrast: there a missing row means a species diverged past alignment, here
  // it means a person does not have that segment.
  //
  // THE UCSC NCBI RefSeq SET, NOT MANE, AND THE REASON IS THE LABELS (review:
  // "need to use ncbi gene track, this has NM_ transcriptid instead of gene
  // symbols"). The MANE bigBed's `name` field is the RefSeq transcript
  // accession, so the lane over the C4 module read NM_007293.3, NM_001002029.4,
  // NM_000500.9 — the module's own genes, spelled in a namespace nobody reads
  // the figure in. The GFF3 set names features by symbol, so the same lane now
  // reads C4A, CYP21A1P, TNXA, C4B, CYP21A2, TNXB, which is the vocabulary the
  // caption and the surrounding prose already use.
  //
  // It was MANE for a real reason and that reason is now handled rather than
  // avoided: the RefSeq set does carry every recombination sub-region here, and
  // in grow mode they filled the figure. Over this window
  // (`tabix hg38.gff.gz NC_000006.12:31972057-32055418`) that is 24
  // non_allelic_homologous_recombination_region, 10 enhancer, 9
  // nucleotide_motif, 9 biological_region and 5 meiotic_recombination_region
  // against 6 genes and 3 pseudogenes. `showOnlyGenes` admits gene/pseudogene/
  // transcript/container/CDS types and nothing else (featureAdmission.ts), so
  // the nine are all that reach the lane; `longestCoding` keeps each of them to
  // one glyph. Same pair maf_470way already uses on the same track.
  //
  // The GFF3's refNames are RefSeq accessions (NC_000006.12), which is why this
  // works at all: the hg38 both fixture configs carry has the standard
  // hg38_aliases.txt, whose chr6 row lists NC_000006.12, so a `chr6:` locus and
  // the track's own contig resolve to the same thing.
  //
  // FOUR STATEMENTS ABOUT ONE 83 KB, which is the whole reason this session is
  // built on the graph fixture rather than on the two-track `hprc_maf.json` it
  // used to load. The alignment on its own draws grey rows with white in them
  // and cannot say what the white IS: reviewed as "the maf alone doesnt tell
  // whole story ... need multiple complementary visualizations". So the lanes
  // around it are the other products of the same release, on one axis:
  //
  //   genes          C4A, CYP21A1P, TNXA, C4B, CYP21A2 -- the RCCX module
  //   rGFA segments  the graph, projected onto the reference
  //   callset        464 haplotypes clustered by genotype
  //   alignment      32 of those haplotypes as rows of sequence, clustered
  //   graph          the same window cut as a Bandage drawing
  //
  // A 1000 Genomes copy-number lane was here for one round and came out
  // (review: "the copy number can likely be removed, it is confusing, small
  // number of samples"). Fourteen rows of QuicK-mer2 depth beside 464 of
  // genotype and 32 of alignment read as a third cohort rather than as a
  // measurement of the same one. What it could say and nothing else here can --
  // an extra tandem module collapses onto its own reference span, so a
  // haplotype carrying two draws the same grey row as one, and gains show only
  // in depth -- is in agent-docs/reference/HPRC_RELEASE2.md with the check that
  // was run on it.
  //
  // The correspondence between what is left is an EVENT rather than a row: the
  // graph credits a segment to whichever assembly first contributed it, the
  // callset names every haplotype that carries one, and the two clusterings are
  // over different matrices, so their row orders are not each other's. One band
  // marks one span in all of them (HPRC_C4_MARKED) and the reader reads down the
  // column.
  //
  // The band is on CYP21A1P/TNXA rather than on C4A or C4B, which are the genes
  // the caption names: it is the span the alignment rows drop out over, and C4A
  // and C4B are already labelled by the gene lane.
  {
    mode: 'url' as const,
    name: 'maf_hprc_pangenome',
    url: sessionSpec(local('test_data/graphgenomeview/hprc.json'), {
      sessionTracks: [HG38_NCBI_GENE_TRACK, HPRC_MAF_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: HPRC_C4_LOCUS,
          highlight: [HPRC_C4_MARKED],
          tracks: [
            {
              trackId: 'ncbi_genes_hg38_ucsc',
              type: 'LinearBasicDisplay',
              showOnlyGenes: true,
              geneGlyphMode: 'longestCoding',
              heightMode: 'grow',
            },
            {
              // The graph as a lane, colored by the same reference-position ramp
              // the pane below uses, so a block here and a node there are the
              // same color for the same bp. Domain is the graph's loadedRegion,
              // which is why both read HPRC_C4_REGION.
              trackId: 'hprc_minigraph_segments',
              type: 'LinearBasicDisplay',
              showLabels: 'none',
              heightMode: 'grow',
              color: referencePositionColor(HPRC_C4_REGION),
            },
            {
              // Clustered, so the haplotypes carrying an allele gather into a
              // block instead of scattering over 464 rows. 464 rows in 240 px
              // is a texture either way; what clustering buys is that the
              // texture has edges. No jexlFilters — see above.
              trackId: 'hprc2_wave_grch38',
              type: 'LinearMultiSampleVariantDisplay',
              height: 240,
              runClustering: true,
            },
            {
              trackId: 'hprc_v2_0_mc_grch38',
              type: 'LinearMafDisplay',
              // A NAMED SUBSET, and the row height follows from it. Two
              // reviews pull in opposite directions here and both are right:
              // 464 rows at 2 px is "unclear what we are looking at. it just
              // looks like bam or cram", and the identity heatmap that
              // answered it lost the thing worth keeping -- "I actually liked
              // it when it was a pileup, but it needs like, row labels, so you
              // can see that they are individual samples, not super compresse
              // rowheights. no one can tell what anything is that way."
              //
              // Both are satisfiable at once only by drawing fewer rows: a
              // label needs 6 px (SvgRowLabels' MIN_TEXT_ROW_HEIGHT) and 464
              // of those is a 2,800 px track. So the base rendering is back,
              // at the default 15 px a row, over the first sixteen samples of
              // the alignment's own order.
              //
              // Row names are `<sample>.<haplotype>`: the TAF's source tokens
              // are `HG00235.2.CM094400.1` and parseAssemblyAndChr takes the
              // numeric second field as part of the genome. The sample ids are
              // the callset's, read off the wave VCF's header, which is the
              // same 232 samples the alignment holds two haplotypes of each.
              //
              // GRCh38 first, because it is the row everything else is a
              // difference from and subtreeFilter drops any row it does not
              // name -- including the reference. CHM13 is listed but never
              // drawn (its rows are not named that way in this file).
              //
              // The filter SELECTS; ordering is `runClustering`'s, below.
              subtreeFilter: HPRC_MAF_ROWS,
              // CLUSTERED, so the rows read like the callset lane above them
              // (review: "it would be useful to cluster the hprc samples, so it
              // looks similar to the multi-sample variant display").
              //
              // This display had no clustering until this round -- its tree was
              // always the adapter's guide phylogeny, and HPRC's TAF ships none
              // -- so the rows came out in the alignment's own discovery order,
              // which put a sample's two haplotypes in unrelated places and
              // scattered the dropouts through the stack. The run is
              // `LinearMafClusterIdentityMatrix`: per-bin identity to GRCh38
              // over the window, where an unaligned bin scores zero, so the
              // haplotypes that carry nothing at CYP21A1P/TNXA gather instead of
              // being spread over 32 rows.
              //
              // Declarative rather than driven, the same transient launch spec
              // the callset lane uses: the flag clears itself after the run.
              runClustering: true,
              // A CLADOGRAM for the run's tree, where the guide-tree default is
              // a phylogram. The distances here are mostly zero -- most of these
              // haplotypes align and match the reference across every bin, so
              // hclust merges them at a height of nothing -- and drawn to scale
              // that collapses their branches against the rows and leaves the
              // sidebar reading as two brackets over a blank column. Topology
              // only, and the block of dropouts gets a bracket that says so.
              showBranchLength: false,
              rowProportion: 1,
              // grow: the filtered rows all fit, so this is the track sizing
              // to its own content rather than the cohort being scrolled
              heightMode: 'grow',
            },
          ],
        },
        {
          // FORCE, the Bandage drawing. The anchored layout was here first,
          // on the argument that it shares the linear view's x axis and so
          // carries the band's column into the pane. Reviewed down, and the
          // reason is about what a reader gets out of the picture rather than
          // about the axis: "the backbone thing confuses me more often than the
          // force directed. people like force directed, it embodies the
          // complexity of graph better than backbone frequently."
          //
          // The reference-position ramp is what carries the correspondence
          // instead, and it is why the segments lane above is colored by the
          // same function: a node here and a block there are the same color for
          // the same bp, which is the one coloring both panels can compute.
          type: 'GraphGenomeView',
          loadedTrackId: 'hprc_minigraph_segments',
          loadedRegion: HPRC_C4_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
        },
      ],
    }),
    viewportHeight: 2000,
    // Four signals ANDed: the graph drawn, its toolbar painted, the callset's
    // clustering landed (its dendrogram exists) and the alignment drawn WITH a
    // tree positioned against its rows. A bare comma list would be a CSS OR and
    // fire on whichever landed first.
    //
    // The last one is `data-clustered` rather than a second dendrogram, and it
    // has to be: `:has([data-testid="tree_sidebar_dendrogram"])` on the body is
    // satisfied by the callset's canvas alone, so with only that gate the
    // capture could land before the alignment's own run finished and commit the
    // unclustered order. CSS cannot ask for two of a thing.
    readySelector: `body:has(${GRAPH_DRAWN}):has([data-testid="graph-layout-select"]):has([data-testid="tree_sidebar_dendrogram"]) ${displayPainted('maf-display')}[data-clustered="true"]`,
    readyTimeout: 360000,
    // the .tai alone is 4.98 MB and the first block read follows it
    actions: [{ type: 'delay' as const, ms: 25000 }],
    // A KEY for the two fills, where this was one sentence arguing against a
    // wrong reading of one of them ("A blank row is a haplotype with no sequence
    // here, not one whose sequence matches"). Two things were wrong with that
    // and the review named both. It was a double negative, so it spent its
    // length on the reading it was ruling out rather than on the one it meant.
    // And it said ROW, while what the reader is actually looking at is white
    // spans INSIDE rows that are otherwise grey, so the sentence did not appear
    // to be about anything on screen ("what is blank e.g. 'white'").
    //
    // Naming both fills is shorter than arguing about one, and it makes the
    // white legible as an absence rather than as a background the row is drawn
    // on. The sidebar already says what a row is (`HG00099.1` is a person and
    // which of their two haplotypes), so nothing here has to.
    //
    // The pill used to head with the file name, because a review asked what the
    // picture is of and one track's sidebar label did not answer it. The frame
    // now holds four lanes off three files, so a filename at the top of a pill
    // sitting inside one of them would name the wrong thing; the sidebar names
    // each lane and the tutorial's fence a few lines above prints the URL.
    //
    // AND THE BAND HAS TO REACH THE GRAPH. The in-app `highlight` is a band on a
    // coordinate axis, so it stops at the bottom of the linear view, and the
    // force drawing has no axis for it to continue onto -- which left the pane
    // as the one panel the figure's own "read down the column" claim did not
    // cover. Same answer pangenome/hprc_graph_vs_callset reached: a ring on the
    // node, and an arrow from the band to it.
    //
    // s101039+ is the node, and it is the marked span almost exactly: rank 0,
    // 5,140 bp at GRCh38#0#chr6:32,005,828-32,010,968, against the band's
    // 32,005,691-32,011,057. Read out of `probe-graph-nodes.ts`, which also
    // names the two alleles hanging across it (s442199+ at rank 16 and s511121+
    // at rank 68, both about 6.4 kb) -- ONE ring, not three, because a previous
    // round of this on the MHC figure was reviewed as "why are there three
    // circles". The reference node is the right survivor: the haplotypes that go
    // white in the alignment above are the ones that do not walk it.
    annotations: [
      {
        type: 'text' as const,
        text: 'Grey: aligned to GRCh38\nWhite: no aligned sequence for that haplotype',
        fontSize: 18,
        maxWidth: 380,
        // right-aligned against the frame's right edge: naming the file made
        // the pill wide enough that centring it on a locus ran it off the
        // capture. `textAlign: 'end'` ends it at the anchor, and the pill's own
        // width -- which is only known once the text is measured in the page --
        // is what decides where it starts.
        textAlign: 'end' as const,
        anchor: {
          track: 'hprc_v2_0_mc_grch38',
          locus: 'chr6:32,053,500',
          fracY: 0.12,
        },
      },
      {
        type: 'circle' as const,
        anchor: { view: 1, graphNode: 's101039+' },
        radius: 26,
        strokeWidth: 3,
        // The default red, and near-black was rendered against it before this
        // was settled. The argument for moving off red is that the pane already
        // holds some: the reference-position ramp starts at hue 0, so the 52 kb
        // backbone node at the window's left edge is red too. Drawn, that turns
        // out not to matter -- the node is a tube 400 px away and the mark is a
        // thin line with a head -- while near-black loses against what is
        // ACTUALLY next to the ring, which is the charcoal an off-reference node
        // paints (ALT_ALLELE_COLOR, rgb(60,65,72)) and the small dark circle the
        // graph puts on its own deletion edge. A ring has to beat its
        // neighbourhood rather than the whole palette.
      },
      {
        type: 'arrow' as const,
        // the bottom of the banded span in the LAST lane of the linear view, so
        // the tail leaves the band at the band's own x rather than beside it
        fromAnchor: {
          view: 0,
          track: 'hprc_v2_0_mc_grch38',
          locus: HPRC_C4_MARKED,
          fracY: 1,
          dy: -8,
        },
        // stopped short of the ring by its own radius: an anchored head resolves
        // to the node's CENTRE, which would put the triangle inside the circle
        anchor: { view: 1, graphNode: 's101039+', dx: -30, dy: -30 },
        strokeWidth: 3,
      },
    ],
  },
]
