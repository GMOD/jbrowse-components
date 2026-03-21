import {
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { MultiLGVSyntenyDisplayModel } from './model.ts'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Region } from '@jbrowse/core/util/types'

interface MultiPairAdapter {
  getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken },
  ): Promise<{
    genomeNames: string[]
    genomeRows: Map<string, MultiPairFeature[]>
  }>
  getChromSizes?(): Promise<
    Map<string, { refName: string; length: number }[]>
  >
}

export function doAfterAttach(self: MultiLGVSyntenyDisplayModel) {
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
            const view = getContainingView(self) as LinearGenomeViewModel
            if (!view.initialized || view.displayedRegions.length === 0) {
              return
            }

            const track = getContainingTrack(self)
            const adapterConfig = getConf(track, 'adapter')
            const { pluginManager } = getEnv(self)
            const sessionId = getRpcSessionId(self)

            const { dataAdapter } = await getAdapter(
              pluginManager,
              sessionId,
              adapterConfig,
            )
            const adapter = dataAdapter as unknown as MultiPairAdapter

            if (!assembliesCreated && adapter.getChromSizes) {
              assembliesCreated = true
              const chromSizes = await adapter.getChromSizes()
              const session = getSession(self)
              const { assemblyManager } = session
              if (session.addAssembly) {
                for (const [genome, regions] of chromSizes) {
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
            }

            const contentBlocks = view.staticBlocks.contentBlocks
            const bpPerPx = view.bpPerPx

            const allGenomeRows = new Map<string, MultiPairFeature[]>()
            let allGenomeNames: string[] = []

            for (const block of contentBlocks) {
              if (thisStopToken !== currentStopToken) {
                return
              }
              const region = {
                assemblyName: block.assemblyName,
                refName: block.refName,
                start: block.start,
                end: block.end,
              }

              const { genomeNames, genomeRows } =
                await adapter.getMultiPairFeatures(region, {
                  bpPerPx,
                  stopToken: thisStopToken,
                })

              if (allGenomeNames.length === 0) {
                allGenomeNames = genomeNames
              }

              for (const [genome, features] of genomeRows) {
                const existing = allGenomeRows.get(genome)
                if (existing) {
                  for (const f of features) {
                    existing.push(f)
                  }
                } else {
                  allGenomeRows.set(genome, [...features])
                }
              }
            }

            if (thisStopToken !== currentStopToken || !isAlive(self)) {
              return
            }

            self.setAllGenomeNames(allGenomeNames)
            self.setGenomeRows(allGenomeRows)
            self.setError(undefined)
          } catch (e) {
            if (!isAbortException(e)) {
              if (isAlive(self)) {
                console.error('MultiLGVSyntenyDisplay fetch error:', e)
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
