import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSchema from '../LinearReadCloudDisplay/configSchema'
import { renameViewRegionsForRPC } from '../shared/renameRegionsForRPC'

import type { ColorBy, ModificationTypeWithColor } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ThemeOptions } from '@mui/material'

export interface RenderLinearReadCloudDisplayArgs {
  sessionId: string
  view: Base1DViewModel
  adapterConfig: AnyConfigurationModel
  sequenceAdapter?: Record<string, unknown>
  config: AnyConfigurationModel
  theme: ThemeOptions
  filterBy: Record<string, unknown>
  featureHeight: number
  noSpacing: boolean
  drawCloud: boolean
  colorBy: ColorBy
  drawSingletons: boolean
  drawProperPairs: boolean
  flipStrandLongReadChains: boolean
  trackMaxHeight?: number
  cloudModeHeight?: number
  highResolutionScaling?: number
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  statusCallback?: (status: string) => void
  stopToken?: string
  visibleModifications?: Record<string, ModificationTypeWithColor>
  hideSmallIndels?: boolean
  hideMismatches?: boolean
  hideLargeIndels?: boolean
}

export default class RenderLinearReadCloudDisplay extends RpcMethodType {
  name = 'RenderLinearReadCloudDisplay'

  async renameRegionsIfNeeded(
    args: RenderLinearReadCloudDisplayArgs,
  ): Promise<RenderLinearReadCloudDisplayArgs> {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const { view: viewSnapshot, sessionId, adapterConfig } = args
    const renamedView = await renameViewRegionsForRPC({
      assemblyManager,
      viewSnapshot: viewSnapshot as Record<string, unknown>,
      sessionId,
      adapterConfig,
    })

    return { ...args, view: renamedView as typeof viewSnapshot }
  }

  deserializeArguments(args: any, _rpcDriver: string) {
    return {
      ...args,
      config: configSchema(this.pluginManager).create(args.config, {
        pluginManager: this.pluginManager,
      }),
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as RenderLinearReadCloudDisplayArgs,
    )

    // Fallback: ensure sequenceAdapter is set for CRAM files. Normally the
    // adapter gets sequenceAdapterConfig set when it's cached in the worker
    // during normal rendering. This fallback handles edge cases where the
    // adapter cache might not have sequenceAdapterConfig (e.g., if the RPC
    // is called before normal rendering has occurred).
    let { sequenceAdapter } = renamed
    if (!sequenceAdapter) {
      const assemblyManager =
        this.pluginManager.rootModel?.session?.assemblyManager
      const view = renamed.view as { assemblyNames?: string[] }
      const assemblyName = view?.assemblyNames?.[0]
      if (assemblyManager && assemblyName) {
        const assembly = assemblyManager.get(assemblyName)
        const seqAdapterConfig = assembly?.configuration?.sequence?.adapter
        if (seqAdapterConfig) {
          sequenceAdapter = getSnapshot(seqAdapterConfig)
        }
      }
    }

    return super.serializeArguments(
      { ...renamed, sequenceAdapter } as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, rpcDriver: string) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { executeRenderLinearReadCloudDisplay } =
      await import('./executeRenderLinearReadCloudDisplay')
    return executeRenderLinearReadCloudDisplay({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
