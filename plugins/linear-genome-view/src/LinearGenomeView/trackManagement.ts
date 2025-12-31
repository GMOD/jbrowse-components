import { cast } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from './model'

/**
 * Move track down one position in the track list
 */
export function moveTrackDown(self: LinearGenomeViewModel, id: string) {
  const idx = self.tracks.findIndex(v => v.id === id)
  if (idx !== -1 && idx < self.tracks.length - 1) {
    self.tracks.splice(idx, 2, self.tracks[idx + 1], self.tracks[idx])
  }
}

/**
 * Move track up one position in the track list
 */
export function moveTrackUp(self: LinearGenomeViewModel, id: string) {
  const idx = self.tracks.findIndex(track => track.id === id)
  if (idx > 0) {
    self.tracks.splice(idx - 1, 2, self.tracks[idx], self.tracks[idx - 1])
  }
}

/**
 * Move track to the top of the track list
 */
export function moveTrackToTop(self: LinearGenomeViewModel, id: string) {
  const track = self.tracks.find(track => track.id === id)
  if (track) {
    self.tracks = cast([track, ...self.tracks.filter(t => t.id !== id)])
  }
}

/**
 * Move track to the bottom of the track list
 */
export function moveTrackToBottom(self: LinearGenomeViewModel, id: string) {
  const track = self.tracks.find(track => track.id === id)
  if (track) {
    self.tracks = cast([...self.tracks.filter(t => t.id !== id), track])
  }
}

/**
 * Move a track to a specific position (before the target track)
 */
export function moveTrack(
  self: LinearGenomeViewModel,
  movingId: string,
  targetId: string,
) {
  const oldIndex = self.tracks.findIndex(track => track.id === movingId)
  if (oldIndex === -1) {
    throw new Error(`Track ID ${movingId} not found`)
  }
  const newIndex = self.tracks.findIndex(track => track.id === targetId)
  if (newIndex === -1) {
    throw new Error(`Track ID ${targetId} not found`)
  }

  const tracks = self.tracks.filter((_, idx) => idx !== oldIndex)
  tracks.splice(newIndex, 0, self.tracks[oldIndex])
  self.tracks = cast(tracks)
}
