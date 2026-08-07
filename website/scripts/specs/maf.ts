import {
  CE_MAF,
  CE_MAF_FRAMES,
  HG38_470WAY,
  HG38_470WAY_30,
  HG38_NCBI_GENE_TRACK,
  PARK_CURSOR,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

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
              // The byte gate is live at this zoom (`gateBelowForceLoadFloor`,
              // RegionTooLargeMixin), and a 470-way is over the 1MB default at
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
              // 200bp half is below the 20kb floor, where the gate is live now
              // (`gateBelowForceLoadFloor`) and a 470-way alignment is over the
              // cap at any span. The 180kb half is in summary mode, which is
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
  // the 30 kb window below is a 189 KB read against the MAF's 878 KB, and a
  // 10 kb locus is 134 KB against 598 KB. That is also why no fetchSizeLimit is
  // set here any more: the read is an order of magnitude under the 1 MB default
  // the byte gate uses, where the MAF needed the gate raised to draw at all.
  //
  // The locus is C4, which is the example HPRCv2's own README reaches for
  // (GRCh38#0#chr6:31972057-32055418, narrowed here to the C4A/CYP21A1P core so
  // the fetch stays sane). C4A/C4B are copy-number variable in humans, so the
  // thing to see is not phylogeny — every row is a human — but which haplotypes
  // carry which copies. The 470-way figures above are the contrast: there a
  // missing row means a species diverged past alignment, here it means a person
  // does not have that segment.
  //
  // MANE Select rather than the full UCSC gene set: at C4 the RefSeq track
  // carries hundreds of `biological region` features (every CH-n recombination
  // sub-region), which in grow mode filled the figure and left no room for the
  // alignment it was supposed to caption.
  {
    mode: 'url' as const,
    name: 'maf_hprc_pangenome',
    url: sessionSpec('test_data/hprc_maf.json', {
      sessionTracks: [HG38_MANE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:31,980,000-32,010,000',
          tracks: [
            {
              trackId: 'mane_hg38',
              type: 'LinearBasicDisplay',
              heightMode: 'grow',
            },
            {
              trackId: 'hprc_v2_0_mc_grch38',
              type: 'LinearMafDisplay',
              rowHeight: 2,
              rowProportion: 1,
              // grow so all 464 rows are on screen at once; the point of the
              // figure is the whole cohort, and a scrolled track shows half of it
              heightMode: 'grow',
            },
          ],
        },
      ],
    }),
    viewportHeight: 920,
    // the .tai alone is 4.98 MB and the first block read follows it
    actions: [{ type: 'delay' as const, ms: 25000 }],
  },
]
