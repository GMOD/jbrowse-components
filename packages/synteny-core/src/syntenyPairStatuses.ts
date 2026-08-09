import { resolveSyntenyTrackActions } from './resolveRowTrackAction.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * What launching would do to each row pair. Launch's own answer
 * (resolveSyntenyTrackActions) is the only input, so the row icons and what
 * launch really does can't drift apart.
 *
 * - `configured`: a track will be applied.
 * - `unfinishedUpload`: the user started a "New track" upload that cannot be
 *   applied. No file chosen yet, or its baked assemblies no longer match this
 *   pair. The only state that blocks Launch, because it is unfinished input
 *   rather than an absence, and launching would quietly drop it.
 * - `noTrackAvailable`: nothing connects these two rows. Perfectly launchable,
 *   the rows stack with no ribbons between them, but a reorder might fix it, so
 *   it is what offers Auto-arrange.
 * - `deliberateNone`: the user chose None. Same result as `noTrackAvailable`, but
 *   asked for, so it does not go looking for a better row order.
 */
export type PairStatus =
  | 'configured'
  | 'unfinishedUpload'
  | 'noTrackAvailable'
  | 'deliberateNone'

/**
 * One status per adjacent row pair. A dotplot passes its two assemblies and gets
 * a single entry, which is why this lives here rather than in the synteny form:
 * both import forms gate Launch on the same answer, and a dotplot that launched
 * an unfinished upload anyway is the same silent empty view the synteny form
 * already refuses.
 */
export function syntenyPairStatuses({
  tracks,
  selections,
  assemblyNames,
}: {
  tracks: AnyConfigurationModel[]
  selections: (ImportFormSyntenyTrack | undefined)[]
  assemblyNames: string[]
}): PairStatus[] {
  return resolveSyntenyTrackActions({
    tracks,
    selections,
    assemblyNames,
  }).map((action, idx) =>
    action
      ? 'configured'
      : selections[idx]?.type === 'userOpened'
        ? 'unfinishedUpload'
        : selections[idx]?.type === 'none'
          ? 'deliberateNone'
          : 'noTrackAvailable',
  )
}

/**
 * A pair with nothing to draw is launchable: the rows just stack with no
 * ribbons. Only an upload the user started and hasn't finished blocks, since
 * launching would quietly drop it.
 */
export function blockedByUnfinishedUpload(statuses: PairStatus[]) {
  return statuses.includes('unfinishedUpload')
}
