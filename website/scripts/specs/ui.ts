import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { SPLIT_VIEW_LINK_LABEL } from '../../../plugins/variants/src/VariantFeatureWidget/LaunchBreakendPanel/labels.ts'
import {
  DEMO_CONFIG,
  HG38_RMSK_TRACK,
  TRACK_SELECTOR,
  VOLVOX,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  openTrackSelector,
  sessionSpec,
  KG_CONFIG,
} from '../screenshot-spec-helpers.ts'

import type { RowSortSpec } from '../../../packages/tree-sidebar/src/rowSortAutorun.ts'
import type {
  Annotation,
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

const openAssemblyManager = (): ScreenshotAction[] => [
  { type: 'click', text: 'Tools' },
  { type: 'waitForText', text: 'Assembly manager' },
  { type: 'click', text: 'Assembly manager' },
  { type: 'waitForText', text: 'Add new assembly' },
]

// Offsets are from the control, so pill, arrow and button move together.
// `pillDx`/`tailDx` stagger the pills: the labels are wider than the gaps
// between the five toolbar controls.
function toolbarCallout(opts: {
  selector: string
  text: string
  pillDx: number
  tailDx: number
  // the toolbar tier's own; the ruler strip above the track header is tighter
  lift?: number
}): Annotation[] {
  const lift = opts.lift ?? 59
  const { selector } = opts
  return [
    {
      type: 'text',
      text: opts.text,
      fontSize: 16,
      anchor: { selector, dx: opts.pillDx, dy: -lift },
    },
    {
      type: 'arrow',
      fromAnchor: { selector, dx: opts.tailDx, dy: -(lift - 8) },
      anchor: { selector },
    },
  ]
}

// `.MuiDataGrid-cell` excludes the column header, which has the same
// `data-field`.
const LABEL_CELL = '.MuiDataGrid-cell[data-field="label"]'

const PTEN_WINDOW = 'chr10:89,613,000-89,740,000'

// Shared with videos/repeats.ts; every repeat class has blocks in this window.
const RMSK_WINDOW = 'chr17:45,700,000-45,750,000'

// Shared by videos/repeats.ts and multirow/display_types_pick, so the film and
// the figure show one page.
export const repeatVideoFixtures = {
  rmskTrackId: 'rmsk_hg38_ucsc',
  packedSession: sessionSpec(DEMO_CONFIG, {
    sessionTracks: [HG38_RMSK_TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: RMSK_WINDOW,
        tracks: ['rmsk_hg38_ucsc'],
      },
    ],
  }),
  // `replaceDisplay` drops the old display's height, so the multi-row display
  // carries its own or its eight rows overlap. `rows` stays unset: the tour
  // shows the display picking `repClass` itself.
  twoDisplaySession: sessionSpec(DEMO_CONFIG, {
    sessionTracks: [
      {
        ...HG38_RMSK_TRACK,
        displays: [
          {
            type: 'LinearBasicDisplay',
            displayId: 'rmsk_hg38_ucsc-LinearBasicDisplay',
          },
          {
            type: 'LinearMultiRowFeatureDisplay',
            displayId: 'rmsk_hg38_ucsc-LinearMultiRowFeatureDisplay',
            height: 260,
          },
        ],
      },
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: RMSK_WINDOW,
        tracks: ['rmsk_hg38_ucsc'],
      },
    ],
  }),
}

// Shared by videos/config.ts and display_settings_url_snapshot, so the tour's
// last frame and the figure match.
const SV_CRAM_TRACK_ID = 'volvox_sv_cram'
const SV_CRAM_WINDOW = 'ctgA:1-10000'
// Pinned in both sessions: ResizeHandle has no selector for the tour to drag.
const SV_CRAM_HEIGHT = 250

export const settingsVideoFixtures = {
  trackId: SV_CRAM_TRACK_ID,
  defaultsSession: lgvSession(VOLVOX, {
    assembly: 'volvox',
    loc: SV_CRAM_WINDOW,
    tracks: [{ trackId: SV_CRAM_TRACK_ID, height: SV_CRAM_HEIGHT }],
  }),
  // Keys follow the order of the page's JSON fence.
  settledSession: lgvSession(VOLVOX, {
    assembly: 'volvox',
    loc: SV_CRAM_WINDOW,
    tracks: [
      {
        trackId: SV_CRAM_TRACK_ID,
        height: SV_CRAM_HEIGHT,
        unit: 'chain',
        color: { field: 'insertSizeAndOrientation' },
      },
    ],
  }),
}

// videos/ui.ts opens on these sessions, so its tours end where the stills are.
export const uiVideoFixtures = {
  highlightSession: lgvSession(DEMO_CONFIG, {
    assembly: 'hg19',
    loc: PTEN_WINDOW,
    tracks: ['ncbi_gff_hg19'],
  }),
  highlightSpan: { start: 'chr10:89,620,000', end: 'chr10:89,650,000' },
  elsewhere: 'FAS',
  // The add-track tour adds a file the config does not already open.
  addTrackSession: lgvSession(VOLVOX, {
    assembly: 'volvox',
    loc: 'ctgA:1-20,000',
    tracks: ['gff3tabix_genes'],
  }),
  // Must be absolute: the add-track form resolves a relative uri against the
  // config's directory, so `test_data/volvox/volvox.bw` 404s.
  addTrackUrl: 'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox.bw',
  // The session `upstream_downstream_details` is captured in.
  sequencePanelSession: lgvSession(VOLVOX, {
    assembly: 'volvox',
    loc: 'ctgA:17200-23200',
    tracks: [{ trackId: 'gff3tabix_genes', height: 300 }],
  }),
  // No tracks: every lane the sequence-search tour ends with comes from the
  // search.
  motifSearchSession: lgvSession(VOLVOX, {
    assembly: 'volvox',
    loc: 'ctgA:1-20,000',
  }),
  // Three of the sixteen prefilled enzymes: the panel launches one lane
  // per line.
  motifSearchList: 'EcoRI\tG^AATTC\nBamHI\tG^GATCC\nHindIII\tA^AGCTT',
  // Deliberately out of order, so the tour shows the form pairing each index
  // with its data file.
  bulkAddUrls: [
    'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox-bed12.bed.gz',
    'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox-sorted.bam.bai',
    'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox.bw',
    'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox-bed12.bed.gz.tbi',
    'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox-sorted.bam',
  ].join('\n'),
  // A config with no assemblies.
  emptyConfig: '?config=test_data/empty.json&sessionName=Screenshot',
  // Must match the URLs quickstart_adminserver.md prints.
  hg38GenomeUrls: [
    'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
    'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
  ].join('\n'),
  // Where upstream_downstream_details clicks to select the mRNA.
  sequencePanelGene: {
    trackId: 'gff3tabix_genes',
    loc: 'ctgA:17,400-23,000',
    fracY: 0,
    dy: 121,
  },
}

const CHROMHMM_TRACK_ID = 'roadmap_chromhmm_multirow_hg19'
const CHROMHMM_HOXA_WINDOW = 'chr7:26,950,000-27,450,000'

// Roadmap 2015 Fig. 2's group order.
const ROADMAP_FIGURE_GROUPS = [
  'IMR90',
  'ESC',
  'iPSC',
  'ES-deriv',
  'Blood & T-cell',
  'HSC & B-cell',
  'Mesench',
  'Myosat',
  'Epithelial',
  'Neurosph',
  'Thymus',
  'Brain',
  'Adipose',
  'Muscle',
  'Heart',
  'Sm. Muscle',
  'Digestive',
  'Other',
  'ENCODE2012',
]

const HOXA_FIBROBLAST_ROWS = [
  'NHLF Lung Fibroblast Primary Cells',
  'IMR90 fetal lung fibroblasts Cell Line',
  'Foreskin Fibroblast Primary Cells skin01',
  'Foreskin Fibroblast Primary Cells skin02',
  'H1 Cells',
  'H9 Cells',
]

export const chromhmmVideoFixtures = {
  trackId: CHROMHMM_TRACK_ID,
  unclusteredHoxa: lgvSession(DEMO_CONFIG, {
    assembly: 'hg19',
    loc: CHROMHMM_HOXA_WINDOW,
    tracks: [
      {
        trackId: 'ncbi_gff_hg19',
        showLabels: 'name',
        filter: ["jexl:feature.type!='pseudogene'"],
        height: 120,
      },
      {
        trackId: CHROMHMM_TRACK_ID,
        height: 520,
      },
    ],
  }),
}

// A byte-identical copy of EBI's file, which stalls connections. Declared as
// two session tracks below: `showTrack` resolves by trackId, so one track
// cannot show two displays.
const KGP_ENSEMBLE_SV_VCF =
  'https://jbrowse.org/demos/1000g/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz'

// Shared by `multisv_rhd` and the `sv/multisample_sort` tour in videos/sv.ts.
// Loads unsorted: the figure sorts by clicking, so the film opens on the
// figure's pre-click state. Uses the CNV tutorial's config because only a
// config can declare the Zarr plugin. Keep one multi-sample display: a second
// one stops the first answering `onContextMenu`, and the sort row vanishes.
const rhdPanel = (sortRowsBy?: RowSortSpec) =>
  sessionSpec('test_data/1000g_cnv/config.json', {
    sessionTracks: [
      {
        type: 'VariantTrack',
        trackId: 'kgp_sv_matrix',
        name: '1KGP ensemble SV calls, 3202 samples',
        assemblyNames: ['hg38'],
        adapter: { type: 'VcfTabixAdapter', uri: KGP_ENSEMBLE_SV_VCF },
      },
      {
        type: 'VariantTrack',
        trackId: 'kgp_sv_records',
        name: '1KGP ensemble SV calls',
        assemblyNames: ['hg38'],
        adapter: { type: 'VcfTabixAdapter', uri: KGP_ENSEMBLE_SV_VCF },
      },
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: '1:25,200,000-25,400,000',
        tracks: [
          {
            trackId: 'kgp_sv_matrix',
            type: 'LinearMultiSampleVariantDisplay',
            variants: { show: true },
            forceLoad: true,
            sortRowsBy,
            height: 290,
          },
          // The store covers only the windows scripts/build_1000g_cnv_zarr.sh
          // builds; a new locus needs a rebuild.
          {
            trackId: 'cnv_1000g_zarr',
            type: 'LinearWiggleDisplay',
            mark: 'span',
            // Symmetric about the diploid origin; see cnv1000g's
            // CN_HEATMAP_SETTINGS.
            origin: 2,
            scales: { y: { domainMin: 0, domainMax: 4 } },
            color: {
              field: 'score',
              range: ['#2166ac', '#b2182b'],
              title: 'Copy number',
            },
            height: 330,
            runClustering: true,
            showTree: false,
          },
          {
            trackId: 'kgp_sv_records',
            forceLoad: true,
            // below 170 the last row of records clips
            height: 170,
            // One color: each label already names its SV type.
            color: '#4a5568',
          },
          {
            trackId: 'ncbi_refseq_hg38',
            height: 120,
            showLabels: 'name',
            filter: { genes: 'only' },
          },
        ],
      },
    ],
  })

// From `sortRowsHereMenuItem` in multiSampleVariantMenuItems.ts.
export const SORT_BY_GENOTYPE = 'Sort rows by genotype here'

// `pos` is 0-based. INVERSION_SORT sits in a gap where only the inversion
// overlaps.
const INVERSION_SORT: RowSortSpec = { refName: '19', pos: 46_554_999 }
const HGSV_1821_SORT: RowSortSpec = { refName: '1', pos: 25_300_121 }

// Shared by `multisv_rhd` and videos/sv.ts so both sort on one variant.
export const multisvVideoFixtures = {
  unsorted: rhdPanel(),
  matrixTrackId: 'kgp_sv_matrix',
  // HGSV_1821's span; a click lands at its centre, clear of the smaller calls.
  deletionSpan: '1:25,265,081-25,335,163',
  // A right-click before the genotypes load opens a sort item that does
  // nothing.
  matrixReady: displaySettled('variant-display'),
  // Waits out the clustering overlay; the lane draws no tree to wait on.
  cnvClustered: `${displayPainted('wiggle-display')}[data-clustered="true"]`,
}

export const uiSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'top_level_menus',
    url: `?config=${VOLVOX}&sessionName=Screenshot`,
    readyText: 'ctgA',
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'Linear genome view' },
    ],
  },

  // Keep test_data/no_build_plugin/esmplugin.js in sync with the code block in
  // developer_guides/no_build_plugin.md.
  {
    mode: 'url',
    name: 'no_build_final',
    url: '?config=test_data/no_build_plugin/config.json&sessionName=Screenshot',
    readyText: 'Citations',
    viewportWidth: 1200,
    viewportHeight: 300,
    actions: [
      { type: 'click', text: 'Citations' },
      { type: 'waitForText', text: 'Cite this JBrowse session' },
      { type: 'click', text: 'Cite this JBrowse session' },
      { type: 'waitForText', text: 'Diesh, Colin' },
    ],
  },

  {
    mode: 'url',
    name: 'searching_lgv',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:1-100,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    viewportWidth: 1150,
    viewportHeight: 560,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'brca',
        clear: true,
      },
      { type: 'waitForText', text: 'BRCA1' },
      { type: 'delay', ms: 1500 },
    ],
  },

  {
    mode: 'url',
    name: 'search_feature_highlight',
    // Starts away from EDEN, whose floating label would otherwise match the
    // search option's text.
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:30,000..40,000',
      tracks: [
        {
          trackId: 'gff3tabix_genes',
          filter: { genes: 'only' },
        },
      ],
    }),
    readyText: 'ctgA',
    viewportWidth: 1100,
    viewportHeight: 400,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'EDEN',
        clear: true,
      },
      { type: 'waitForText', text: 'EDEN' },
      { type: 'delay', ms: 800 },
      // MUI's autocomplete ignores synthetic option clicks.
      { type: 'press', key: 'ArrowDown' },
      { type: 'press', key: 'Enter' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="chrome-pinned"]',
      },
      { type: 'delay', ms: 1200 },
    ],
  },

  {
    mode: 'url',
    name: 'rubberband',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Zoom to region' },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Zoom to region' } }],
  },

  {
    mode: 'url',
    name: 'display_settings_url_snapshot',
    url: settingsVideoFixtures.settledSession,
    readyText: 'volvox-sv (cram)',
    viewportHeight: 540,
    crop: { x: 0, y: 0, width: 1500, height: 445 },
  },

  {
    mode: 'url',
    name: 'insertion',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        // A slice rehosted on jbrowse.org/demos/hg002: the full NCBI BAM errors
        // intermittently.
        {
          type: 'AlignmentsTrack',
          trackId: 'hg002_pacbio_chr1_insertion_slice',
          name: 'HG002 PacBio Sequel 15kb (chr1 slice)',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:55,705,770-55,706,090',
          tracks: [
            { trackId: 'nstd175.GRCh37.variant_call.vcf', height: 60 },
            { trackId: 'hg002_nanopore', height: 260 },
            {
              trackId: 'hg002_pacbio_chr1_insertion_slice',
              height: 260,
            },
            {
              trackId: 'illumina_hg002',
              height: 320,
              pileup: { softClips: { show: true } },
            },
          ],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    viewportHeight: 1234,
  },

  {
    mode: 'url',
    name: 'multisv',
    url: sessionSpec(KG_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '19:42,749,096-47,802,386',
          tracks: [
            {
              trackId: '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
              type: 'LinearMultiSampleVariantDisplay',
              sortRowsBy: INVERSION_SORT,
              variants: { show: true },
              forceLoad: true,
              height: 400,
            },
            // No lane height this figure can afford shows gene names at 5 Mb;
            // 220px still dropped them.
            {
              trackId: 'ncbi_refseq_109_hg38',
              height: 140,
              showLabels: 'name',
              filter: { genes: 'only' },
              heightMode: 'fit',
            },
          ],
        },
      ],
    }),
    readyText: '1KGP',
    readyTimeout: 90000,
    viewportHeight: 800,
    tooltip: 'hide',
  },

  {
    mode: 'url',
    name: 'multisv_svtype',
    url: sessionSpec(KG_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '19:42,749,096-47,802,386',
          tracks: [
            {
              trackId: '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
              type: 'LinearMultiSampleVariantDisplay',
              sortRowsBy: INVERSION_SORT,
              variants: { show: true },
              forceLoad: true,
              height: 400,
              color: { field: 'svType' },
            },
            {
              trackId: 'ncbi_refseq_109_hg38',
              height: 140,
              showLabels: 'name',
              filter: { genes: 'only' },
              heightMode: 'fit',
            },
          ],
        },
      ],
    }),
    readyText: '1KGP',
    readyTimeout: 90000,
    // below 800 the RefSeq lane clips
    viewportHeight: 800,
    tooltip: 'hide',
  },

  {
    mode: 'url',
    name: 'multisv_rhd',
    url: rhdPanel(HGSV_1821_SORT),
    readyText: '1KGP',
    readyTimeout: 300000,
    viewportHeight: 1240,
    tooltip: 'hide',
    actions: [
      {
        type: 'waitForSelector',
        selector: multisvVideoFixtures.cnvClustered,
        timeout: 240000,
      },
    ],
  },

  // One autoscale group puts the three genotypes on one axis; per-row
  // autoscale draws them at almost the same height.
  {
    mode: 'url',
    name: 'multisv_rhd_dosage',
    url: sessionSpec(KG_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // Wide enough to include RHCE (25,362,249-25,430,192), the paralog
          // the tutorial turns to next.
          loc: '1:25,200,000-25,470,000',
          // RHD's span from the RefSeq annotation.
          highlight: [
            {
              refName: '1',
              start: 25272393,
              end: 25330445,
              color: 'rgba(214,137,16,0.13)',
            },
          ],
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38',
              // `genes: 'only'` alone stacks a dozen RHD transcripts and
              // pushes the coverage off; `longestCoding` plus 'grow' keeps RHD
              // in frame.
              heightMode: 'grow',
              geneGlyphMode: 'longestCoding',
              showLabels: 'name',
              filter: { genes: 'only' },
            },
            ...['HG00113', 'HG00096', 'HG00097'].map(s => ({
              trackId: `${s}.final`,
              forceLoad: true,
              pileup: { show: false },
              coverage: { height: 190 },
              readConnections: {
                // No mate-pair band: the RHD deletion is NAHR between the
                // Rhesus boxes and leaves no read-pair signal, so the arcs
                // would only show RHD/RHCE paralogy
                // (scripts/count_rhd_mate_pairs.py). `svSignal: 'only'` or a
                // jexl insert-size filter also removes the coverage.
                show: false,
              },
              height: 200,
              scales: { y: { autoscaleGroup: 'depth' } },
            })),
          ],
        },
      ],
    }),
    readyText: 'HG00097.final',
    readyTimeout: 600000,
    viewportHeight: 1000,
  },

  // Reads are slices rehosted on jbrowse.org/demos/kgp-trio; the full NCBI
  // CRAMs 503 intermittently.
  {
    mode: 'url',
    name: 'multi-sv-trio',
    url: sessionSpec(KG_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02030_trio_slice',
          name: 'HG02030 (child)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02030_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02030_trio_slice.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02031_trio_slice',
          name: 'HG02031 (mother)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02031_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02031_trio_slice.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02032_trio_slice',
          name: 'HG02032 (father)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02032_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02032_trio_slice.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:40,481,472-40,524,349',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            ...['HG02030', 'HG02031', 'HG02032'].map(id => ({
              trackId: `${id}_trio_slice`,
              height: 150,
              pileup: { readHeight: 1 },
              readConnections: { show: true },
            })),
          ],
        },
      ],
    }),
    readyText: 'HG02030',
    readyTimeout: 90000,
    viewportHeight: 874,
  },

  {
    mode: 'url',
    name: 'link_to_split_view',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '14:84,871,462-84,871,480',
      tracks: ['breast_cancer_sniffles_hg19_traonly_tabix'],
    }),
    readyText: '84,871',
    // the LaunchBreakendPanel link sits below the long TRA INFO table
    viewportHeight: 1100,
    actions: [
      { type: 'click', selector: '[data-testid="feature-name-89844_3"]' },
      { type: 'waitForText', text: SPLIT_VIEW_LINK_LABEL },
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      { type: 'box', anchor: { text: SPLIT_VIEW_LINK_LABEL } },
      // The tail and pill stay raw points: the pill is parked in the view's
      // empty top-left, and anchoring only the tail would unglue the arrow.
      {
        type: 'arrow',
        from: { x: 760, y: 300 },
        anchor: { text: SPLIT_VIEW_LINK_LABEL },
      },
      {
        type: 'text',
        x: 60,
        y: 270,
        text: 'Launches a breakpoint split view for the TRA — also in paired-end and long-read feature details.',
      },
    ],
  },

  {
    mode: 'url',
    name: 'breakpoint_split_view',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          views: [
            {
              assembly: 'hg19',
              loc: '1:229,347,000-229,362,000',
              tracks: [
                {
                  trackId: 'ngmlr_splitters_cram',
                  height: 140,
                },
                {
                  trackId: 'breast_cancer_sniffles_hg19',
                  // drop the megabase-scale inversion calls spanning the window
                  height: 90,
                  filter: [
                    "jexl:get(feature,'end')-get(feature,'start') < 100000",
                  ],
                },
              ],
            },
            {
              assembly: 'hg19',
              loc: '5:137,877,000-137,892,000',
              tracks: [
                {
                  trackId: 'breast_cancer_sniffles_hg19',
                  height: 90,
                  filter: [
                    "jexl:get(feature,'end')-get(feature,'start') < 100000",
                  ],
                },
                {
                  trackId: 'ngmlr_splitters_cram',
                  height: 140,
                },
              ],
            },
          ],
        },
      ],
    }),
    readyText: 'SKBR3',
    viewportHeight: 824,
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'read_vs_ref_insertion',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:85,618,922-85,621,742',
      tracks: ['ngmlr'],
    }),
    readyText: 'SKBR3',
    readyTimeout: 60000,
    tooltip: 'hide',
    viewportHeight: 820,
    actions: [
      // Depth 56px is the second read row: 45px of coverage, then 8px rows.
      {
        type: 'rightclick',
        anchor: {
          trackId: 'ngmlr',
          loc: '1:85,620,091',
          fracY: 0,
          dy: 56,
        },
      },
      { type: 'waitForText', text: 'Open feature details' },
      { type: 'hover', text: 'Launch' },
      { type: 'waitForText', text: 'Linear read vs ref' },
      { type: 'click', text: 'Linear read vs ref' },
      { type: 'waitForText', text: 'Set window size' },
      { type: 'click', text: 'Open in new view' },
      { type: 'waitForText', text: 'Reference sequence' },
      { type: 'waitForAppSettled' },
      { type: 'click', selector: '[aria-label="Synteny display settings"]' },
      { type: 'waitForText', text: 'Curved lines' },
      { type: 'click', text: 'Curved lines' },
      // A checkbox row leaves the menu open.
      { type: 'press', key: 'Escape' },
      { type: 'waitForText', text: 'Curved lines', hidden: true },
    ],
  },

  {
    mode: 'url',
    name: 'lgv_usage_guide',
    viewportHeight: 499,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    readyText: 'ctgA',
    annotations: [
      ...toolbarCallout({
        selector: 'button[title="Open track selector"]',
        text: 'Open track selector',
        pillDx: -15,
        tailDx: 3,
      }),
      ...toolbarCallout({
        selector: '[data-testid="scroll-zoom-toggle"]',
        text: 'Scroll-to-zoom toggle',
        pillDx: 125,
        tailDx: 144,
      }),
      ...toolbarCallout({
        selector: 'button[aria-label="Pan left"]',
        text: 'Pan',
        pillDx: 30,
        tailDx: 45,
      }),
      ...toolbarCallout({
        selector: 'input[placeholder="Search for location"]',
        text: 'Search box',
        pillDx: -32,
        tailDx: 8,
      }),
      ...toolbarCallout({
        selector: '[data-testid="zoom_in"]',
        text: 'Zoom',
        pillDx: -99,
        tailDx: -77,
      }),
      ...toolbarCallout({
        selector: '[data-testid="track_menu_icon"]',
        text: 'Track menu',
        pillDx: 42,
        tailDx: 42,
        lift: 25,
      }),
    ],
  },

  {
    mode: 'url',
    name: 'scroll_zoom_toggle',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    readyText: 'ctgA',
    viewportWidth: 1000,
    viewportHeight: 455,
    annotations: [
      {
        type: 'box',
        anchor: {
          selector: '[data-testid="scroll-zoom-toggle"]',
        },
      },
      {
        type: 'text',
        text: 'The scroll wheel zooms instead of scrolling the page',
        leader: true,
        anchor: {
          selector: '[data-testid="scroll-zoom-toggle"]',
          alignY: 'bottom',
        },
        dx: 40,
        dy: 70,
      },
    ],
  },

  {
    mode: 'url',
    name: 'add_track_form',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:1,000,000-1,100,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    viewportWidth: 1200,
    viewportHeight: 620,
    actions: [
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'click', text: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Open track...' } },
      // the whole drawer's box runs off the bottom of the capture
      { type: 'box', anchor: { selector: '[data-testid="addTrackWorkflow"]' } },
      // The tail leaves the boxed item's right edge, 96px past its centre.
      {
        type: 'arrow',
        fromAnchor: { text: 'Open track...', dx: 96 },
        anchor: { text: 'Enter track data' },
        dx: -30,
      },
    ],
  },

  {
    mode: 'url',
    name: 'add_track_tracklist',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    viewportWidth: 1000,
    viewportHeight: 600,
    readyText: 'ctgA',
    stages: [
      {
        actions: [{ type: 'delay', ms: 300 }],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: 'button[value="track_select"]' },
          },
        ],
      },
      {
        actions: [
          { type: 'click', selector: 'button[value="track_select"]' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="hierarchical_track_selector"]',
          },
          {
            type: 'click',
            selector: '[data-testid="hierarchical-add-track-fab"]',
          },
          { type: 'waitForText', text: 'Add track' },
        ],
        annotations: [
          // an arrow here cuts across the "Add track" box
          {
            type: 'circle',
            anchor: { selector: '[data-testid="hierarchical-add-track-fab"]' },
          },
          { type: 'box', anchor: { text: 'Add track' } },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'track_menu',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_sv_test'],
    }),
    viewportWidth: 1200,
    viewportHeight: 540,
    readyText: 'ctgA',
    actions: [
      ...openTrackSelector(),
      // the list is virtualized, so filter until the target row renders
      { type: 'type', text: 'Filter tracks', value: 'structural variant' },
      { type: 'delay', ms: 800 },
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'About track' },
    ],
    annotations: [
      // tight on the label's ring so it stays off the menu below
      {
        type: 'circle',
        pad: 1,
        anchor: { selector: '[data-testid="track_menu_icon"]' },
      },
      {
        type: 'circle',
        anchor: {
          selector: '[data-testid="htsTrackEntryMenu-Tracks,volvox_sv_test"]',
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'tracklabels',
    viewportHeight: 520,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      ...menuCascade(['Track labels', 'Overlapping']),
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { selector: '[data-testid="view_menu_icon"]' },
      },
      ...cascadeBoxes(['Track labels', 'Overlapping']),
    ],
  },

  {
    mode: 'url',
    name: 'edit_track_settings',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    viewportHeight: 640,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Track actions', 'Settings']),
        ],
        annotations: cascadeBoxes(['Track actions', 'Settings']),
      },
      {
        actions: [
          { type: 'click', text: 'Settings' },
          { type: 'waitForText', text: 'Filter options' },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [
          {
            type: 'box',
            anchor: { selector: '[data-testid="drawer-widget"]' },
          },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'drawer_widget_toggle',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    viewportWidth: 1150,
    viewportHeight: 470,
    actions: [
      // the drawer needs a widget in it to move
      ...openTrackSelector(),
    ],
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="drawer-position-button"]' },
          { type: 'waitForText', text: 'left' },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="drawer-position-button"]' },
          },
          { type: 'box', anchor: { text: 'left' } },
          // Placed off the head's anchor, so the arrow keeps its length and
          // angle when the menu moves.
          {
            type: 'arrow',
            fromAnchor: { text: 'left', dx: -526, dy: 167 },
            anchor: { text: 'left' },
            dx: -55,
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'left' },
          { type: 'delay', ms: 1500 },
        ],
        annotations: [
          {
            type: 'box',
            anchor: { selector: '[data-testid="drawer-widget"]' },
          },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'share_button',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    actions: [
      { type: 'click', selector: '[data-testid="share-button"]' },
      { type: 'waitForText', text: 'Copy the URL below' },
      { type: 'waitForText', text: 'Generating', hidden: true },
    ],
  },

  {
    mode: 'url',
    name: 'highlight_list_create',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: PTEN_WINDOW,
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    viewportHeight: 440,
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Highlight region' },
    ],
    stages: [
      {
        annotations: [{ type: 'box', anchor: { text: 'Highlight region' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Highlight region' },
          { type: 'delay', ms: 1500 },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'highlight_list_edit_label',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:1-20,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    viewportHeight: 520,
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Highlight region' },
      { type: 'click', text: 'Highlight region' },
      { type: 'delay', ms: 500 },
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'click', text: 'Highlights' },
      { type: 'click', text: 'Open highlight list' },
      { type: 'waitForText', text: 'Add label...' },
      { type: 'delay', ms: 1000 },
      { type: 'type', text: 'Add label...', value: 'my region' },
      { type: 'delay', ms: 1500 },
    ],
    // The label cell is an <input> while edited, so it has no text to anchor
    // to; its `data-field` survives edit mode.
    annotations: [
      {
        type: 'text',
        text: 'Single-click the label to edit it',
        anchor: { text: 'Location' },
        dx: -190,
        dy: 170,
        maxWidth: 230,
      },
      {
        type: 'arrow',
        fromAnchor: { selector: LABEL_CELL, dx: -162, dy: 125 },
        anchor: { selector: LABEL_CELL },
        dx: -7,
        dy: 18,
      },
    ],
  },

  {
    mode: 'url',
    name: 'hierarchical/hierarchical_user_menu-fs8',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: [],
      tracklist: true,
    }),
    readyText: 'ctgA',
    readySelector: TRACK_SELECTOR,
    actions: [
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      ...menuCascade(['Collapse...', 'Collapse top-level categories']),
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Collapse top-level categories' } },
      { type: 'box', anchor: { text: 'Collapse subcategories' } },
    ],
  },

  // Only opening a track through the selector populates the recently-used
  // list; opening it in the session does not.
  {
    mode: 'url',
    name: 'recent_tracks',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:1-100,000',
      tracklist: true,
    }),
    readySelector: TRACK_SELECTOR,
    readyTimeout: 60000,
    viewportWidth: 1100,
    viewportHeight: 600,
    actions: [
      { type: 'type', text: 'Filter tracks', value: 'NCBI RefSeq' },
      // Wait for the row: the list is virtualized, and a missing row fails as
      // "click target not found".
      { type: 'waitForText', text: 'NCBI RefSeq w/ top-level feature details' },
      { type: 'click', text: 'NCBI RefSeq w/ top-level feature details' },
      { type: 'delay', ms: 1500 },
      // target the input, not the floating label, so select-all + Backspace
      // empties it
      {
        type: 'type',
        selector: '[data-testid="hierarchical_track_selector"] input',
        value: '',
        clear: true,
      },
      { type: 'delay', ms: 800 },
      {
        type: 'click',
        selector: '[data-testid="recently-used-tracks-button"]',
      },
      { type: 'waitForText', text: 'NCBI RefSeq w/ top-level feature details' },
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { selector: '[data-testid="recently-used-tracks-button"]' },
      },
    ],
  },

  {
    mode: 'url',
    name: 'favorite_tracks',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    viewportHeight: 560,
    actions: [
      ...openTrackSelector(),
      // the list is virtualized, so filter until the target row renders
      { type: 'type', text: 'Filter tracks', value: 'volvox-sorted' },
      { type: 'delay', ms: 800 },
      {
        type: 'click',
        selector: '[data-testid="htsTrackEntryMenu-Tracks,volvox_bam"]',
      },
      { type: 'waitForText', text: 'Add to favorites' },
    ],
    stages: [
      {
        annotations: [
          {
            type: 'circle',
            anchor: {
              selector: '[data-testid="htsTrackEntryMenu-Tracks,volvox_bam"]',
            },
          },
          { type: 'box', anchor: { text: 'Add to favorites' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Add to favorites' },
          { type: 'delay', ms: 500 },
          { type: 'click', selector: '[data-testid="favorite-tracks-button"]' },
          { type: 'waitForText', text: 'volvox-sorted.bam' },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="favorite-tracks-button"]' },
          },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'plugin_store',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
    }),
    readyText: 'ctgA',
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Plugin store' },
      { type: 'click', text: 'Plugin store' },
      { type: 'waitForText', text: 'Installed plugins' },
      { type: 'delay', ms: 1500 },
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Plugin store' },
    ],
    annotations: [
      // nudged down so the top edge does not clip the ring into an oval
      { type: 'circle', anchor: { text: 'Tools' }, radius: 24, dy: 8 },
      { type: 'box', anchor: { text: 'Plugin store' } },
      { type: 'box', anchor: { text: 'Installed plugins' } },
    ],
  },
  {
    mode: 'url',
    name: 'plugin_store_install',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
    }),
    readyText: 'ctgA',
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'click', text: 'Plugin store' },
      { type: 'waitForText', text: 'Available plugins' },
      { type: 'type', text: 'Filter plugins', value: 'MsaView' },
      { type: 'waitForText', text: 'Install' },
      { type: 'delay', ms: 800 },
    ],
    clicksOpen: 'the plugin store, filtered to MsaView',
    annotations: [{ type: 'box', anchor: { text: 'Install' } }],
  },
  {
    mode: 'url',
    name: 'plugin_store_keep',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
    }),
    readyText: 'ctgA',
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'click', text: 'Plugin store' },
      { type: 'waitForText', text: 'Available plugins' },
      { type: 'type', text: 'Filter plugins', value: 'MsaView' },
      {
        type: 'click',
        selector: "::-p-xpath(//button[normalize-space(.)='Install'])",
      },
      {
        type: 'waitForSelector',
        selector: '[data-testid="keepPlugin-MsaView"]',
      },
      { type: 'waitForAppSettled' },
    ],
    clicksChange: 'install MsaView from the plugin store',
    annotations: [
      {
        type: 'box',
        anchor: { selector: '[data-testid="keepPlugin-MsaView"]' },
      },
    ],
  },

  {
    mode: 'url',
    name: 'lgv_assembly',
    url: sessionSpec(VOLVOX, { views: [] }),
    readyText: 'Select a view to launch',
    viewportWidth: 900,
    viewportHeight: 231,
    actions: [
      // the ViewLauncher button; the menu group is `Launch`
      { type: 'click', text: 'Launch view' },
      { type: 'waitForText', text: 'Select assembly to view' },
      { type: 'delay', ms: 1500 },
    ],
  },

  {
    mode: 'url',
    name: 'add_hg38_assembly',
    url: sessionSpec(DEMO_CONFIG, { views: [] }),
    readyText: 'Select a view to launch',
    actions: [...openAssemblyManager(), { type: 'delay', ms: 1500 }],
  },

  {
    mode: 'url',
    name: 'sample_config',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracklist: true,
        },
      ],
    }),
    viewportWidth: 1000,
    viewportHeight: 600,
    readyText: 'ctgA',
    readySelector: TRACK_SELECTOR,
  },

  {
    mode: 'url',
    name: 'hierarchical/collapse_toplevelcategories-fs8',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracklist: true,
        },
      ],
    }),
    readyText: 'ctgA',
    readySelector: TRACK_SELECTOR,
    actions: [
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      ...menuCascade(['Collapse...', 'Collapse top-level categories']),
      { type: 'click', text: 'Collapse top-level categories' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // No sub-category figure: volvox's nested categories sort below the fold of
  // the selector, so the collapse looks like it did nothing.

  {
    mode: 'url',
    name: 'default_theme',
    url: sessionSpec('test_data/volvox/config_theme_default.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracklist: true,
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 520,
    readySelector: TRACK_SELECTOR,
  },

  {
    mode: 'url',
    name: 'customized_theme',
    url: sessionSpec('test_data/volvox/config_theme_custom.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracklist: true,
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 520,
    readySelector: TRACK_SELECTOR,
  },
  // Admin mode comes from the &adminKey= URL param alone; no admin server is
  // needed to render these dialogs.

  {
    mode: 'url',
    name: 'assembly_manager',
    url: `${sessionSpec('test_data/empty.json', { views: [] })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 540,
    tooltip: 'hide',
    actions: openAssemblyManager(),
  },

  {
    mode: 'url',
    name: 'hg38_assembly_table',
    url: `${sessionSpec('test_data/hg38_only.json', { views: [] })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 540,
    tooltip: 'hide',
    actions: openAssemblyManager(),
  },

  {
    mode: 'url',
    name: 'default_session_form',
    url: `${sessionSpec('test_data/empty.json', { views: [] })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 480,
    tooltip: 'hide',
    stages: [
      {
        actions: [
          { type: 'click', text: 'Admin' },
          { type: 'waitForText', text: 'Set default session' },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Admin' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Set default session' },
          { type: 'waitForText', text: 'Clear default session' },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'config_not_found',
    noSession: true,
    url: '',
    readyText: 'It worked!',
    viewportWidth: 1200,
    viewportHeight: 154,
    expectedConsole: [
      'HTTP 404 fetching config.json',
      'Failed to load resource',
    ],
    allowUnsettled: true,
  },

  {
    mode: 'url',
    name: 'chromhmm',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr9:34,700,000-38,420,000',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          showLabels: 'name',
          filter: ["jexl:feature.type!='pseudogene'"],
          displayMode: 'compact',
          height: 80,
        },
        {
          trackId: 'roadmap_chromhmm_multirow_hg19',
          facet: { field: 'group', sort: ROADMAP_FIGURE_GROUPS },
          height: 900,
        },
      ],
    }),
    clicksChange: 'expand the legend to its full list',
    actions: [
      { type: 'waitForText', text: 'Show 3 more…', timeout: 120000 },
      { type: 'click', text: 'Show 3 more…' },
    ],
    annotations: [
      {
        type: 'box',
        anchor: {
          trackId: 'roadmap_chromhmm_multirow_hg19',
          loc: 'chr9:36,833,266-37,034,265',
        },
        pad: 2,
      },
      {
        type: 'text',
        text: 'PAX5 transcribed, with genic enhancers, in B cells only',
        leader: true,
        // rows 40 and 41 of 127 in ROADMAP_FIGURE_GROUPS order
        anchor: {
          trackId: 'roadmap_chromhmm_multirow_hg19',
          loc: 'chr9:36,900,000',
          fracY: 40.5 / 127,
        },
        dx: -260,
        dy: -60,
      },
    ],
    readyText: 'ChromHMM',
    readyTimeout: 180000,
    viewportHeight: 1230,
  },

  {
    mode: 'url',
    name: 'chromhmm_hoxa_fibroblasts',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:27,110,000-27,265,000',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          showLabels: 'name',
          filter: ["jexl:feature.type!='pseudogene'"],
          height: 110,
        },
        {
          trackId: 'roadmap_chromhmm_multirow_hg19',
          rows: {
            field: 'cellType',
            sort: HOXA_FIBROBLAST_ROWS,
            kept: HOXA_FIBROBLAST_ROWS,
          },
          height: 240,
        },
      ],
    }),
    annotations: [
      {
        type: 'box',
        anchor: {
          trackId: 'roadmap_chromhmm_multirow_hg19',
          loc: 'chr7:27,132,613-27,196,294',
        },
        pad: 2,
      },
      {
        type: 'box',
        anchor: {
          trackId: 'roadmap_chromhmm_multirow_hg19',
          loc: 'chr7:27,202,056-27,246,878',
        },
        pad: 2,
        color: '#1565c0',
      },
    ],
    readyText: 'ChromHMM',
    readyTimeout: 120000,
    viewportHeight: 620,
    hideSelectors: ['[data-testid="row_focus_hint"]'],
  },

  // Keeps its derived key: the page teaches the identity scale against that
  // key's merged entries.
  {
    mode: 'url',
    name: 'chromhmm_encode_hoxa',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:27,110,000-27,265,000',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          showLabels: 'name',
          filter: ["jexl:feature.type!='pseudogene'"],
          height: 110,
        },
        {
          trackId: 'broad_chromhmm_multirow_hg19',
          height: 240,
        },
      ],
    }),
    readyText: 'ChromHMM',
    readyTimeout: 120000,
    viewportHeight: 620,
  },

  // Shot on a track still in its default display.
  {
    mode: 'url',
    name: 'multirow/display_types_pick',
    url: repeatVideoFixtures.packedSession,
    readyText: 'RepeatMasker',
    readyTimeout: 60000,
    viewportWidth: 1000,
    viewportHeight: 560,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Display types', 'Multi-row feature display (painting)']),
    ],
    annotations: cascadeBoxes([
      'Display types',
      'Multi-row feature display (painting)',
    ]),
  },

  // Same window and viewport width as display_types_pick: a vertical compose
  // pads a narrower part.
  {
    mode: 'url',
    name: 'multirow/display_types_rows',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG38_RMSK_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:45,700,000-45,750,000',
          tracks: [
            {
              trackId: 'rmsk_hg38_ucsc',
              type: 'LinearMultiRowFeatureDisplay',
              // No rowColor: the figure shows what the menu path produces.
              rows: 'repClass',
              showRowSeparators: true,
              height: 260,
            },
          ],
        },
      ],
    }),
    readyText: 'RepeatMasker',
    readyTimeout: 60000,
    viewportWidth: 1000,
    viewportHeight: 470,
  },

  {
    mode: 'compose',
    name: 'multirow/display_types_menu',
    parts: ['multirow/display_types_pick', 'multirow/display_types_rows'],
  },
]
