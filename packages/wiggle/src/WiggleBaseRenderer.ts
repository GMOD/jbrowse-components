import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Region } from '@gmod/jbrowse-core/util/types'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import React from 'react'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { ScaleOpts } from './util'

export interface WiggleBaseRendererProps {
  features: Map<string, Feature>
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  height: number
  width: number
  highResolutionScaling: number
  blockKey: string
  dataAdapter: BaseFeatureDataAdapter
  notReady: boolean
  scaleOpts: ScaleOpts
  sessionId: string
  signal: AbortSignal
  trackModel: unknown
}

export default abstract class extends ServerSideRendererType {
  getExpandedRegion(region: Region) {
    const bpExpansion = Math.round((region.end - region.start) / 4)
    return {
      ...region,
      start: Math.floor(Math.max(region.start - bpExpansion, 0)),
      end: Math.ceil(region.end + bpExpansion),
    }
  }

  async render(renderProps: WiggleBaseRendererProps) {
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps },
      null,
    )
    return { element }
  }
}
