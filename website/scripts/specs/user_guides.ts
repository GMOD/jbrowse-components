import {
  DEMO_CONFIG,
  HG38_RMSK_TRACK,
  VOLVOX,
  lgvSession,
  menuCascade,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'
import { SKBR3_SNIFFLES_VCF } from './sv.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const KG_TRACK =
  '1kGP_high_coverage_Illumina.chr1.filtered.SNV_INDEL_SV_phased_panel.vcf'

// A protospacer on the forward strand with its NGG PAM, in the window below.
const CRISPR_GUIDE = 'CGCTCGATCAAACTCATCAT'

const ROWS_FIELD = '[data-testid="rows-by-attribute"]'

const ROW_FOCUS_HINT = '[data-testid="row_focus_hint"]'

const CLUSTERED_SAMPLES = [
  'HG00096',
  'HG00097',
  'HG00099',
  'HG00100',
  'HG00101',
  'HG00102',
  'HG00103',
  'HG00104',
  'HG00106',
  'HG00108',
  'HG00109',
  'HG00110',
  'HG00111',
  'HG00112',
  'HG00113',
  'HG00114',
]

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
        { type: 'SpreadsheetView', assembly: 'hg19', uri: SKBR3_SNIFFLES_VCF },
      ],
    }),
    formAssembly: true,
    readySelector: '.MuiDataGrid-row[data-rowindex="0"]',
    readyTimeout: 60000,
    viewportHeight: 500,
    actions: [
      {
        type: 'click',
        selector: '.MuiDataGrid-row[data-rowindex="0"] button',
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

  // No rows stated and no `type` in a RepeatMasker table, so the display
  // opens the picker itself.
  {
    mode: 'url',
    name: 'multirow/rows_field_picker',
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
              height: 120,
            },
          ],
        },
      ],
    }),
    readyText: 'One row per attribute',
    readyTimeout: 60000,
    viewportHeight: 530,
    actions: [
      { type: 'click', selector: ROWS_FIELD },
      { type: 'press', key: 'End' },
      ...Array.from({ length: 'type'.length }, () => ({
        type: 'press' as const,
        key: 'Backspace' as const,
      })),
      { type: 'type', selector: ROWS_FIELD, value: 'rep' },
      { type: 'waitForText', text: 'repFamily' },
    ],
  },

  // Sixteen samples kept, then clustered, so the chip and the tree share rows.
  {
    mode: 'url',
    name: 'clustering/kept_rows',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_test_vcf',
          variantLayout: 'columns',
          height: 360,
          runClustering: true,
          rows: { kept: CLUSTERED_SAMPLES },
        },
      ],
    }),
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 60000,
    viewportHeight: 600,
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
