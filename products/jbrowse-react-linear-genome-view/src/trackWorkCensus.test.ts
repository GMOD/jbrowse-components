import { readConfObject, setConf } from '@jbrowse/core/configuration'
import {
  callColumn,
  reactionColumn,
  recomputeColumn,
  runCensus,
} from '@jbrowse/display-test-utils'
import { waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

import { createViewState } from './index.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { CensusColumn } from '@jbrowse/display-test-utils'

jest.mock('./makeWorkerInstance', () => () => {})

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'x',
          start: 0,
          end: 10,
          seq: 'cattgttgcg',
        },
      ],
    },
  },
}

const conf = (trackId: string, name = trackId) => ({
  type: 'FeatureTrack',
  trackId,
  name,
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
})

const CATALOG = 500
const SESSION = 50
const SHOWN = ['c0', 'c1', 's0', 's1']

interface CensusSession {
  view: {
    tracks: unknown[]
    launchTrack: (id: string) => Promise<unknown>
    showTrack: (id: string) => unknown
    getTrack: (
      id: string,
    ) =>
      | { configuration: AnyConfigurationModel; displays: object[] }
      | undefined
  }
  editableTrackConfigs: Map<string, unknown>
  addSessionTrackConf: (conf: Record<string, unknown>) => unknown
  updateTrackConfiguration: (conf: { trackId: string }) => void
  resetTrackConfiguration: (trackId: string) => void
}

// Which shown tracks' resolved config woke a reader, as a display reading its
// config would. Reactions are told apart by name alone, so a step showing
// another display of the same type counts that display's first runs.
function wokeColumn(session: CensusSession): CensusColumn {
  const woke = new Set<string>()
  let counting = false
  const disposers = SHOWN.map(id => {
    const track = session.view.getTrack(id)!
    return autorun(() => {
      readConfObject(track.configuration, 'name')
      if (counting) {
        woke.add(id)
      }
    })
  })
  counting = true
  return {
    take: () => {
      const cell = `woke ${[...woke].join(',') || '-'}`
      woke.clear()
      return cell
    },
    reset: () => {
      woke.clear()
    },
    stop: () => {
      for (const dispose of disposers) {
        dispose()
      }
    },
  }
}

// The gate on what a track edit and an add cost the session: a count that
// rises is a regression the commit changing this snapshot explains.
test(`what a track edit and an add cost, ${CATALOG} catalog and ${SESSION} session tracks`, async () => {
  const state = createViewState({
    assembly,
    tracks: Array.from({ length: CATALOG }, (_, i) => conf(`c${i}`)),
  })
  const session = state.session as unknown as CensusSession
  for (let i = 0; i < SESSION; i++) {
    session.addSessionTrackConf(conf(`s${i}`))
  }
  const { view } = session
  for (const id of SHOWN) {
    await view.launchTrack(id)
  }
  await waitFor(() => {
    expect(view.tracks).toHaveLength(SHOWN.length)
  })
  const rename = (id: string) => () => {
    setConf(view.getTrack(id)!.configuration, 'name', `${id} edited`)
  }
  const table = await runCensus(
    [
      { name: 'edit a shown catalog track', run: rename('c0') },
      { name: 'edit a shown session track', run: rename('s0') },
      {
        name: 'edit an unshown catalog track',
        run: () => {
          session.updateTrackConfiguration(conf('c7', 'c7 edited'))
        },
      },
      {
        name: 'edit an unshown session track',
        run: () => {
          session.updateTrackConfiguration(conf('s7', 's7 edited'))
        },
      },
      {
        name: 'add a session track',
        run: () => {
          session.addSessionTrackConf(conf(`s${SESSION}`))
        },
      },
      {
        name: 'show a track',
        run: () => {
          view.showTrack('c2')
        },
      },
      {
        name: 'reset a shown track',
        run: () => {
          session.resetTrackConfiguration('c0')
        },
      },
    ],
    [
      recomputeColumn(session, 'trackBasesById', 'index'),
      recomputeColumn(session, 'tracks', 'list'),
      callColumn(session, 'withTrackEdits', 'resolves'),
      callColumn(session.editableTrackConfigs, 'set', 'copies'),
      wokeColumn(session),
      reactionColumn(SHOWN.flatMap(id => view.getTrack(id)!.displays)),
    ],
  )
  expect(table).toMatchSnapshot()
})
