import { SimpleFeature } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { SvInspectorViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function bnd(uniqueId: string, start: number, alt: string, event?: string) {
  return {
    feature: { uniqueId, refName: 'ctgA', start, end: start + 1, ALT: [alt] },
    cellData: { 'INFO.SVTYPE': 'BND', 'INFO.EVENT': event },
  }
}

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: ['ctgA', 'ctgB'].map(refName => ({
        refName,
        uniqueId: refName,
        start: 0,
        end: 10_000,
        seq: 'a'.repeat(10_000),
      })),
    },
  },
}

const rows = [
  bnd('a', 100, 'C]ctgB:900]', 'cluster_1'),
  bnd('b', 5000, 'C]ctgB:70]', 'cluster_1'),
  bnd('c', 9000, 'C]ctgB:20]'),
]

test('selecting a record of an event names the chords of that event', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  const view = (await session.launchView(
    'SvInspectorView',
    {},
  )) as SvInspectorViewModel
  await session.assemblyManager.waitForAssembly('volvox')
  view.spreadsheetView.displaySpreadsheet({
    assemblyName: 'volvox',
    columns: [{ name: 'INFO.SVTYPE' }, { name: 'INFO.EVENT' }],
    rowSet: { rows },
  })
  expect(view.highlightedChordIds).toBeUndefined()

  session.setSelection(new SimpleFeature(rows[1]!.feature))
  expect(view.highlightedChordIds).toEqual(['a', 'b'])

  await when(() => view.circularView.tracks.length > 0)
  const [display] = view.circularView.tracks[0]!.displays
  expect(display.highlightedFeatureIds).toEqual(['a', 'b'])

  session.setSelection(new SimpleFeature(rows[2]!.feature))
  expect(view.highlightedChordIds).toBeUndefined()
  expect(display.highlightedFeatureIds).toBeUndefined()
})
