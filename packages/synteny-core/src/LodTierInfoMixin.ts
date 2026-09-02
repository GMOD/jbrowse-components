import { installFetch } from '@jbrowse/core/util/installFetch'
import { types } from '@jbrowse/mobx-state-tree'

import { readLodTierInfo, trackHasLodTiers } from './lodTier.ts'

import type { LodTierInfo } from './lodTier.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'

/**
 * #stateModel LodTierInfoMixin
 * #category display
 *
 * What the tiered adapter said about its file, held by every display that
 * resolves a level-of-detail tier (LinearSyntenyDisplay, DotplotDisplay,
 * LGVSyntenyDisplay) and read by their `lodTier` getters through
 * `resolveLodTier`. Filled by `installLodTierInfoFetch`; undefined until it
 * lands, which the resolver treats as "trust the config slot".
 */
export function LodTierInfoMixin() {
  return types
    .model('LodTierInfo', {})
    .volatile(() => ({
      /**
       * #volatile
       */
      lodTierInfo: undefined as LodTierInfo | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLodTierInfo(info: LodTierInfo | undefined) {
        self.lodTierInfo = info
      },
    }))
}

export interface LodTierInfoHost extends FetchSkeletonHost {
  adapterConfig: Record<string, unknown>
  isMinimized: boolean
  parentTrack: { configuration: AnyConfigurationModel }
  setLodTierInfo: (info: LodTierInfo | undefined) => void
}

/**
 * The one-shot read behind {@link LodTierInfoMixin}: `CoreGetInfo` against the
 * track's adapter, keyed on the adapter config so an edit re-reads and an
 * un-minimize does not, and gated on the threshold slot so a PAFAdapter never
 * asks. A failure is not terminal — the display keeps resolving off the slot,
 * which is what it did before the header existed, and the primary fetch on the
 * same file raises the real error — so it is only logged. No `contract`: this
 * is the second fetch on a host whose primary fetch installed the checks.
 */
export function installLodTierInfoFetch(self: LodTierInfoHost) {
  installFetch(self, {
    name: 'LodTierInfo',
    delay: 0,
    report: { setStatusMessage: () => {} },
    gate: () => !self.isMinimized && trackHasLodTiers(self.parentTrack),
    prepare: () => ({ adapterConfig: self.adapterConfig }),
    fetchKey: ({ adapterConfig }) => JSON.stringify(adapterConfig),
    run: async ({ adapterConfig }, ctx) =>
      readLodTierInfo(await ctx.callRpc('CoreGetInfo', { adapterConfig })),
    commit: info => {
      self.setLodTierInfo(info)
    },
    setError: error => {
      if (error !== undefined) {
        console.warn(
          `Could not read the alignment file's tier info; keeping the configured threshold: ${error}`,
        )
      }
    },
  })
}
