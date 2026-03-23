import {
  getContainingTrack,
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { MultiPairGetFeaturesResult } from '../LinearSyntenyRPC/MultiPairGetFeatures.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface MultiSyntenyDisplayActions {
  setAllGenomeNames(names: string[]): void
  setGenomeRows(rows: Map<string, MultiPairFeature[]>): void
  setLoading(flag: boolean): void
  setStatusMessage(msg?: string): void
  setError(e: unknown): void
}

export function doAfterAttach(self: MultiSyntenyDisplayActions) {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let currentStopToken: StopToken | undefined
  let assembliesCreated = false

  addDisposer(
    self,
    autorun(
      function multiSyntenyFetchAutorun() {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized || view.displayedRegions.length === 0) {
          return
        }

        // Track observables so autorun re-fires on changes
        JSON.stringify(view.displayedRegions)
        view.bpPerPx
        view.staticBlocks.contentBlocks.map(b => b.key)

        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        if (currentStopToken) {
          stopStopToken(currentStopToken)
        }

        const thisStopToken = createStopToken()
        currentStopToken = thisStopToken

        debounceTimer = setTimeout(async () => {
          try {
            if (!isAlive(self)) {
              return
            }
            self.setLoading(true)
            const view = getContainingView(self) as LinearGenomeViewModel
            if (!view.initialized || view.displayedRegions.length === 0) {
              return
            }

            const track = getContainingTrack(self)
            const adapterConfig = getConf(track, 'adapter')
            const session = getSession(self)
            const sessionId = getRpcSessionId(self)
            const { rpcManager } = session

            const contentBlocks = view.staticBlocks.contentBlocks
            const bpPerPx = view.bpPerPx

            const regions = contentBlocks.map(block => ({
              assemblyName: block.assemblyName,
              refName: block.refName,
              start: block.start,
              end: block.end,
            }))

            const result: MultiPairGetFeaturesResult = await rpcManager.call(
              sessionId,
              'MultiPairGetFeatures',
              {
                adapterConfig,
                regions,
                bpPerPx,
                sessionId,
                stopToken: thisStopToken,
                fetchChromSizes: !assembliesCreated,
                statusCallback: (msg: string) => {
                  if (isAlive(self)) {
                    self.setStatusMessage(msg)
                  }
                },
              },
            )

            if (thisStopToken !== currentStopToken || !isAlive(self)) {
              return
            }

            if (result.chromSizes && session.addAssembly) {
              assembliesCreated = true
              const { assemblyManager } = session
              for (const [genome, regions] of result.chromSizes) {
                if (!assemblyManager.get(genome)) {
                  session.addAssembly({
                    name: genome,
                    sequence: {
                      type: 'ReferenceSequenceTrack',
                      trackId: `${genome.replaceAll('#', '_')}_refseq`,
                      adapter: {
                        type: 'FromConfigRegionsAdapter',
                        features: regions.map((r, i) => ({
                          uniqueId: `${genome}-${r.refName}-${i}`,
                          refName: r.refName,
                          start: 0,
                          end: r.length,
                        })),
                      },
                    },
                  })
                }
              }
            }

            self.setAllGenomeNames(result.genomeNames)
            self.setGenomeRows(new Map(result.genomeRows))
            self.setError(undefined)
            self.setLoading(false)
          } catch (e) {
            if (!isAbortException(e)) {
              if (isAlive(self)) {
                console.error('MultiLGVSyntenyDisplay fetch error:', e)
                self.setLoading(false)
                self.setError(e)
              }
            }
          }
        }, 300)
      },
      { name: 'MultiSyntenyFetch' },
    ),
  )

  addDisposer(self, () => {
    clearTimeout(debounceTimer)
    if (currentStopToken) {
      stopStopToken(currentStopToken)
    }
  })
}
