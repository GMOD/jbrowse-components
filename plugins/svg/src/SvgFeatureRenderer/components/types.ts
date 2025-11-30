import type React from 'react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type SceneGraph from '@jbrowse/core/util/layouts/SceneGraph'

export interface ViewParams {
  start: number
  end: number
  offsetPx: number
  offsetPx1: number
}

export interface Coord {
  x: number
  y: number
}

export interface Glyph extends React.FC<{
  colorByCDS: boolean
  feature: Feature
  featureLayout: SceneGraph
  selected?: boolean
  config: AnyConfigurationModel
  displayModel: any
  region: Region
  bpPerPx: number
  topLevel?: boolean
}> {
  layOut?: (arg: FeatureLayOutArgs) => SceneGraph
}

type LayoutRecord = [number, number, number, number]

export interface DisplayModel {
  getFeatureByID?: (arg0: string, arg1: string) => LayoutRecord
  getFeatureOverlapping?: (
    blockKey: string,
    bp: number,
    y: number,
  ) => string | undefined
  selectedFeatureId?: string
  featureIdUnderMouse?: string
  contextMenuFeature?: Feature
}

export interface ExtraGlyphValidator {
  glyph: Glyph
  validator: (feature: Feature) => boolean
}

export interface BaseLayOutArgs {
  layout: SceneGraph
  bpPerPx: number
  reversed?: boolean
  config: AnyConfigurationModel
}

export interface FeatureLayOutArgs extends BaseLayOutArgs {
  feature: Feature
  extraGlyphs?: ExtraGlyphValidator[]
}

export interface SubfeatureLayOutArgs extends BaseLayOutArgs {
  subfeatures: Feature[]
  extraGlyphs?: ExtraGlyphValidator[]
}
