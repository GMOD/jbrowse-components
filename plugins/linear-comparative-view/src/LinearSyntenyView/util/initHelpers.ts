import {
  applyInitSettings as applyDeclaredSettings,
  warnInitSettings,
} from '@jbrowse/core/util/applyInitSettings'

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

// The init keys this view writes code for. Everything else in an init blob is
// matched against the view's own declared properties and applied verbatim —
// see `applyInitSettings` in core for why that is the default and this the
// exception. A new display setting joins the model and nothing else; the only
// way it belongs on this list is if one of the three reasons below applies, and
// there is no fourth:
//
//   - no property behind it, it means "do something": `views`,
//     `autoDiagonalize`, `collapseEmptyRows`
//   - there is a property behind it and setting it is not the whole job:
//     `sameScale` latches the mode AND zooms every row onto the shared scale,
//     which the flag alone does not do
//   - the name collides with a property meaning something else: a spec's
//     `tracks` is trackIds per level, the model's is not that shape
//   - it is ordered against another step: `levelHeights` has to win over the
//     auto-scale pass that runs immediately before it
export const LINEAR_SYNTENY_INIT_COMMANDS = [
  'views',
  'tracks',
  'levelHeights',
  'autoDiagonalize',
  'sameScale',
  'collapseEmptyRows',
] as const

/**
 * Apply the display settings an init block carries. Called after
 * `autoScaleLevelHeights`, which `levelHeights` is allowed to override.
 */
export function applyInitSettings(
  self: LinearSyntenyViewModel,
  init: LinearSyntenyViewInit,
) {
  warnInitSettings(
    'LinearSyntenyView init',
    applyDeclaredSettings(self, init, {
      commands: LINEAR_SYNTENY_INIT_COMMANDS,
    }),
  )

  if (init.levelHeights) {
    for (const [i, h] of init.levelHeights.entries()) {
      self.levels[i]?.setHeight(h)
    }
  }
}
