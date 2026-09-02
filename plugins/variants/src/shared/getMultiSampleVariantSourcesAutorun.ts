import { getContainingView, getNotificationSink } from '@jbrowse/core/util'
import { installPrerequisiteFetch } from '@jbrowse/core/util/installPrerequisiteFetch'

import type { Source } from './types.ts'
import type { PrerequisiteFetchHost } from '@jbrowse/core/util/installPrerequisiteFetch'
import type { StatusWindow } from '@jbrowse/core/util/progress'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMultiSampleVariantSourcesAutorun(
  self: PrerequisiteFetchHost & {
    statusWindow: StatusWindow
    setError: (error?: unknown) => void
    setSources: (sources: Source[]) => void
  },
) {
  // The shared prerequisite-read declaration, which owns the adapter-config
  // trigger and key, the minimized gate, the lent status window and the reason
  // there is no `contract` here. What the skeleton under it brings is
  // load-bearing for this one in particular: `getSources` has no index to
  // consult and scans every feature in every region, so the latest-wins
  // rotation, the currency-guarded error rule and the retired status slot are
  // all doing work.
  installPrerequisiteFetch(self, {
    report: { statusWindow: self.statusWindow },
    // The view-measured term this read has carried since it was hand-rolled.
    // It reads no view geometry itself, so nothing here throws before init —
    // the gate is what keeps a full-file scan from starting ahead of the
    // display's own first fetch.
    gate: () => (getContainingView(self) as LinearGenomeViewModel).initialized,
    run: (adapterConfig, ctx) =>
      ctx.callRpc('MultiSampleVariantGetSources', { adapterConfig }),
    commit: ({ sources, warnings }) => {
      self.setSources(sources)
      // A `samplesTsv` that matches only some of the VCF's samples still
      // draws, but silently dropping the rest is a config mistake worth
      // surfacing — and this fetch runs in the worker, whose console nobody is
      // looking at. `notify` dedupes by message, so a refetch of the same file
      // doesn't stack them.
      for (const warning of warnings) {
        console.warn(warning)
        getNotificationSink(self).notify(warning, 'warning')
      }
    },
    // The sample list is a prerequisite for everything this display draws, so a
    // failure here is not a partial result — the band is empty either way.
    // `samplesTsvLocation` naming no VCF sample is the case that needs it most:
    // it used to leave `sources` an empty array, which is truthy, so no loading
    // state and no banner showed and the display just drew nothing.
    setError: error => {
      self.setError(error)
      if (error !== undefined) {
        getNotificationSink(self).notifyError(`${error}`, error)
      }
    },
    delay: 1000,
    name: 'GetMultiSampleVariantSources',
  })
}
