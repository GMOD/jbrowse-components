import { getConf, setConf } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { baseDisplayConfig } from '@jbrowse/tree-sidebar'
import { waitFor } from '@testing-library/react'

import createViewState from './createViewState.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('./makeWorkerInstance', () => () => {})

// A track the session added, the way a host's `openTracks`, a session spec or
// an agent adds one: its `sessionTracks` entry is the base its edits diff
// against.

const assemblies = [
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
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  },
]

interface Session {
  addSessionTrackConf: (conf: Record<string, unknown>) => unknown
  addView: (type: string, snapshot: Record<string, unknown>) => View
  trackConfigDeltas: Record<string, Record<string, unknown>>
}

interface View {
  launchTrack: (trackId: string) => Promise<unknown>
  getTrack: (trackId: string) => Track | undefined
}

interface Track {
  configuration: AnyConfigurationModel
  displays: RowDisplay[]
}

interface RowDisplay {
  configuration: AnyConfigurationModel
  rowArrangementIsCustom: boolean
  setRowOrder: (rows: { name: string }[]) => void
  resetRowArrangement: () => void
}

function sessionWith(track: Record<string, unknown>) {
  const state = createViewState({ config: { assemblies } })
  const session = state.session as unknown as Session
  session.addSessionTrackConf(track)
  return session
}

async function shownIn(session: Session, trackId: string) {
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10 },
    ],
  })
  await view.launchTrack(trackId)
  await waitFor(() => {
    expect(view.getTrack(trackId)).toBeTruthy()
  })
  return view.getTrack(trackId)!
}

test('two views editing one session track store one delta', async () => {
  const session = sessionWith({
    type: 'FeatureTrack',
    trackId: 'genes',
    name: 'Genes',
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const first = await shownIn(session, 'genes')
  const second = await shownIn(session, 'genes')
  expect(second.configuration).toBe(first.configuration)

  setConf(first.configuration, 'name', 'Edited genes')

  await waitFor(() => {
    expect(session.trackConfigDeltas).toEqual({
      genes: { trackId: 'genes', name: 'Edited genes' },
    })
  })
  expect(getConf(second, 'name')).toBe('Edited genes')
})

test('a row display on a session track resets to the arrangement it was added with', async () => {
  const displayId = 'subtracks-LinearWiggleDisplay'
  const added = {
    type: 'LinearWiggleDisplay',
    displayId,
    rows: { field: 'source', domain: ['c', 'a'], labels: { c: 'Third' } },
    rowColor: { domain: ['a'], range: ['red'] },
  }
  const session = sessionWith({
    type: 'MultiQuantitativeTrack',
    trackId: 'subtracks',
    name: 'Subtracks',
    assemblyNames: ['volvox'],
    adapter: { type: 'MultiWiggleAdapter', bigWigs: ['a.bw', 'b.bw', 'c.bw'] },
    displays: [added],
  })
  const track = await shownIn(session, 'subtracks')
  const display = track.displays[0]!
  const arrangement = () =>
    getSnapshot(display.configuration.rows) as Record<string, unknown>

  expect(baseDisplayConfig(display)).toMatchObject(added)
  expect(display.rowArrangementIsCustom).toBe(false)

  display.setRowOrder([{ name: 'b' }, { name: 'a' }, { name: 'c' }])
  expect(display.rowArrangementIsCustom).toBe(true)
  expect(session.trackConfigDeltas.subtracks).toBeDefined()

  display.resetRowArrangement()
  expect(arrangement()).toEqual(added.rows)
  expect(getSnapshot(display.configuration.rowColor)).toEqual(added.rowColor)
  expect(display.rowArrangementIsCustom).toBe(false)
  expect(session.trackConfigDeltas).toEqual({})
})
