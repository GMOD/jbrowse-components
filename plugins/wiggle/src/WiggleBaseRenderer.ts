import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import React from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
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
  displayModel: unknown
}

export default abstract class extends ServerSideRendererType {
  async render(renderProps: WiggleBaseRendererProps) {
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps },
      null,
    )
    return { element }
  }
}
