import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface ReducedFeature {
  name: string
  refName: string
  start: number
  end: number
  id: string
  flags: number
  tlen: number
  pair_orientation: string
}

export interface PairStats {
  max: number
  min: number
  upper: number
  lower: number
}

export type PairMap = { [key: string]: ReducedFeature[] }

export interface PairData {
  pairedFeatures: PairMap
  stats: PairStats
}

export async function fetchPairs(self: IAnyStateTreeNode) {
  try {
    const { rpcSessionId: sessionId } = getContainingTrack(self)
    const { rpcManager } = getSession(self)
    const view = getContainingView(self) as LGV

    if (!view.initialized) {
      return
    }
    self.setLoading(true)

    const ret = (await rpcManager.call(sessionId, 'PileupGetFeatures', {
      sessionId,
      regions: view.staticBlocks.contentBlocks,
      adapterConfig: self.adapterConfig,
    })) as PairData

    self.setPairData(ret)
    self.setLoading(false)
  } catch (e) {
    console.error(e)
    self.setError(e)
  }
}
