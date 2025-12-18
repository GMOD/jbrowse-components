import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import { createAutorun } from '../util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface RPCRenderableModel {
  id: string
  error: unknown
  featureDensityStatsReadyAndRegionNotTooLarge: boolean
  effectiveRpcDriverName: string
  adapterConfig: unknown
  configuration: AnyConfigurationModel
  renderingStopToken?: StopToken
  setRenderingStopToken: (token?: StopToken) => void
  setLoading: (loading: boolean) => void
  setError: (error: unknown) => void
  setRenderingImageData: (imageData: ImageBitmap | undefined) => void
  setLastDrawnOffsetPx: (offsetPx: number) => void
  setLastDrawnBpPerPx: (bpPerPx: number) => void
  ref: HTMLCanvasElement | null
  renderingImageData?: ImageBitmap
  setStatusMessage?: (msg: string) => void
}

export interface RPCRenderSetupParams<
  T extends RPCRenderableModel,
  R = Record<string, unknown>,
> {
  self: T
  rpcMethodName: string
  getRPCParams: (params: {
    view: LGV
    session: ReturnType<typeof getSession>
    sequenceAdapter: unknown
    stopToken: StopToken
  }) => Record<string, unknown>
  onResult: (result: R) => void
}

export function createRPCRenderFunction<
  T extends RPCRenderableModel,
  R = Record<string, unknown>,
>({ self, rpcMethodName, getRPCParams, onResult }: RPCRenderSetupParams<T, R>) {
  return async () => {
    const view = getContainingView(self) as LGV

    if (
      !view.initialized ||
      self.error ||
      !self.featureDensityStatsReadyAndRegionNotTooLarge
    ) {
      return
    }

    const { bpPerPx } = view

    try {
      const session = getSession(self)
      const { rpcManager, assemblyManager } = session
      const assemblyName = view.assemblyNames[0]
      if (!assemblyName) {
        return
      }

      const assembly = assemblyManager.get(assemblyName)
      const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
      const sequenceAdapter = sequenceAdapterConfig
        ? getSnapshot(sequenceAdapterConfig)
        : undefined

      const previousToken = untracked(() => self.renderingStopToken)
      if (previousToken) {
        stopStopToken(previousToken)
      }

      const stopToken = createStopToken()
      self.setRenderingStopToken(stopToken)
      self.setLoading(true)

      const viewSnapshot = structuredClone({
        ...getSnapshot(view),
        staticBlocks: view.staticBlocks,
        width: view.width,
      })

      const result = (await rpcManager.call(self.id, rpcMethodName, {
        sessionId: session.id,
        view: viewSnapshot,
        adapterConfig: self.adapterConfig,
        sequenceAdapter,
        config: getSnapshot(self.configuration),
        theme: session.theme,
        highResolutionScaling: 2,
        rpcDriverName: self.effectiveRpcDriverName,
        statusCallback: (msg: string) => {
          if (isAlive(self)) {
            self.setStatusMessage?.(msg)
          }
        },
        stopToken,
        ...getRPCParams({ view, session, sequenceAdapter, stopToken }),
      })) as R & { imageData?: ImageBitmap; offsetPx?: number }

      if (result.imageData) {
        self.setRenderingImageData(result.imageData)
        if (result.offsetPx !== undefined) {
          self.setLastDrawnOffsetPx(result.offsetPx)
        }
        onResult(result)
      }

      self.setLastDrawnBpPerPx(bpPerPx)
    } catch (error) {
      if (!isAbortException(error)) {
        self.setError(error)
      }
    } finally {
      self.setRenderingStopToken(undefined)
      self.setLoading(false)
    }
  }
}

export function setupCanvasRenderingAutorun<T extends RPCRenderableModel>(
  self: T,
) {
  createAutorun(
    self,
    async () => {
      const canvas = self.ref
      const { renderingImageData } = self

      if (!canvas || !renderingImageData) {
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      ctx.resetTransform()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(renderingImageData, 0, 0)
    },
    {
      name: 'CanvasRenderAutorun',
    },
  )
}
