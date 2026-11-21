import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// tutorials/prokka_genbank.md: Prokka's GenBank file for the Sakai assembly,
// read as both the assembly and the `sakai_prokka` track
const CONFIG = 'test_data/prokka_sakai/config.json'

export const prokkaGenbankSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'prokka_genbank/stx_protein',
    url: lgvSession(CONFIG, {
      assembly: 'sakai',
      loc: 'NC_002695.2:1,266,700-1,268,700',
      tracks: [{ trackId: 'sakai_prokka', height: 110 }],
    }),
    readyText: 'stxB_1',
    readyTimeout: 90000,
    viewportHeight: 900,
    actions: [
      { type: 'click', anchor: { trackId: 'sakai_prokka', feature: 'stxA_1' } },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'click', text: 'Protein' },
    ],
  },
  {
    mode: 'url',
    name: 'prokka_genbank/po157_ring',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'CircularView',
          assembly: 'sakai',
          displayedRegionNames: ['NC_002128.1'],
          height: 780,
          tracks: [{ trackId: 'sakai_prokka', height: 200 }],
        },
      ],
    }),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },
]
