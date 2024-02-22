import BoxRendererType, {
  RenderArgsDeserialized as BoxRenderArgsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import {
  Feature,
  Region,
  notEmpty,
  renderToAbstractCanvas,
} from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  PileupLayoutSession,
  PileupLayoutSessionProps,
} from './PileupLayoutSession'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

// locals
import { fetchSequence, shouldFetchReferenceSequence } from '../util'
import { layoutFeats } from './layoutFeatures'

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  colorBy?: { type: string; tag?: string }
  colorTagMap?: Record<string, string>
  modificationTagMap?: Record<string, string | undefined>
  sortedBy?: {
    type: string
    pos: number
    refName: string
    assemblyName: string
    tag?: string
  }
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
    const pm = this.pluginManager
    const { dataAdapter } = await getAdapter(pm, sessionId, sequenceAdapter)
    const [region] = regions
    return fetchSequence(region, dataAdapter as BaseFeatureDataAdapter)
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
    const [region] = regions

    const layoutRecords = layoutFeats({
      ...renderProps,
      features,
      layout,
    })

    // only need reference sequence if there are features and only for some
    // cases
    const regionSequence =
      features.size && shouldFetchReferenceSequence(renderProps.colorBy?.type)
        ? await this.fetchSequence(renderProps)
        : undefined
    const width = (region.end - region.start) / bpPerPx
    const height = Math.max(layout.getTotalHeight(), 1)

    const { makeImageData } = await import('./makeImageData')
    const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
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
      }),
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
    }
  }

  createSession(args: PileupLayoutSessionProps) {
    return new PileupLayoutSession(args)
  }
}

export {
  type RenderArgs,
  type RenderResults,
  type RenderArgsSerialized,
  type ResultsSerialized,
  type ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
