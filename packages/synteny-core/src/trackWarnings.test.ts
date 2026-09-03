import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { collectTrackWarnings } from './trackWarnings.ts'

import type { ComparativeWarning } from './ComparativeFetchMixin.ts'
import type { WarningSource } from './trackWarnings.ts'

const TrackConf = ConfigurationSchema('Track', {
  name: { type: 'string', defaultValue: '' },
})

// A display is only ever read for its warnings and its parent track's name, so
// the fixture is a real config node (getConf reads through one) under a plain
// MST wrapper standing in for the display.
const Display = types.model('Display', {
  parentTrack: types.model('Track', { configuration: TrackConf }),
  warnings: types.frozen<ComparativeWarning[]>(),
})

function display(name: string, warnings: ComparativeWarning[]): WarningSource {
  return Display.create({
    parentTrack: { configuration: { name } },
    warnings,
  })
}

const swapped: ComparativeWarning = {
  message: 'The assemblies appear to be in the wrong order',
  effect: 'try switching them',
}

test('each row is named by the track that raised it', () => {
  expect(
    collectTrackWarnings([
      display('hg38_vs_mm10.paf', [swapped]),
      display('hg38_vs_rn7.paf', [swapped]),
    ]),
  ).toEqual([
    { name: 'hg38_vs_mm10.paf', warnings: [swapped] },
    { name: 'hg38_vs_rn7.paf', warnings: [swapped] },
  ])
})

// The affordance that shows the report gates on this being empty, so a display
// with nothing to say must not contribute a row with an empty list.
test('a track that raised nothing contributes no row', () => {
  expect(
    collectTrackWarnings([
      display('quiet.paf', []),
      display('loud.paf', [swapped]),
    ]),
  ).toEqual([{ name: 'loud.paf', warnings: [swapped] }])
  expect(collectTrackWarnings([display('quiet.paf', [])])).toEqual([])
})
