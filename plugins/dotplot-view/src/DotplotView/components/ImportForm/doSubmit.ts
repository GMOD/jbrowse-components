import { applySyntenyTrackSelections } from '@jbrowse/synteny-core'
import { transaction } from 'mobx'

import type { DotplotViewModel } from '../../model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * Split an axis' chromosome box into the entries `selectNamedRegions` takes.
 * Comma-separated, because the two things a user types here are one glob
 * (`*_MATERNAL`) or a short explicit list (`chr1, chr2`), and neither wants
 * punctuation ceremony.
 *
 * Whitespace-trimmed and empties dropped, so a trailing comma or a box holding
 * only spaces is the same as an empty box: no restriction, whole assembly. An
 * empty result must NOT reach the init as `[]` — that reads as "restrict to
 * nothing", and applyInitDisplayedRegions would leave the axis alone anyway,
 * but only by way of a guard rather than because it was asked to.
 */
export function parseRegionNames(value: string) {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '')
}

export function doSubmit({
  model,
  session,
  assemblyX,
  assemblyY,
  regionsX = '',
  regionsY = '',
}: {
  model: DotplotViewModel
  session: AbstractSessionModel
  assemblyX: string
  assemblyY: string
  regionsX?: string
  regionsY?: string
}) {
  model.setError(undefined)
  transaction(() => {
    // a dotplot is the single-pair case of the same resolution the synteny form
    // runs per row pair, so it is the same call with one pair's worth of rows
    applySyntenyTrackSelections({
      session,
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: [assemblyX, assemblyY],
      showTrack: trackId => {
        model.showTrack(trackId)
      },
    })
    model.setAssemblyNames(assemblyX, assemblyY)

    // The axis restriction goes through the SAME declarative init a session
    // spec and LaunchView-DotplotView use, rather than a second
    // setDisplayedRegions path living here. It cannot be done inline: resolving
    // `*_MATERNAL` needs the assembly's regions, the assembly is generally not
    // loaded at the instant Launch is pressed, and waiting for that — then
    // replacing the whole-genome regions the regions autorun populates in the
    // meantime — is exactly what applyInit already does, ordered ahead of
    // autoDiagonalize. An init carrying only `views` is otherwise inert: its
    // tracks and display-settings steps each guard on their own key.
    const views = [
      { assembly: assemblyX, displayedRegionNames: parseRegionNames(regionsX) },
      { assembly: assemblyY, displayedRegionNames: parseRegionNames(regionsY) },
    ]
    // undefined rather than an init with two empty lists when neither box was
    // used: `init` is persisted and is what "has something to show" consults,
    // so an empty one is a request that never resolves to anything.
    model.setInit(
      views.some(v => v.displayedRegionNames.length > 0)
        ? { views }
        : undefined,
    )

    // applied now, so they don't outlive the form — see
    // clearImportFormSyntenyTracks
    model.clearImportFormSyntenyTracks()
  })
}
