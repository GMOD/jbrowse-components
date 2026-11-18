import {
  DEMO_CONFIG,
  HG38_RMSK_TRACK,
  UCSC_HG38_CONFIG,
  VOLVOX,
  lgvSession,
  menuCascade,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'
import { pageTrack } from './pageTrack.ts'
import { SKBR3_SNIFFLES_VCF } from './sv.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const KG_TRACK =
  '1kGP_high_coverage_Illumina.chr1.filtered.SNV_INDEL_SV_phased_panel.vcf'

// A protospacer on the forward strand with its NGG PAM, in the window below.
const CRISPR_GUIDE = 'CGCTCGATCAAACTCATCAT'

const ROW_FOCUS_HINT = '[data-testid="row_focus_hint"]'

const CONSENSUS_FIELD = '.MuiDialog-paper textarea:not([aria-hidden])'

// Samples from five of ld_human's six populations, each labelled with its own.
const CLUSTERED_SAMPLES = {
  NA06989: 'CEU NA06989',
  NA07000: 'CEU NA07000',
  NA06984: 'CEU NA06984',
  NA07037: 'CEU NA07037',
  HG00171: 'FIN HG00171',
  HG00186: 'FIN HG00186',
  HG01593: 'PJL HG01593',
  HG02490: 'PJL HG02490',
  NA18486: 'YRI NA18486',
  NA18488: 'YRI NA18488',
  NA18525: 'CHB NA18525',
  NA18526: 'CHB NA18526',
}

export const userGuideSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'edit_plot/dialog',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['gff3tabix_genes_jexl_color_and_label'],
    }),
    readyText: 'ctgA',
    viewportHeight: 850,
    tooltip: 'hide',
    actions: [
      trackMenuIcon('gff3tabix_genes_jexl_color_and_label'),
      ...menuCascade(['Advanced', 'Edit plot...']),
      {
        type: 'click',
        selector: '[data-testid="cascading-menuitem-edit_plot..."]',
      },
      { type: 'waitForText', text: 'Show help' },
      { type: 'click', text: 'Show help' },
      { type: 'waitForText', text: 'The plot as a config file writes it' },
      { type: 'delay', ms: 500 },
    ],
    // The dialog centres in the window, so a crop rather than a shorter
    // window drops the empty band under it.
    crop: { x: 0, y: 0, width: 1500, height: 788 },
  },

  // A clean A/G heterozygous site, which ambiguity codes call R.
  {
    mode: 'url',
    name: 'consensus/iupac_panel',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:161,176,108-161,176,167',
      tracks: [{ trackId: 'illumina_hg002', height: 300 }],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    viewportHeight: 800,
    tooltip: 'hide',
    actions: [
      trackMenuIcon('illumina_hg002'),
      ...menuCascade([
        'Advanced',
        'Launch',
        'Consensus sequence (visible region)...',
      ]),
      {
        type: 'click',
        selector:
          '[data-testid="cascading-menuitem-consensus_sequence_(visible_region)..."]',
      },
      { type: 'waitForText', text: 'Show options' },
      { type: 'click', text: 'Show options' },
      {
        type: 'waitForText',
        text: 'Report disagreeing positions as IUPAC ambiguity codes',
      },
      {
        type: 'click',
        text: 'Report disagreeing positions as IUPAC ambiguity codes',
      },
      { type: 'waitForText', text: 'Min het fraction' },
      { type: 'waitForAppSettled' },
      { type: 'delay', ms: 800 },
    ],
    // The dialog centres in the window, so a crop rather than a shorter
    // window drops the empty band under it.
    crop: { x: 0, y: 0, width: 1500, height: 722 },
    annotations: [
      {
        type: 'text',
        text: 'A/G het site → R',
        fontSize: 15,
        leader: true,
        // A textarea has no element per character: the top of the sequence
        // line's 30th base, in the monospace field's character width, so the
        // arrowhead, which stops short of its target, ends under the R.
        anchor: {
          selector: CONSENSUS_FIELD,
          alignX: 'left',
          alignY: 'top',
          dx: 251,
          dy: 19,
        },
        dy: 54,
      },
    ],
  },

  {
    mode: 'url',
    name: 'sequence_search/crispr_guides',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [
        {
          type: 'FeatureTrack',
          trackId: 'crispr_spcas9',
          name: 'SpCas9 guides',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'CrisprGuideAdapter',
            minGcPercent: 40,
            maxGcPercent: 60,
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:5031-5110',
          tracks: ['volvox_refseq', { trackId: 'crispr_spcas9', height: 260 }],
        },
      ],
    }),
    readyText: 'SpCas9 guides',
    viewportHeight: 660,
    actions: [
      {
        type: 'click',
        anchor: { trackId: 'crispr_spcas9', feature: CRISPR_GUIDE },
      },
      { type: 'waitForText', text: 'gcPercent' },
    ],
  },

  {
    mode: 'url',
    name: 'spreadsheet/feature_menu',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'SpreadsheetView',
          displayName: 'SK-BR-3 Sniffles SV calls',
          assembly: 'hg19',
          uri: SKBR3_SNIFFLES_VCF,
        },
      ],
    }),
    formAssembly: true,
    readySelector: '[data-testid="spreadsheet-view-data-grid"] tbody tr button',
    readyTimeout: 60000,
    viewportHeight: 500,
    actions: [
      {
        type: 'click',
        selector: '[data-testid="spreadsheet-view-data-grid"] tbody tr button',
      },
      { type: 'waitForText', text: 'Open in breakpoint split view' },
    ],
  },

  {
    mode: 'url',
    name: 'variants/filter_sliders',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:155,020,000-155,030,000',
      tracks: [
        {
          trackId: KG_TRACK,
          variantLayout: 'columns',
          height: 500,
          filter: [{ field: 'minorAlleleFrequency', gte: 0.05 }],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 120000,
    viewportHeight: 760,
    tooltip: 'hide',
    actions: [
      trackMenuIcon(KG_TRACK),
      {
        type: 'waitForSelector',
        selector: '[data-testid^="cascading-submenu-filter_by"]',
      },
      {
        type: 'hover',
        selector: '[data-testid^="cascading-submenu-filter_by"]',
      },
      { type: 'waitForText', text: 'Max missingness' },
      { type: 'delay', ms: 500 },
    ],
  },

  // The pinned Max cuts the tallest bars, which the strip at the top marks.
  {
    mode: 'url',
    name: 'bigwig/y_axis_panel',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_microarray',
          height: 260,
          encoding: {
            y: {
              scale: { domainMax: 600 },
              rules: [{ value: 300, label: 'cutoff' }],
            },
          },
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 600,
    tooltip: 'hide',
    actions: [
      trackMenuIcon('volvox_microarray'),
      { type: 'waitForText', text: 'Y axis...' },
      { type: 'click', text: 'Y axis...' },
      { type: 'waitForText', text: 'Reference lines' },
      { type: 'delay', ms: 500 },
    ],
  },

  // The window and width of multirow/display_types_rows, the compose's lower
  // part. `rows: ''` is one row, which also keeps the picker from opening.
  {
    mode: 'url',
    name: 'multirow/one_row',
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
              rows: '',
              height: 60,
            },
          ],
        },
      ],
    }),
    readyText: 'RepeatMasker',
    readyTimeout: 60000,
    viewportWidth: 1000,
    viewportHeight: 270,
  },

  {
    mode: 'compose',
    name: 'multirow/rows_field_picker',
    parts: ['multirow/one_row', 'multirow/display_types_rows'],
  },

  // Twelve samples kept, then clustered over LCT/MCM6, so the chip and the
  // tree share rows. The connector fan ties columns to positions, which this
  // figure does not read.
  {
    mode: 'url',
    name: 'clustering/kept_rows',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      sessionTracks: [pageTrack('tutorials/ld_human.md', 'kgp_lct_haplotypes')],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr2:135,787,850-135,876,467',
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              height: 70,
              filter: ['geneLike'],
            },
            {
              trackId: 'kgp_lct_haplotypes',
              height: 440,
              connectors: { show: false },
              runClustering: true,
              rows: {
                field: 'haplotype',
                kept: Object.keys(CLUSTERED_SAMPLES),
                labels: CLUSTERED_SAMPLES,
              },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 120000,
    viewportHeight: 760,
    actions: [{ type: 'waitForSelector', selector: ROW_FOCUS_HINT }],
    annotations: [
      {
        type: 'text',
        text: 'Kept rows, and Show all',
        fontSize: 18,
        leader: true,
        anchor: { selector: ROW_FOCUS_HINT, alignX: 'right' },
        dx: 90,
      },
    ],
  },
]
