import { getContainingTrack } from '@jbrowse/core/util/mstUtils'

import type { ScoreAxisDisplay } from './types.ts'

// Each write lands in the session at once rather than after the track's
// debounced save, so undo steps one edit at a time.
export function writeThrough(display: ScoreAxisDisplay, edit: () => void) {
  edit()
  getContainingTrack(display).persistConfigurationNow?.()
}
