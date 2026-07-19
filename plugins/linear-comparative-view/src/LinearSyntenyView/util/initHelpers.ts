import type { LinearSyntenyViewModel } from '../model.ts'
import type { LinearSyntenyViewInit } from '../types.ts'

// init.tracks accepts two shapes: a flat string[] is shorthand for "all on
// level 0", while string[][] is one entry per level (the gap between views[i]
// and views[i+1]). The type guard lets us branch without `as` casts on the
// union-of-arrays.
function isFlatTrackList(tracks: string[] | string[][]): tracks is string[] {
  return typeof tracks[0] === 'string'
}

export function normalizeTrackLevels(
  tracks: string[] | string[][],
): string[][] {
  return isFlatTrackList(tracks) ? [tracks] : tracks
}

// Apply the one-time-on-load display settings carried in an init block. Order
// matters only for levelHeights, which intentionally runs after the rest so it
// can override per-level heights set by an earlier autoScaleLevelHeights pass.
export function applyInitSettings(
  self: LinearSyntenyViewModel,
  init: LinearSyntenyViewInit,
) {
  if (init.colorBy) {
    self.setColorBy(init.colorBy)
  }
  if (init.showColorLegend !== undefined) {
    self.setShowColorLegend(init.showColorLegend)
  }
  if (init.minAlignmentLength !== undefined) {
    self.setMinAlignmentLength(init.minAlignmentLength)
  }
  if (init.drawCurves !== undefined) {
    self.setDrawCurves(init.drawCurves)
  }
  if (init.cigarMode !== undefined) {
    self.setCigarMode(init.cigarMode)
  }
  if (init.alpha !== undefined) {
    self.setAlpha(init.alpha)
  }
  if (init.fadeThinAlignmentsMode !== undefined) {
    self.setFadeThinAlignmentsMode(init.fadeThinAlignmentsMode)
  } else if (init.fadeThinAlignments !== undefined) {
    self.setFadeThinAlignmentsMode(init.fadeThinAlignments ? 'on' : 'off')
  }
  if (init.levelHeights) {
    for (const [i, h] of init.levelHeights.entries()) {
      self.levels[i]?.setHeight(h)
    }
  }
}
