import { getContainingView, getSession } from '@jbrowse/core/util'
import { installPrerequisiteFetch } from '@jbrowse/plugin-linear-genome-view'

import type { Source } from './types.ts'
import type { RpcStatus, StatusWindow } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMultiSampleVariantSourcesAutorun(
  self: IStateTreeNode & {
    adapterConfig: Record<string, unknown>
    isMinimized: boolean
    reloadCounter: number
    setError: (error?: unknown) => void
    setStatusMessage: (status?: RpcStatus) => void
    // This display composes the LGV fetch mixins, so it already owns a status
    // window; the skeleton lends it to the rotation, which is what keeps this
    // fetch and the region fetches thinning through ONE of them rather than
    // two writing the same field.
    statusWindow: StatusWindow
    setSources: (sources: Source[]) => void
  },
) {
  // The prerequisite skeleton owns what this fetch used to hand-roll: the
  // latest-wins rotation, the currency-guarded error rule, the unconditional
  // reload read, and the slot retirement that keeps a failed scan from leaving
  // a progress chip up for good. `getSources` has no index to consult and
  // scans every feature in every region, so all of that is load-bearing here.
  installPrerequisiteFetch(self, {
    enabled: () =>
      (getContainingView(self) as LinearGenomeViewModel).initialized,
    run: async ctx =>
      await ctx.callRpc('MultiSampleVariantGetSources', {
        adapterConfig: self.adapterConfig,
      }),
    commit: ({ sources, warnings }) => {
      self.setSources(sources)
      // A `samplesTsv` that matches only some of the VCF's samples still
      // draws, but silently dropping the rest is a config mistake worth
      // surfacing — and this fetch runs in the worker, whose console nobody is
      // looking at. `notify` dedupes by message, so a refetch of the same file
      // doesn't stack them.
      for (const warning of warnings) {
        console.warn(warning)
        getSession(self).notify(warning, 'warning')
      }
    },
    // The sample list is a prerequisite for everything this display draws, so a
    // failure here is not a partial result — the band is empty either way.
    // `samplesTsvLocation` naming no VCF sample is the case that needs it most:
    // it used to leave `sources` an empty array, which is truthy, so no loading
    // state and no banner showed and the display just drew nothing.
    onError: e => {
      self.setError(e)
      getSession(self).notifyError(`${e}`, e)
    },
    delay: 1000,
    name: 'GetMultiSampleVariantSources',
  })
}
