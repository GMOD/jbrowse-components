import { getConf } from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getSession, getContainingView } from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { getUniqueTagValues, getUniqueModificationValues } from '../shared'

type LGV = LinearGenomeViewModel

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function prepareTrack(self: any) {
  try {
    const { rpcManager } = getSession(self)
    const view = getContainingView(self) as LGV
    const { sortedBy, colorBy, parentTrack, adapterConfig, rendererType } = self

    if (!view.initialized || !self.estimatedStatsReady || self.regionTooLarge) {
      return
    }

    const { staticBlocks, bpPerPx } = view
    // continually generate the vc pairing, set and rerender if any
    // new values seen
    if (colorBy?.tag) {
      self.updateColorTagMap(
        await getUniqueTagValues(self, colorBy, staticBlocks),
      )
    }

    if (colorBy?.type === 'modifications') {
      const adapter = getConf(parentTrack, ['adapter'])
      self.updateModificationColorMap(
        await getUniqueModificationValues(self, adapter, colorBy, staticBlocks),
      )
    }

    if (sortedBy) {
      const { pos, refName, assemblyName } = sortedBy
      // render just the sorted region first
      // @ts-ignore
      await self.rendererType.renderInClient(rpcManager, {
        assemblyName,
        regions: [
          {
            start: pos,
            end: pos + 1,
            refName,
            assemblyName,
          },
        ],
        adapterConfig: adapterConfig,
        rendererType: rendererType.name,
        sessionId: getRpcSessionId(self),
        layoutId: view.id,
        timeout: 1000000,
        ...self.renderProps(),
      })
      self.setReady(true)
      self.setCurrSortBpPerPx(bpPerPx)
    } else {
      self.setReady(true)
    }
  } catch (e) {
    console.error(e)
    self.setError(e)
  }
}
