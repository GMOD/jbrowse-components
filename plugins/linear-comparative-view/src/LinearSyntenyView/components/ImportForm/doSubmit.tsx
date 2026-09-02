import { parseRegionNames } from '@jbrowse/core/util'
import { applySyntenyTrackSelections } from '@jbrowse/synteny-core'
import { transaction } from 'mobx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type {
  AssemblyHost,
  NotificationSink,
  TrackCatalog,
} from '@jbrowse/core/util'

export function doSubmit({
  selectedAssemblyNames,
  regionNames = [],
  model,
  session,
}: {
  selectedAssemblyNames: string[]
  // per row, parallel to selectedAssemblyNames; '' or absent means the whole
  // assembly
  regionNames?: string[]
  model: LinearSyntenyViewModel
  session: AssemblyHost & NotificationSink & TrackCatalog
}) {
  // one batch, so no observer sees the rows without their tracks
  transaction(() => {
    // each row is a LinearGenomeView with its settings written on it — its
    // afterAttach autorun loads the assembly regions and shows the whole
    // genome, so we don't wait for assemblies or navigate here (see
    // LinearGenomeView model.ts). Width flows in from the comparative view's
    // width autorun.
    model.setViews(
      selectedAssemblyNames.map((assembly, idx) => {
        // omitted rather than passed as [] when the box is empty: the LGV
        // branches on the key being present, and an empty list would take the
        // named-regions path with nothing to name
        const names = parseRegionNames(regionNames[idx] ?? '')
        return {
          type: 'LinearGenomeView' as const,
          hideHeader: true,
          assembly,
          ...(names.length ? { displayedRegionNames: names } : {}),
        }
      }),
    )
    applySyntenyTrackSelections({
      session,
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: selectedAssemblyNames,
      showTrack: (trackId, level) => {
        void model.launchTrack(trackId, level)
      },
    })
    // no-op for few levels (per-level height is capped at the 100px default),
    // so safe to always run; only shrinks bands once the stack gets tall
    model.autoScaleLevelHeights()
    model.clearImportFormSyntenyTracks()
  })
}
