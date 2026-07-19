import { pickSyntenyTrackId, sameAssemblySet } from './getSyntenyTracks.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

type UserOpened = Extract<ImportFormSyntenyTrack, { type: 'userOpened' }>

export type RowTrackAction =
  | { kind: 'open'; conf: NonNullable<UserOpened['value']> }
  | { kind: 'show'; trackId: string }

/**
 * What to do with an import-form synteny selection for a row pair: open + show
 * an uploaded track, show a pre-configured one (the pick if still valid for the
 * pair, else the first available), or nothing for an explicit "none" or an
 * unfinished/stale upload. Shared by the linear synteny (per row pair) and
 * dotplot import forms.
 *
 * `pairAssemblies` are the assemblies the row pair currently references. An
 * uploaded track bakes in the assemblies it was created against, but selections
 * are indexed by row position, so removing a row or changing an assembly can
 * strand a `userOpened` track on a different pair. Such a stranded upload is
 * ignored rather than applied to the wrong assemblies.
 */
export function resolveRowTrackAction(
  selection: ImportFormSyntenyTrack | undefined,
  syntenyTracksForPair: AnyConfigurationModel[],
  pairAssemblies: string[],
): RowTrackAction | undefined {
  if (selection?.type === 'userOpened') {
    const conf = selection.value
    return conf && sameAssemblySet(conf.assemblyNames, pairAssemblies)
      ? { kind: 'open', conf }
      : undefined
  }
  if (selection?.type === 'none') {
    return undefined
  }
  const picked = selection?.type === 'preConfigured' ? selection.value : ''
  const trackId = pickSyntenyTrackId(picked, syntenyTracksForPair)
  return trackId ? { kind: 'show', trackId } : undefined
}
