import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { getTestSession } from './util.tsx'

interface DisplaySnap {
  type?: string
  displayId?: string
}

interface TrackSnap {
  trackId: string
  displays?: DisplaySnap[]
}

function showAndSnapshot(
  view: ReturnType<typeof getTestSession>['view'],
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
  const { session, view } = getTestSession()
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

  const added = session.addTrackConf(snap) as { trackId: string }
  const copy = showAndSnapshot(view, added.trackId)

  const origIds = new Set(orig.displays!.map(d => d.displayId))
  for (const d of copy.displays!) {
    expect(d.displayId).toBe(`${copy.trackId}-${d.type}`)
    expect(origIds.has(d.displayId)).toBe(false)
  }
})
