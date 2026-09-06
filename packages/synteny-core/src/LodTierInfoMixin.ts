import { installPrerequisiteFetch } from '@jbrowse/core/util/installPrerequisiteFetch'
import { types } from '@jbrowse/mobx-state-tree'

import { readLodTierInfo, trackHasLodTiers } from './lodTier.ts'

import type { LodTierInfo } from './lodTier.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { PrerequisiteFetchHost } from '@jbrowse/core/util/installPrerequisiteFetch'

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

export interface LodTierInfoHost extends PrerequisiteFetchHost {
  parentTrack: { configuration: AnyConfigurationModel }
  setLodTierInfo: (info: LodTierInfo | undefined) => void
}

/**
 * The one-shot read behind {@link LodTierInfoMixin}: `CoreGetInfo` against the
 * track's adapter, the shared prerequisite-read declaration (the adapter-config
 * trigger and key, the minimized gate, no `contract`) plus this read's own
 * terms — gated on the threshold slot so a PAFAdapter never asks, and narrating
 * nothing, since a header is not a load. A failure is not terminal — the
 * display keeps resolving off the slot, which is what it did before the header
 * existed, and the primary fetch on the same file raises the real error — so it
 * is only logged.
 *
 * `onHeader` hands the display the whole header the tier info was narrowed
 * from, in the same commit: a header can carry more than tiers (a star
 * adapter's names its anchor), and a second `CoreGetInfo` for the rest would be
 * the same round trip twice. `alsoWhen` widens the gate for a display that
 * wants the header of an untiered adapter for what else it carries; the
 * threshold slot stays the default so a PAFAdapter still never asks.
 */
export function installLodTierInfoFetch(
  self: LodTierInfoHost,
  {
    onHeader,
    alsoWhen = () => false,
  }: { onHeader?: (header: unknown) => void; alsoWhen?: () => boolean } = {},
) {
  installPrerequisiteFetch(self, {
    name: 'LodTierInfo',
    delay: 0,
    report: { setStatusMessage: () => {} },
    gate: () => trackHasLodTiers(self.parentTrack) || alsoWhen(),
    run: (adapterConfig, ctx): Promise<unknown> =>
      ctx.callRpc('CoreGetInfo', { adapterConfig }),
    commit: header => {
      self.setLodTierInfo(readLodTierInfo(header))
      onHeader?.(header)
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
