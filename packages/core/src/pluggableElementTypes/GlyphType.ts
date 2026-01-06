import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationModel } from '../configuration/index.ts'
import type { Feature, Region } from '../util/index.ts'
import type { Theme } from '@mui/material'

export interface GlyphRenderContext {
  ctx: CanvasRenderingContext2D
  feature: Feature
  featureLayout: GlyphFeatureLayout
  region: Region
  bpPerPx: number
  config: AnyConfigurationModel
  theme: Theme
  reversed: boolean
  topLevel: boolean
  canvasWidth: number
}

export interface GlyphFeatureLayout {
  feature: Feature
  x: number
  y: number
  width: number
  height: number
  children: GlyphFeatureLayout[]
}

export interface GlyphArgs {
  name: string
  displayName?: string
  draw: (context: GlyphRenderContext) => void
  getChildFeatures?: (
    feature: Feature,
    config: AnyConfigurationModel,
  ) => Feature[]
  /**
   * Returns a height multiplier for this glyph. The base feature height
   * will be multiplied by this value. Useful for glyphs that need to
   * display stacked/tiered content.
   * @param feature The feature being rendered
   * @param config The configuration model
   * @returns A multiplier (e.g., 2 means double height). Default is 1.
   */
  getHeightMultiplier?: (
    feature: Feature,
    config: AnyConfigurationModel,
  ) => number
  /**
   * Returns custom mouseover text for a child feature.
   * @param childFeature The child feature being hovered
   * @returns The mouseover text to display, or undefined to use default
   */
  getSubfeatureMouseover?: (childFeature: Feature) => string | undefined
  match?: (feature: Feature) => boolean
  /**
   * Priority for glyph matching. Higher priority glyphs are checked first.
   * Use this to override built-in glyphs or ensure your glyph takes precedence.
   * Default is 0. Built-in glyphs use priority 0.
   */
  priority?: number
}

export default class GlyphType extends PluggableElementBase {
  draw: (context: GlyphRenderContext) => void
  getChildFeatures?: (
    feature: Feature,
    config: AnyConfigurationModel,
  ) => Feature[]
  getHeightMultiplier?: (
    feature: Feature,
    config: AnyConfigurationModel,
  ) => number
  getSubfeatureMouseover?: (childFeature: Feature) => string | undefined
  match?: (feature: Feature) => boolean
  priority: number

  constructor(args: GlyphArgs) {
    super(args)
    this.draw = args.draw
    this.getChildFeatures = args.getChildFeatures
    this.getHeightMultiplier = args.getHeightMultiplier
    this.getSubfeatureMouseover = args.getSubfeatureMouseover
    this.match = args.match
    this.priority = args.priority ?? 0
  }
}
