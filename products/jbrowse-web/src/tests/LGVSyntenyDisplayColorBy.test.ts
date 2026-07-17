import { createTestSession } from '../rootModel/index.ts'

import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('../makeWorkerInstance', () => () => {})

// The LGVSyntenyDisplay composes the alignments state model, so it inherits
// every read-oriented color scheme unless its menu curates them away. These
// specs drive the real model (not a menu stub) so the curation is checked
// against what the display actually offers.
function syntenyDisplay() {
  const session = createTestSession({
    jbrowseConfig: {
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 100,
                  seq: 'A'.repeat(100),
                },
              ],
            },
          },
        },
      ],
      tracks: [
        {
          type: 'SyntenyTrack',
          trackId: 'volvox_synteny',
          assemblyNames: ['volvox', 'volvox_random'],
          adapter: { type: 'FromConfigAdapter', features: [] },
          displays: [
            {
              type: 'LGVSyntenyDisplay',
              displayId: 'volvox_synteny-LGVSyntenyDisplay',
            },
          ],
        },
      ],
    },
    sessionSnapshot: {
      views: [
        {
          id: 'view1',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 'track1',
              type: 'SyntenyTrack',
              configuration: 'volvox_synteny',
              displays: [{ id: 'display1', type: 'LGVSyntenyDisplay' }],
            },
          ],
        },
      ],
    },
  })
  // displays[0] is `any`, so annotate to keep phantom getters from typechecking
  const display = session.views[0].tracks[0].displays[0] as {
    trackMenuItems: () => MenuItem[]
    colorBy: { type: string }
    setColorScheme: (colorBy: { type: string }) => void
  }
  return display
}

function colorByLabels(display: ReturnType<typeof syntenyDisplay>) {
  const colorBy = display
    .trackMenuItems()
    .find(i => 'label' in i && i.label === 'Color by...')
  if (!colorBy || !('subMenu' in colorBy)) {
    throw new Error('no Color by... menu')
  }
  return colorBy.subMenu.map(i => ('label' in i ? i.label : ''))
}

test('offers only the schemes a PAF block can answer', () => {
  expect(colorByLabels(syntenyDisplay())).toEqual([
    'Normal',
    'Strand',
    'Mapping quality',
    'Query name',
  ])
})

test('drops the read-oriented schemes it inherits from the alignments model', () => {
  const labels = colorByLabels(syntenyDisplay())
  expect(labels).not.toContain('Paired end')
  expect(labels).not.toContain('Bisulfite / EM-seq')
  expect(labels).not.toContain('Modifications')
})

test('picking Query name stores the scheme through the config slot', () => {
  const display = syntenyDisplay()
  display.setColorScheme({ type: 'mateRefName' })
  expect(display.colorBy).toEqual({ type: 'mateRefName' })
})
