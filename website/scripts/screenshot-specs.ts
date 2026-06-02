export interface ScreenshotAction {
  type: 'click' | 'waitForText' | 'delay'
  selector?: string
  text?: string
  ms?: number
}

// Set on a spec whose committed PNG is a hand-curated / real-human-data
// screenshot that the volvox-based spec body cannot reproduce (the spec body is
// kept only as documentation). The generator skips these so a regen never
// clobbers the curated image.
interface CuratedFlag {
  curated?: boolean
}

// Mode 1: navigate to app, interact via UI to open tracks.
// This is the reliable approach — plugins are fully loaded before tracks open.
interface LGVSpec extends CuratedFlag {
  mode?: 'lgv'
  name: string
  config?: string // defaults to volvox config
  loc?: string // location to navigate to (default: config default)
  openTracks?: string[] // track IDs to click open in the track selector
  crop?: { x: number; y: number; width: number; height: number }
  settleMs?: number
  actions?: ScreenshotAction[]
}

// Mode 2: navigate directly to a session spec URL.
// Use for multi-view layouts (dotplot, synteny) where the UI approach is awkward.
interface SessionUrlSpec extends CuratedFlag {
  mode: 'url'
  name: string
  url: string // full query string starting with '?' or a full URL
  readyText?: string // text to wait for before settle
  readySelector?: string // CSS selector to wait for before settle
  readyTimeout?: number // ms override for the ready wait (default 30000)
  waitUntil?: 'networkidle0' | 'domcontentloaded' // override goto waitUntil
  crop?: { x: number; y: number; width: number; height: number }
  settleMs?: number
  actions?: ScreenshotAction[]
}

export type ScreenshotSpec = LGVSpec | SessionUrlSpec

const VOLVOX = 'test_data/volvox/config.json'
const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
const SYNTENY_CONFIG = 'test_data/grape_peach_synteny/config.json'
const METHYLATION_CONFIG = 'test_data/methylation_test/config.json'
const DEMO_CONFIG = 'test_data/config_demo.json'
const CGIAB_BASE =
  'https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json'
const HPYLORI_BASE =
  'https://jbrowse.org/code/jb2/latest/?config=/demos/hpylori/config.json'

function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

function cgiabUrl(session?: object) {
  if (!session) {
    return CGIAB_BASE
  }
  return `${CGIAB_BASE}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

function hpyloriUrl(session: object) {
  return `${HPYLORI_BASE}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

const KG_BASE =
  'https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json'

function kgUrl(session: object) {
  return `${KG_BASE}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

// Three H. pylori strains stacked top-to-bottom, with a synteny track between
// each adjacent pair and a gene annotation track on each genome, used by the
// synteny_visualization.md tutorial.
function hpyloriSyntenyWithGenes() {
  return hpyloriUrl({
    views: [
      {
        type: 'LinearSyntenyView',
        tracks: ['26695_vs_chc155.pif', 'chc155_vs_j99.pif'],
        views: [
          {
            loc: 'NC_018939.1:177696-190329',
            assembly: 'hpylori_26695',
            tracks: ['hpylori_26695.gff'],
          },
          {
            loc: 'NZ_AP026446.1:287157-299790',
            assembly: 'hpylori_chc155',
            tracks: ['hpylori_chc155.gff'],
          },
          {
            loc: 'NZ_CP011330.1:872350-884982',
            assembly: 'hpylori_j99',
            tracks: ['hpylori_j99.gff'],
          },
        ],
      },
    ],
  })
}

export const specs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'volvox_alignments',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['volvox_cram_alignments'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'volvox_variants',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:5000-10000',
          tracks: ['volvox_test_vcf'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'variant_with_pileup',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1500-3500',
          tracks: ['volvox_filtered_vcf', 'volvox_cram_alignments'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'bigwig_xyplot',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: ['volvox_microarray'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'bigwig_line',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: ['volvox_microarray_line'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'bigwig/whole_genome_coverage',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-NTYME90lkA&password=G6Hkw',
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'sequence_track',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:20000-20050',
          tracks: ['volvox_refseq'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'alignments_soft_clipped',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-10000',
          tracks: [
            {
              trackId: 'volvox-long-reads-sv-bam',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                showSoftClipping: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'alignments/arc_display',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_sv_cram',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                pairedArcs: 'up',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'alignments/read_cloud',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_sv_cram',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                pairedArcs: 'samplot',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
  },

  {
    mode: 'url',
    name: 'dotplot',
    url: `?config=${DOTPLOT_CONFIG}&sessionName=Screenshot`,
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 30000,
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'linear_synteny',
    url: sessionSpec(SYNTENY_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_synteny_tblastx'],
          views: [
            { loc: 'Pp01:1-5000000', assembly: 'peach' },
            { loc: 'chr1:1-5000000', assembly: 'grape' },
          ],
        },
      ],
    }),
    settleMs: 6000,
  },

  {
    mode: 'url',
    name: 'alignments_track_arcs',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['spliced'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
  },

  {
    mode: 'url',
    name: 'hic_track',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr8:48,000,000-68,000,000',
          tracks: ['ncbi_gff_hg19', 'hic'],
        },
      ],
    }),
    readySelector: '[data-testid="hic_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // Gallery "CpG methylation" image: real COLO829_tumor nanopore reads colored
  // by methylation (red/blue marks) across UCSC CpG islands, the same data the
  // caption describes. Autogenerated from DEMO_CONFIG via the flat
  // configOverrides.colorBy override.
  {
    mode: 'url',
    name: 'modifications',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr20:18,493,346-18,511,070',
          tracks: [
            'cpgisland_ucsc_hg38',
            {
              trackId: 'COLO829_tumor.ht',
              displaySnapshot: {
                configOverrides: { colorBy: { type: 'methylation' } },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    // deep remote nanopore CRAM + methylation processing is slow over the network
    settleMs: 35000,
  },

  // TODO: restore COLO829 methylation specs (methylation/per_read_mod_bam and
  // methylation/colo829_cram_and_bedmethyl) on COLO829_tumor.ht and
  // COLO829_tumor.ht_modkit.bed_multi from DEMO_CONFIG at
  // chr20:10,000,000-10,002,000. They used the old nested
  // displaySnapshot: { PileupDisplay: { colorBy: { type: 'methylation' } } },
  // which MST rejected. LinearAlignmentsDisplay now takes flat overrides instead
  // — displaySnapshot: { configOverrides: { colorBy: { type: 'methylation' } } }
  // — so these can be restored once the remote data is verified to load
  // headless (see inverted_duplication below for the working flat-override form).

  // Gallery page + sv_visualization.md screenshots (live sessions from jbrowse.org)

  {
    mode: 'url',
    name: 'sv_inspector_importform_loaded',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'hg19',
          uri: 'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz',
        },
      ],
    }),
    readyText: 'CHROM',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'sv_inspector_begin',
    url: sessionSpec(VOLVOX, {
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'horizontally_flip',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-6pkcSXlbFL&password=ER28C',
    readyText: 'RefSeq',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'cnv',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64',
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // Curated: this shared session rendered correctly at the old 1280px viewport,
  // but at 1500px each breakpoint panel spans ~17% more bp, pushing the PacBio
  // CRAM past the "too much data" threshold so it force-loads instead of drawing
  // the reads + connecting splines the caption describes. The committed PNG is
  // the pre-regen capture; re-sharing the session at a tighter zoom would let
  // this autogen again.
  {
    mode: 'url',
    curated: true,
    name: 'skbr3_translocation',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-Swq8pJTX0z&password=yM41l',
    readyText: 'SKBR3',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'smalldel',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE',
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'insertion',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    readyText: 'HG002',
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'multisv',
    url: 'https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw',
    readyText: '1KGP',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'breakpoint_split_view',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-pjaAq1hNxB&password=Z9teR',
    readyText: 'SKBR3',
    settleMs: 12000,
  },

  // Alignments-track doc screenshots, autogenerated from real-human data in
  // DEMO_CONFIG (SKBR3 illumina / HG002 multi-track / 1KGP) so the colored
  // clip+insertion indicators and short-vs-long-read comparison match the doc
  // captions.

  // Colored clip/insertion indicator ticks above the coverage of a SKBR3
  // illumina CRAM (blue = left-clip, red = right-clip, purple = insertion).
  {
    mode: 'url',
    name: 'alignment_clipping_indicators',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:22,518,136-22,546,627',
          tracks: [
            'SKBR3_550bp_pcrFREE_S1_L001_AND_L002_R1_001.101bp.bwamem.ill.mapped.sort.cram',
          ],
        },
      ],
    }),
    readyText: 'SKBR3',
    readyTimeout: 60000,
    settleMs: 20000,
  },

  // Large-insertion indicator on HG002 long reads, with 'show soft clipping'
  // enabled on the short-read Illumina track below for comparison.
  {
    mode: 'url',
    name: 'insertion_indicators',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:55,705,770-55,706,090',
          tracks: [
            'nstd175.GRCh37.variant_call.vcf',
            'hg002_nanopore',
            {
              trackId: 'illumina_hg002',
              displaySnapshot: { showSoftClipping: true },
            },
          ],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 20000,
  },

  // Inverted duplication (CPX/INVdup HGSV_2721). Curated: the committed PNG is a
  // hand-annotated capture with the feature-details panel open (the caption
  // refers to it). The live link below opens the same real 1000-genomes data at
  // the same locus with pair-orientation coloring so readers can explore it and
  // open the variant details themselves. Autogen from this session produces a
  // mostly-grey pileup (few discordant pairs flagged at default thresholds at
  // this region), so it doesn't replace the curated image — revisit if the
  // orientation signal can be made as vivid as the 2021 capture.
  {
    mode: 'url',
    curated: true,
    name: 'inverted_duplication',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:39,657,584-39,661,200',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02768.final',
              displaySnapshot: {
                configOverrides: { colorBy: { type: 'pairOrientation' } },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    settleMs: 25000,
  },

  // C-GIAB live demo screenshots (load from jbrowse.org, not local test data)

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_start',
    url: cgiabUrl({
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    readyTimeout: 60000,
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_view',
    url: cgiabUrl({
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz',
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_show_all_regions',
    url: cgiabUrl({
      views: [{ type: 'LinearGenomeView', assembly: 'GRCh38_GIABv3' }],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/deletion_linear_view',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
          name: 'HG008-T PacBio HiFi 116x',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam.bai',
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
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5:97050000-97400000',
          tracks: [
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
            'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_with_bed_track',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5:1-180915260',
          tracks: [
            'HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram.all',
            'GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_result',
    url: cgiabUrl({
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'HG008T.hap1' }, { assembly: 'GRCh38_GIABv3' }],
          tracks: ['HG008T.hap1'],
        },
      ],
    }),
    settleMs: 20000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/synteny_view',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['HG008T.hap1'],
          views: [
            {
              loc: 'chr3:1-198295559 chr13:1-114364328',
              assembly: 'GRCh38_GIABv3',
            },
            {
              loc: 'haplotype1-0000015:1-300000000 haplotype1-0000016:1-300000000',
              assembly: 'HG008T.hap1',
            },
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // H. pylori synteny tutorial (synteny_visualization.md) — live hpylori demo

  {
    mode: 'url',
    // assemblies intentionally not pre-set: supplying them auto-launches the
    // DotplotView, but this tutorial image is specifically the import form
    name: 'sv_synteny/dotplot_import',
    url: hpyloriUrl({ views: [{ type: 'DotplotView', views: [{}, {}] }] }),
    readyText: 'Select assemblies for dotplot view',
    readyTimeout: 60000,
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'sv_synteny/dotplot',
    url: hpyloriUrl({
      views: [
        {
          type: 'DotplotView',
          tracks: ['26695_vs_j99.pif'],
          views: [{ assembly: 'hpylori_j99' }, { assembly: 'hpylori_26695' }],
        },
      ],
    }),
    settleMs: 18000,
  },

  {
    mode: 'url',
    name: 'sv_synteny/linear_synteny_genes',
    url: hpyloriSyntenyWithGenes(),
    readyText: 'NC_018939.1',
    readyTimeout: 60000,
    settleMs: 12000,
  },
]

// jbrowse.org hosts the same test_data/ configs (and the cgiab/hpylori demos)
// these specs load, so every spec's session can be opened as a live, clickable
// instance. The website Figure macro uses screenshotLiveUrls to link each
// screenshot to the running view that produced it.
const JBROWSE_LATEST = 'https://jbrowse.org/code/jb2/latest/'

export function specLiveUrl(spec: ScreenshotSpec): string | undefined {
  return spec.mode === 'url'
    ? spec.url.startsWith('http')
      ? spec.url
      : `${JBROWSE_LATEST}${spec.url}`
    : undefined
}

// screenshot name -> live-instance URL (all current specs are url-mode)
export const screenshotLiveUrls: Record<string, string> = Object.fromEntries(
  specs.flatMap(spec => {
    const url = specLiveUrl(spec)
    return url ? [[spec.name, url] as const] : []
  }),
)
