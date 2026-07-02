import { pickSyntenyTrackId } from './getSyntenyTracks.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

type UserOpened = Extract<ImportFormSyntenyTrack, { type: 'userOpened' }>

export type RowTrackAction =
  | { kind: 'open'; conf: NonNullable<UserOpened['value']> }
  | { kind: 'show'; trackId: string }

/**
 * What to do with an import-form synteny selection: open + show an uploaded
 * track, show a pre-configured one (the pick if still valid for the pair, else
 * the first available), or nothing for an explicit "none". Shared by the linear
 * synteny (per row pair) and dotplot import forms.
 */
export function resolveRowTrackAction(
  selection: ImportFormSyntenyTrack | undefined,
  syntenyTracksForPair: AnyConfigurationModel[],
): RowTrackAction | undefined {
  let action: RowTrackAction | undefined
  if (selection?.type === 'userOpened' && selection.value !== undefined) {
    action = { kind: 'open', conf: selection.value }
  } else if (!selection || selection.type === 'preConfigured') {
    const picked = selection?.type === 'preConfigured' ? selection.value : ''
    const trackId = pickSyntenyTrackId(picked, syntenyTracksForPair)
    action = trackId ? { kind: 'show', trackId } : undefined
  }
  return action
}
