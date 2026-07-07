import {
  CE_MAF,
  CE_MAF_FRAMES,
  HG38_470WAY,
  HG38_470WAY_30,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

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
      uri: 'https://ftp.ncbi.nlm.nih.gov/refseq/MANE/trackhub/data/release_1.4/MANE.GRCh38.v1.4.refseq.bb',
      locationType: 'UriLocation',
    },
  },
}

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

export const mafSpecs: ScreenshotSpec[] = [
  {
    // The UCSC ce11 26-way multiz alignment (real cross-species nematode data):
    // the coverage band on top, then one row per aligned species (guide tree on
    // the left from the track's .nh), zoomed in enough to read bases — each
    // colored where a species differs from the reference. Remote 26-way data is
    // slow to fetch + render, so the settle is long.
    mode: 'url',
    name: 'maf_track',
    url: lgvSession(CE_MAF, {
      // zoomed out further: wider window so the per-species
      // mismatch columns read as a conservation pattern, not just a handful
      // of bases
      assembly: 'ce11',
      loc: 'chrI:3,000,648-3,001,368',
      tracks: [
        {
          trackId: 'ce11.26way',
          // fit-to-display-height is the default; rows fill heightOverride
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 360,
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 640,
    settleMs: 18000,
    hideTooltip: true,
    // park the cursor in the nav bar so no coverage-band hover tooltip lingers
    // over the capture
    actions: [
      { type: 'hover', from: { x: 250, y: 100 } },
      { type: 'delay', ms: 2000 },
    ],
  },
  {
    // The conservation (percent identity) band on the real 26-way alignment:
    // toggle it on via the track menu (top frame) and the per-base
    // identity-to-reference profile appears above the rows (bottom frame).
    // Zoomed out across several kb so the sliding-window profile — conserved
    // (coding) vs divergent regions — is the readable signal, not the bases.
    mode: 'url',
    name: 'maf_conservation',
    url: lgvSession(CE_MAF, {
      assembly: 'ce11',
      loc: 'chrI:2,998,500-3,001,800',
      tracks: [
        {
          trackId: 'ce11.26way',
          // fit-to-display-height; rows shrink to make room when the
          // conservation band is toggled on below
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 320,
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 560,
    settleMs: 10000,
    hideTooltip: true,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Show...', 'Show conservation (% identity)']),
        ],
        annotations: cascadeBoxes([
          'Show...',
          'Show conservation (% identity)',
        ]),
      },
      {
        actions: [
          { type: 'click', text: 'Show conservation (% identity)' },
          // wait for the menu to close — keyed on a menu-only label, since the
          // conservation band now carries an on-canvas "Conservation" title that
          // would otherwise keep that text visible forever
          { type: 'waitForText', text: 'Show...', hidden: true },
          { type: 'hover', from: { x: 250, y: 100 } },
          { type: 'delay', ms: 2500 },
        ],
      },
    ],
  },
  {
    // Codon-view hover tooltip: in the per-species codon translation, hovering a
    // codon cell reads out the species codon + amino acid alongside the reference
    // codon + amino acid and the syn/nonsyn classification, so a specific change
    // is identifiable rather than inferred from the cell color.
    mode: 'url',
    name: 'maf_codon_tooltip',
    url: lgvSession(CE_MAF_FRAMES, {
      assembly: 'ce11',
      loc: 'chrI:2,999,200-2,999,370',
      tracks: [
        {
          trackId: 'ce11.26way',
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 470,
            showTranslation: true,
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 600,
    settleMs: 12000,
    actions: [
      { type: 'hover', from: { x: 500, y: 300 } },
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
          tracks: [
            // gene context: the source-chromosome recoloring spans these ce11
            // genes (supr-1 / dnj-28 / nduf-5)
            'ce11_ncbi_refseq',
            {
              trackId: 'ce11.26way',
              displaySnapshot: {
                type: 'LinearMafDisplay',
                heightOverride: 400,
                colorByChromosome: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 560,
    settleMs: 12000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 250, y: 100 } },
      { type: 'delay', ms: 2000 },
    ],
  },
  {
    // Inversion (strand-flip) indicator. Filtered to a few species (incl. bruMal2,
    // which has a genuine intra-scaffold inversion here) at a tall row height so
    // the flip reads clearly: bruMal2's left block aligns on the opposite strand
    // from the rest of its scaffold and is hatched + outlined, while its other
    // blocks (the scaffold's consensus orientation) are left plain. CDS frames
    // are off (the default) so the only overlay is the inversion cue.
    mode: 'url',
    name: 'maf_inversions',
    url: lgvSession(CE_MAF_FRAMES, {
      assembly: 'ce11',
      loc: 'chrI:3,000,300-3,002,800',
      tracks: [
        {
          trackId: 'ce11.26way',
          // fit-to-display-height: the 5 filtered rows fill the track tall
          // enough for the strand-flip hatch to read clearly
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 200,
            showInversions: true,
            subtreeFilter: ['ce11', 'caeRem4', 'cb4', 'bruMal2', 'triSpi1'],
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 460,
    settleMs: 12000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 250, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
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
      sessionTracks: [HG38_MANE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '12:6,534,400-6,538,500',
          tracks: [
            // MANE gene track on top: the exon/CDS structure of GAPDH lines up
            // with the conserved (blue) coding bands in the heatmap below
            'mane_hg38',
            {
              trackId: 'hg38.multiz470way',
              // fit-to-display-height: the `height` config slot pins the whole
              // display to 600px while rowHeight stays at its default 0 (fit
              // mode), so all ~470 rows squeeze into 600px at ~1px each. Rows go
              // sub-pixel but the conserved/divergent banding still reads as a
              // texture, and the whole phylogeny is visible at once instead of
              // scrolling off. The top-right legend names the red/blue ramp.
              displaySnapshot: {
                type: 'LinearMafDisplay',
                height: 600,
                rowIdentityMode: 'heatmap',
                rowIdentityAutoZoom: false,
              },
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
    viewportHeight: 800,
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
            // exon and lines the CDS up with the per-codon translation below
            'mane_hg38',
            {
              trackId: 'hg38.multiz470way',
              // fit-to-display-height: the ~30 filtered rows fill the track tall
              // enough to read the per-codon amino acids
              displaySnapshot: {
                type: 'LinearMafDisplay',
                heightOverride: 560,
                showTranslation: true,
                showConservation: true,
                conservationMode: 'codon',
                subtreeFilter: HG38_470WAY_30,
              },
            },
          ],
        },
      ],
    }),
    readyText: '6,536,5',
    readyTimeout: 120000,
    viewportWidth: 1000,
    // tall enough to show all ~30 fitted rows + the pruned guide tree
    viewportHeight: 820,
    settleMs: 18000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 250, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
