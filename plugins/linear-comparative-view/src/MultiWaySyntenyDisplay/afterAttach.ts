import { dedupe, getSession } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  installGlobalFetchAutorun,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import { laneGeneFeatures } from './layoutMultiWay.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { GlobalFetchPhases } from '@jbrowse/plugin-linear-genome-view'

interface MultiWayFetchArgs {
  regions: ContentBlock[]
}

function fetchPhases(
  self: MultiWaySyntenyDisplayModel,
): GlobalFetchPhases<MultiWayFetchArgs, Feature[]> {
  return {
    prepare: () => {
      const regions = self.lgv.staticBlocks.contentBlocks
      return regions.length ? { regions } : undefined
    },
    // no targetAssemblyName: a multi-genome adapter queried with no target
    // answers with every pair anchored on the queried assembly, which is
    // exactly the row set this display draws
    run: async ({ regions }, ctx) =>
      dedupe(
        await ctx.callRpc('CoreGetFeatures', {
          regions,
          adapterConfig: self.adapterConfig,
        }),
        r => r.id(),
      ),
    commit: features => {
      self.setFeatures(features)
    },
  }
}

export function doAfterAttach(self: MultiWaySyntenyDisplayModel) {
  installGlobalFetchAutorun(self, {
    ...fetchPhases(self),
    delay: 1000,
    name: 'MultiWaySyntenyFetch',
  })
  onDisplayedRegionsChange(self, () => {
    self.clearByteEstimate()
  })

  // the second, dependent fetch: once the ortholog groups have settled into
  // lane frames, pull each lane's gene models from that assembly's own gene
  // track. The specs (and their key) are read synchronously so the autorun
  // tracks them; the async fetch commits only if the key is still current.
  let inflightKey = ''
  let stopToken: StopToken | undefined
  addDisposer(
    self,
    autorun(
      () => {
        const { key, specs } = self.laneGenesFetchSpecs
        if (specs.length === 0 || key === inflightKey) {
          return
        }
        inflightKey = key
        if (stopToken !== undefined) {
          stopStopToken(stopToken)
        }
        const fetchStopToken = createStopToken()
        stopToken = fetchStopToken
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const session = getSession(self)
            const { assemblyManager, rpcManager } = session
            const sessionId = getRpcSessionId(self)
            const entries = await Promise.all(
              specs.map(async spec => {
                const assembly = await assemblyManager.waitForAssembly(
                  spec.assemblyName,
                )
                const regions = spec.regions.map(r => ({
                  ...r,
                  refName:
                    assembly?.getCanonicalRefName2(r.refName) ?? r.refName,
                }))
                const features = await rpcManager.call(
                  sessionId,
                  'CoreGetFeatures',
                  {
                    adapterConfig: spec.adapterConfig,
                    regions,
                    stopToken: fetchStopToken,
                    // a deliberate no-op: the lane fetch refines a track that
                    // is already drawn, and holds displayPhase at loading
                    // while it runs, so there is no second bar to feed
                    statusCallback: () => {},
                  },
                )
                return [spec.assemblyName, laneGeneFeatures(features)] as const
              }),
            )
            if (isAlive(self) && self.laneGenesFetchSpecs.key === key) {
              self.setLaneGenes(key, new Map(entries))
            }
          } catch (e) {
            console.error('MultiWaySyntenyDisplay lane gene fetch failed', e)
            // degrade to the placement boxes rather than holding the phase at
            // loading: an empty commit is current, so the display settles
            if (isAlive(self) && self.laneGenesFetchSpecs.key === key) {
              self.setLaneGenes(key, new Map())
            }
          }
        })()
      },
      { delay: 500, name: 'MultiWayLaneGenes' },
    ),
  )
}
