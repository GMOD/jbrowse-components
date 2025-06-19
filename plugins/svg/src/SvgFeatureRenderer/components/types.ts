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

/**
 * The Glyph interface represents a React component that renders a genomic
 * feature with optional layout capabilities. It combines rendering and layout
 * logic.
 */
export interface Glyph
  extends React.FC<{
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

/**
 * Represents a layout record with [x, y, width, height] values
 */
type LayoutRecord = [number, number, number, number]

/**
 * DisplayModel interface for managing feature display state
 * including selection, hover states, and feature lookup methods
 */
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

/**
 * ExtraGlyphValidator pairs a custom glyph component with a validation function
 * that determines if the glyph should be used for a given feature
 */
export interface ExtraGlyphValidator {
  glyph: Glyph
  validator: (feature: Feature) => boolean
}
/**
 * Base interface for layout arguments shared by all layout functions
 */
export interface BaseLayOutArgs {
  layout: SceneGraph
  bpPerPx: number
  reversed?: boolean
  config: AnyConfigurationModel
}

/**
 * Arguments for laying out a single feature
 */
export interface FeatureLayOutArgs extends BaseLayOutArgs {
  feature: Feature
  extraGlyphs?: ExtraGlyphValidator[]
}

/**
 * Arguments for laying out multiple subfeatures
 */
export interface SubfeatureLayOutArgs extends BaseLayOutArgs {
  subfeatures: Feature[]
  extraGlyphs?: ExtraGlyphValidator[]
}
