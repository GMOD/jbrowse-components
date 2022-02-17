import ComparativeServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import React from 'react'

export default class LinearSyntenyRenderer extends ComparativeServerSideRendererType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async renameRegionsIfNeeded(args: any) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (!assemblyManager) {
      throw new Error('No assembly manager provided')
    }
    const {
      view: { views },
    } = args

    for (let i = 0; i < views.length; i++) {
      const view = views[i]
      view.displayedRegions = (
        await renameRegionsIfNeeded(assemblyManager, {
          sessionId: args.sessionId,
          regions: view.displayedRegions,
          adapterConfig: args.adapterConfig,
        })
      ).regions
    }

    return args
  }
  async render(renderProps: {
    height: number
    width: number
    view: { views: Base1DViewModel[] }
  }) {
    const {
      width,
      view: { views },
    } = renderProps
    const realizedViews = views.map(snap => {
      const view = Base1DView.create(snap)
      view.setVolatileWidth(width)
      return view
    })
    const features = await Promise.all(
      realizedViews.map(view =>
        this.getFeatures({
          ...renderProps,
          regions: view.staticBlocks.contentBlocks,
        }),
      ),
    )

    const serializedFeatures = JSON.parse(JSON.stringify(features))
    for (let i = 0; i < serializedFeatures.length; i++) {
      for (let j = 0; j < serializedFeatures[i].length; j++) {
        // eslint-disable-next-line no-underscore-dangle
        serializedFeatures[i][j]._level = i
      }
    }

    return {
      reactElement: React.createElement(this.ReactComponent, {
        ...renderProps,
        features,
      }),
      features: serializedFeatures,
    }
  }
}
