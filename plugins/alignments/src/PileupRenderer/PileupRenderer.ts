import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { notEmpty, renderToAbstractCanvas } from '@jbrowse/core/util'
import { PileupLayoutSession } from './PileupLayoutSession'

// locals
import { fetchSequence } from '../util'
import { layoutFeats } from './layoutFeatures'
import type { PileupLayoutSessionProps } from './PileupLayoutSession'
import type {
  ColorBy,
  ModificationTypeWithColor,
  SortedBy,
} from '../shared/types'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderArgsDeserialized as BoxRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  colorBy?: ColorBy
  colorTagMap?: Record<string, string>
  visibleModifications?: Record<string, ModificationTypeWithColor>
  sortedBy?: SortedBy
  showSoftClip: boolean
  highResolutionScaling: number
}

export interface RenderArgsDeserializedWithFeaturesAndLayout
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
  layout: BaseLayout<Feature>
  regionSequence?: string
}

export default class PileupRenderer extends BoxRendererType {
  supportsSVG = true

  async fetchSequence(renderProps: RenderArgsDeserialized) {
    const { sessionId, regions, adapterConfig } = renderProps
    const { sequenceAdapter } = adapterConfig
    if (!sequenceAdapter) {
      return undefined
    }
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      sequenceAdapter,
    )
    const region = regions[0]!
    return fetchSequence(
      {
        ...region,
        start: Math.max(0, region.start - 1),
        end: region.end + 1,
      },
      dataAdapter as BaseFeatureDataAdapter,
    )
  }

  getExpandedRegion(region: Region, renderArgs: RenderArgsDeserialized) {
    const { config, showSoftClip } = renderArgs
    const { start, end } = region
    const maxClippingSize = readConfObject(config, 'maxClippingSize')
    const bpExpansion = showSoftClip ? Math.round(maxClippingSize) : 0

    return {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      ...(region as Omit<typeof region, symbol>),
      start: Math.floor(Math.max(start - bpExpansion, 0)),
      end: Math.ceil(end + bpExpansion),
    }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { regions, bpPerPx } = renderProps
    const region = regions[0]!

    const layoutRecords = layoutFeats({
      ...renderProps,
      features,
      layout,
    })

    // only need reference sequence if there are features and only for some
    // cases
    const regionSequence = features.size
      ? await this.fetchSequence(renderProps)
      : undefined
    const width = (region.end - region.start) / bpPerPx
    const height = Math.max(layout.getTotalHeight(), 1)

    const { makeImageData } = await import('./makeImageData')
    const res = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      ctx => {
        makeImageData({
          ctx,
          layoutRecords: layoutRecords.filter(notEmpty),
          canvasWidth: width,
          renderArgs: {
            ...renderProps,
            layout,
            features,
            regionSequence,
          },
        })
        return undefined
      },
    )

    const results = await super.render({
      ...renderProps,
      ...res,
      features,
      layout,
      height,
      width,
    })

    return {
      ...results,
      ...res,
      features: new Map(),
      layout,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
      containsNoTransferables: true,
    }
  }

  createSession(args: PileupLayoutSessionProps) {
    return new PileupLayoutSession(args)
  }
}

export type {
  RenderArgs,
  RenderResults,
  RenderArgsSerialized,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
