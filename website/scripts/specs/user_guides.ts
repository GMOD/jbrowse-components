import {
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
]
