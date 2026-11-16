import {
  DEMO_CONFIG,
  VOLVOX,
  lgvSession,
  menuCascade,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

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
]
