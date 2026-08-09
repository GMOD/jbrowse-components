import { applySyntenyTrackSelections } from '@jbrowse/synteny-core'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function doSubmit({
  selectedAssemblyNames,
  model,
  session,
}: {
  selectedAssemblyNames: string[]
  model: LinearSyntenyViewModel
  session: AbstractSessionModel
}) {
  // each row is a LinearGenomeView built from a declarative `init` — its
  // afterAttach autorun loads the assembly regions and shows the whole genome,
  // so we don't wait for assemblies or navigate here (see LinearGenomeView
  // model.ts). Width flows in from the comparative view's width autorun.
  model.setViews(
    selectedAssemblyNames.map(assembly => ({
      type: 'LinearGenomeView' as const,
      hideHeader: true,
      init: { assembly },
    })),
  )
  applySyntenyTrackSelections({
    session,
    selections: model.importFormSyntenyTrackSelections,
    assemblyNames: selectedAssemblyNames,
    showTrack: (trackId, level) => {
      model.showTrack(trackId, level)
    },
  })
  // no-op for few levels (per-level height is capped at the 100px default), so
  // safe to always run; only shrinks bands once the stack gets tall
  model.autoScaleLevelHeights()
  model.clearImportFormSyntenyTracks()
}
