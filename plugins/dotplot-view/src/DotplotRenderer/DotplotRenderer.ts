import ComparativeRenderer from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import {
  renameRegionsIfNeeded,
  renderToAbstractCanvas,
} from '@jbrowse/core/util'
import { Dotplot1DView } from '../DotplotView/model'
import type { Dotplot1DViewModel } from '../DotplotView/model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  RenderArgsDeserialized,
  RenderArgs,
} from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import type { Region } from '@jbrowse/core/util'

// locals

export interface DotplotRenderArgsDeserialized extends RenderArgsDeserialized {
  adapterConfig: AnyConfigurationModel
  height: number
  width: number
  highResolutionScaling: number
  view: {
    hview: Dotplot1DViewModel
    vview: Dotplot1DViewModel
  }
}

interface DotplotRenderArgs extends RenderArgs {
  adapterConfig: AnyConfigurationModel
  sessionId: string
  view: {
    hview: { displayedRegions: Region[] }
    vview: { displayedRegions: Region[] }
  }
}

export default class DotplotRenderer extends ComparativeRenderer {
  supportsSVG = true

  async renameRegionsIfNeeded(args: DotplotRenderArgs) {
    const pm = this.pluginManager
    const assemblyManager = pm.rootModel?.session?.assemblyManager

    const { view, sessionId, adapterConfig } = args

    async function process(regions?: Region[]) {
      if (!assemblyManager) {
        throw new Error('No assembly manager provided')
      }
      const result = await renameRegionsIfNeeded(assemblyManager, {
        sessionId,
        adapterConfig,
        regions,
      })
      return result.regions
    }

    view.hview.displayedRegions = await process(view.hview.displayedRegions)
    view.vview.displayedRegions = await process(view.vview.displayedRegions)

    return args
  }

  async render(renderProps: DotplotRenderArgsDeserialized) {
    const {
      width,
      height,
      view: { hview, vview },
    } = renderProps
    const dimensions = [width, height]
    const views = [hview, vview].map((snap, idx) => {
      const view = Dotplot1DView.create(snap)
      view.setVolatileWidth(dimensions[idx]!)
      return view
    })
    const target = views[0]!
    const feats = await this.getFeatures({
      ...renderProps,
      regions: target.dynamicBlocks.contentBlocks,
    })
    target.setFeatures(feats)

    const { drawDotplot } = await import('./drawDotplot')
    const ret = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      drawDotplot(ctx, { ...renderProps, views }),
    )

    const results = await super.render({
      ...renderProps,
      ...ret,
      height,
      width,
    })

    return {
      ...results,
      ...ret,
      height,
      width,
      offsetX: views[0]!.dynamicBlocks.blocks[0]?.offsetPx || 0,
      offsetY: views[1]!.dynamicBlocks.blocks[0]?.offsetPx || 0,
      bpPerPxX: views[0]!.bpPerPx,
      bpPerPxY: views[1]!.bpPerPx,
    }
  }
}
