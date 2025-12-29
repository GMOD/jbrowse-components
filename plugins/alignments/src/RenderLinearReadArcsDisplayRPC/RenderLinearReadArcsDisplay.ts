import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import configSchema from '../LinearReadArcsDisplay/configSchema'

import type { ColorBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ThemeOptions } from '@mui/material'

export interface RenderLinearReadArcsDisplayArgs {
  sessionId: string
  view: Base1DViewModel
  adapterConfig: AnyConfigurationModel
  sequenceAdapter?: Record<string, unknown>
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

    // Rename displayedRegions (used by bpToPx for coordinate conversion)
    const renamedDisplayed = await renameRegionsIfNeeded(assemblyManager, {
      sessionId,
      adapterConfig,
      regions: displayedRegions,
    })

    // Also rename contentBlocks (used for fetching features)
    // contentBlocks is a getter on BlockSet, so we need to filter blocks manually
    const allBlocks = (viewSnapshot as any).staticBlocks?.blocks || ([] as any[])
    const contentBlocks = allBlocks.filter(
      (b: { type?: string }) => b.type === 'ContentBlock',
    )

    const renamedContent = await renameRegionsIfNeeded(assemblyManager, {
      sessionId,
      adapterConfig,
      regions: contentBlocks,
    })

    // Create a map of renamed contentBlocks by key for efficient lookup
    const renamedByKey = new Map(
      renamedContent.regions.map((r: any) => [r.key, r]),
    )

    // Update blocks array with renamed contentBlocks while preserving other block types
    const updatedBlocks = allBlocks.map((block: any) =>
      block.type === 'ContentBlock' && renamedByKey.has(block.key)
        ? renamedByKey.get(block.key)
        : block,
    )

    return {
      ...args,
      view: {
        ...viewSnapshot,
        displayedRegions: renamedDisplayed.regions,
        staticBlocks: {
          ...(viewSnapshot as any).staticBlocks,
          blocks: updatedBlocks,
          contentBlocks: renamedContent.regions,
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
