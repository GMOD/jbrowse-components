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

const DISPLAY_ID = `${TRACK_ID}-LinearBasicDisplay`

const track = {
  type: 'FeatureTrack',
  trackId: TRACK_ID,
  name: 'Original name',
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
  displays: [{ type: 'LinearBasicDisplay', displayId: DISPLAY_ID, height: 100 }],
}

interface DeltaSession {
  tracks: AnyConfigurationModel[]
  trackConfigDeltas: Record<string, { trackId: string; [key: string]: unknown }>
  updateTrackConfiguration: (snap: { trackId: string; [k: string]: unknown }) => void
}

interface DisplaysHolder { displays: { displayId: string; height?: number }[] }

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

test('a display-slot edit is a per-display delta, merges by displayId, no leaked nodes', () => {
  const state = createViewState({ assembly, tracks: [track] })
  const session = state.session as unknown as DeltaSession

  const base = session.tracks.find(t => t.trackId === TRACK_ID)!
  const baseSnap = getSnapshot(base) as unknown as DisplaysHolder
  const baseDisplayCount = baseSnap.displays.length

  // edit only the configured display's height; the FeatureTrack also
  // auto-materializes other displays which must stay untouched
  session.updateTrackConfiguration({
    ...(getSnapshot(base) as { trackId: string }),
    displays: baseSnap.displays.map(d =>
      d.displayId === DISPLAY_ID ? { ...d, height: 321 } : d,
    ),
  })

  // delta carries only the edited display, keyed by displayId, changed slot only
  const delta = session.trackConfigDeltas[TRACK_ID]!
  const deltaDisplays = (delta as unknown as DisplaysHolder).displays
  expect(deltaDisplays).toHaveLength(1)
  expect(deltaDisplays[0]!.displayId).toBe(DISPLAY_ID)
  expect(Object.keys(deltaDisplays[0]!).sort()).toEqual(['displayId', 'height'])
  expect(deltaDisplays[0]!.height).toBe(321)

  // merged config keeps every base display; the edited one gains the slot, and
  // no display is a leaked live node
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  const merged = resolved as unknown as DisplaysHolder
  expect(merged.displays).toHaveLength(baseDisplayCount)
  expect(
    merged.displays.find(d => d.displayId === DISPLAY_ID)!.height,
  ).toBe(321)
  for (const d of merged.displays) {
    expect(isStateTreeNode(d)).toBe(false)
  }
})
