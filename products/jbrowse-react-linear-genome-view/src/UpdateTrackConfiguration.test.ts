import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { createViewState } from './index.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('./makeWorkerInstance', () => () => {})

// Unlike jbrowse-web (app-core config, `tracks` = types.frozen plain objects),
// this embedded product uses product-core's config where `tracks` is a
// types.array of live MST config nodes. The delta merge must snapshot a node
// base before layering the delta; otherwise `{...node}` leaks the node's live
// child config nodes (e.g. `adapter`) into the merged config that then gets
// hydrated — see toPlainConfig in SessionTracks.ts.
const TRACK_ID = 'testtrack'

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'cattgttgcg' },
      ],
    },
  },
}

const track = {
  type: 'FeatureTrack',
  trackId: TRACK_ID,
  name: 'Original name',
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
}

interface DeltaSession {
  tracks: AnyConfigurationModel[]
  trackConfigDeltas: Record<string, { trackId: string; [key: string]: unknown }>
  updateTrackConfiguration: (snap: { trackId: string; [k: string]: unknown }) => void
}

test('a non-admin edit over an MST-node config base merges cleanly (no leaked live nodes)', () => {
  const state = createViewState({ assembly, tracks: [track] })
  const session = state.session as unknown as DeltaSession

  const base = session.tracks.find(t => t.trackId === TRACK_ID)!
  session.updateTrackConfiguration({
    ...(getSnapshot(base) as { trackId: string }),
    name: 'Edited name',
  })

  // minimal delta (works whether base is a node or a snapshot, since config
  // nodes proxy property access to values)
  expect(Object.keys(session.trackConfigDeltas[TRACK_ID]!).sort()).toEqual([
    'name',
    'trackId',
  ])

  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
  // the merged config must be plain data — a child config node spread in from
  // the live jbrowse tree would be aliased across two trees
  const adapter = (resolved as unknown as { adapter: unknown }).adapter
  expect(isStateTreeNode(adapter)).toBe(false)
})
