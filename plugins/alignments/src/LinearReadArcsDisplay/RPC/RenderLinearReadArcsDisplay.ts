import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import configSchema from '../configSchema'

import type { ColorBy } from '../../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ThemeOptions } from '@mui/material'

export interface RenderLinearReadArcsDisplayArgs {
  sessionId: string
  view: Base1DViewModel
  adapterConfig: AnyConfigurationModel
  config: AnyConfigurationModel
  theme: ThemeOptions
  filterBy: Record<string, unknown>
  colorBy: ColorBy
  drawInter: boolean
  drawLongRange: boolean
  lineWidth: number
  jitter: number
  height: number
  highResolutionScaling?: number
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  statusCallback?: (status: string) => void
  stopToken?: string
}

export default class RenderLinearReadArcsDisplay extends RpcMethodType {
  name = 'RenderLinearReadArcsDisplay'

  deserializeArguments(args: any, _rpcDriver: string) {
    return {
      ...args,
      config: configSchema(this.pluginManager).create(args.config, {
        pluginManager: this.pluginManager,
      }),
    }
  }

  async renameRegionsIfNeeded(
    args: RenderLinearReadArcsDisplayArgs,
  ): Promise<RenderLinearReadArcsDisplayArgs> {
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

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as RenderLinearReadArcsDisplayArgs,
    )
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, rpcDriver: string) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { executeRenderLinearReadArcsDisplay } =
      await import('./executeRenderLinearReadArcsDisplay')
    return executeRenderLinearReadArcsDisplay({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
