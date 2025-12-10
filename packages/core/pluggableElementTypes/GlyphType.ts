import PluggableElementBase from './PluggableElementBase'

import type { AnyConfigurationModel } from '../configuration'
import type { Feature, Region } from '../util'
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
  match?: (feature: Feature) => boolean
  priority: number

  constructor(args: GlyphArgs) {
    super(args)
    this.draw = args.draw
    this.getChildFeatures = args.getChildFeatures
    this.match = args.match
    this.priority = args.priority ?? 0
  }
}
