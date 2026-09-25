import { getConf } from '@jbrowse/core/configuration'

import createViewState, { createViewStateAsync } from './createViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { SessionSnapshot as RestoredSessionSnapshot } from '@jbrowse/product-core'

// A v4 session reaches an embedded product through two doors — the `session`
// prop at create, and the `session` option a decoded share link goes through —
// and each one used to throw on a display type this build retired, taking the
// whole engine with it rather than one track. product-core's app root models
// run the same migration in their own setSession. ADR-168.

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    type: 'MultiQuantitativeTrack',
    trackId: 'multi',
    name: 'multi',
    assemblyNames: ['volvox'],
    adapter: { type: 'MultiWiggleAdapter', bigWigs: ['a.bw', 'b.bw'] },
  },
]

// what every v4.3.0 multi-bigwig track wrote, with the plot and the row order a
// reader picked: the display type is gone and both props are config slots now
function v4Session(display: Record<string, unknown>) {
  return {
    name: 'v4',
    view: {
      id: 'lgv',
      type: 'LinearGenomeView',
      offsetPx: 0,
      bpPerPx: 1,
      displayedRegions: [
        { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
      ],
      tracks: [
        {
          id: 't1',
          type: 'MultiQuantitativeTrack',
          configuration: 'multi',
          displays: [
            {
              id: 'd1',
              type: 'MultiLinearWiggleDisplay',
              configuration: 'multi-MultiLinearWiggleDisplay',
              ...display,
            },
          ],
        },
      ],
    },
  }
}

// The members read below, rather than the display union the view's `tracks`
// gives: a test that reaches one display's getters names them.
interface WiggleDisplaySelf extends IStateTreeNode {
  type: string
  isRowLayout: boolean
  renderingType: string
  rowDomain: string[]
  configuration: AnyConfigurationModel
}

function displayOf(state: ViewModel) {
  const [track] = state.session.view.tracks
  return track!.displays[0] as unknown as WiggleDisplaySelf
}

// the door a decoded share link goes through, open-shaped because its contents
// are only known at runtime
const restored = (snap: RestoredSessionSnapshot) =>
  createViewStateAsync({ assembly, tracks, session: snap })

test('a v4 multi-wiggle share link opens as rows, in its order', async () => {
  const display = displayOf(
    await restored(
      v4Session({
        rendererTypeNameState: 'multirowdensity',
        layout: [
          { name: 'b', source: 'b', color: 'red' },
          { name: 'A sample', source: 'a' },
        ],
      }),
    ),
  )

  expect(display.type).toBe('LinearWiggleDisplay')
  expect(display.isRowLayout).toBe(true)
  expect(display.renderingType).toBe('density')
  expect(display.rowDomain).toEqual(['b', 'a'])
  expect(getConf(display, ['rowColor', 'range'])).toEqual(['red'])
})

test('a v4 multi-wiggle left overlaid stays overlaid', async () => {
  const display = displayOf(
    await restored(v4Session({ rendererTypeNameState: 'multixyplot' })),
  )

  expect(display.isRowLayout).toBe(false)
  expect(display.renderingType).toBe('xyplot')
})

// The other door: the session prop at create, which a host authoring one in
// TypeScript writes and a stored snapshot also reaches.
test('a v4 multi-wiggle opens through defaultSession too', async () => {
  const display = displayOf(
    await createViewStateAsync({
      assembly,
      tracks,
      defaultSession: v4Session({ rendererTypeNameState: 'multirowxy' }),
    }),
  )

  expect(display.type).toBe('LinearWiggleDisplay')
  expect(display.isRowLayout).toBe(true)
  expect(display.renderingType).toBe('xyplot')
})

// The config model's `tracks` is frozen, and the track selector reads those
// entries before any track hydrates.
test('a config.json track spelling the retired type carries the current name', () => {
  const state = createViewState({
    assembly,
    tracks: [
      {
        ...tracks[0]!,
        displays: [
          { type: 'MultiLinearWiggleDisplay', defaultRendering: 'multirowxy' },
        ],
      },
    ],
  })

  expect(state.config.tracks[0]!.displays).toEqual([
    { type: 'LinearWiggleDisplay', defaultRendering: 'xyplot', rows: 'source' },
  ])
})
