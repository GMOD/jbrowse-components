import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { getPluginManager } from './util.tsx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

interface DisplaySnap {
  type?: string
  displayId?: string
}

interface TrackSnap {
  trackId: string
  displays?: DisplaySnap[]
}

function getView() {
  const { rootModel } = getPluginManager()
  const session = rootModel.session!
  const view = session.views[0] as {
    showTrack: (id: string) => void
    tracks: { trackId: string; configuration: IAnyStateTreeNode }[]
  }
  return { session, view }
}

function showAndSnapshot(
  view: ReturnType<typeof getView>['view'],
  trackId: string,
): TrackSnap {
  view.showTrack(trackId)
  const track = view.tracks.find(t => t.trackId === trackId)!
  return getSnapshot(track.configuration)
}

// guards the "Copy track" displayId regeneration in getTrackActions: every
// display in a track config snapshot carries type + displayId in the canonical
// `${trackId}-${type}` form, so makeSnap can rebuild unique displayIds off the
// new trackId without colliding with the original (displayId is a
// types.identifier; a collision would crash MST)
test('copied track gets unique displayIds derived from the new trackId', () => {
  const { session, view } = getView()
  const orig = showAndSnapshot(view, 'volvox_filtered_vcf')

  // every display snapshot has the canonical id form
  for (const d of orig.displays!) {
    expect(d.type).toBeDefined()
    expect(d.displayId).toBe(`${orig.trackId}-${d.type}`)
  }

  // mirror makeSnap (admin path)
  const snap = structuredClone(orig)
  snap.trackId += '-12345'
  for (const d of snap.displays!) {
    d.displayId = `${snap.trackId}-${d.type}`
  }

  const added = session.addTrackConf!(snap) as { trackId: string }
  const copy = showAndSnapshot(view, added.trackId)

  const origIds = new Set(orig.displays!.map(d => d.displayId))
  for (const d of copy.displays!) {
    expect(d.displayId).toBe(`${copy.trackId}-${d.type}`)
    expect(origIds.has(d.displayId)).toBe(false)
  }
})
