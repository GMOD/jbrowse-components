import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import configSchema from '../configSchema'

import type { ColorBy } from '../../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ThemeOptions } from '@mui/material'

export interface RenderLinearReadCloudDisplayArgs {
  sessionId: string
  view: Base1DViewModel
  adapterConfig: AnyConfigurationModel
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
}

export default class RenderLinearReadCloudDisplay extends RpcMethodType {
  name = 'RenderLinearReadCloudDisplay'

  async renameRegionsIfNeeded(
    args: RenderLinearReadCloudDisplayArgs,
  ): Promise<RenderLinearReadCloudDisplayArgs> {
    const pm = this.pluginManager
    const assemblyManager = pm.rootModel?.session?.assemblyManager

    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const { view: viewSnapshot, sessionId, adapterConfig } = args
    const displayedRegions =
      (viewSnapshot as any).displayedRegions || ([] as any[])

    if (!displayedRegions.length) {
      return args
    }

    const result = await renameRegionsIfNeeded(assemblyManager, {
      sessionId,
      adapterConfig,
      regions: displayedRegions,
    })

    return {
      ...args,
      view: {
        ...viewSnapshot,
        displayedRegions: result.regions,
        staticBlocks: {
          ...(viewSnapshot as any).staticBlocks,
          contentBlocks: result.regions,
        },
      },
    }
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
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, rpcDriver: string) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { executeRenderLinearReadCloudDisplay } = await import(
      './executeRenderLinearReadCloudDisplay'
    )
    return executeRenderLinearReadCloudDisplay({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
