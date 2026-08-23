import { getContainingView, getSession } from '@jbrowse/core/util'
import { installFetch } from '@jbrowse/core/util/installFetch'

import type { Source } from './types.ts'
import type { StatusWindow } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMultiSampleVariantSourcesAutorun(
  self: IStateTreeNode & {
    adapterConfig: Record<string, unknown>
    isMinimized: boolean
    reloadCounter: number
    fetchInert: boolean
    fetchCanceled: boolean
    setError: (error?: unknown) => void
    // This display composes the LGV fetch mixins, so it already owns a status
    // window; it is lent to the skeleton's rotation, which is what keeps this
    // fetch and the region fetches thinning through ONE of them rather than
    // two writing the same field.
    statusWindow: StatusWindow
    setSources: (sources: Source[]) => void
  },
) {
  // The shared skeleton owns what this fetch used to hand-roll: the latest-wins
  // rotation, the currency-guarded error rule, the clear at the start, the
  // unconditional reload read, and the slot retirement that keeps a failed scan
  // from leaving a progress chip up for good. `getSources` has no index to
  // consult and scans every feature in every region, so all of that is
  // load-bearing here.
  //
  // No `contract`: this is a SECOND fetch on a display whose per-region
  // foundation already installed both contract checks.
  installFetch(self, {
    report: { statusWindow: self.statusWindow },
    gate: () =>
      !self.isMinimized &&
      (getContainingView(self) as LinearGenomeViewModel).initialized,
    // tracked, because an adapter edited in the config editor has to rescan —
    // `run`'s own reads are untracked by contract
    prepare: () => ({ adapterConfig: self.adapterConfig }),
    run: (args, ctx) =>
      ctx.callRpc('MultiSampleVariantGetSources', {
        adapterConfig: args.adapterConfig,
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
    setError: error => {
      self.setError(error)
      if (error !== undefined) {
        getSession(self).notifyError(`${error}`, error)
      }
    },
    delay: 1000,
    name: 'GetMultiSampleVariantSources',
  })
}
