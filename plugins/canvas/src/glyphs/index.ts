/**
 * Default glyphs for the CanvasFeatureRenderer
 *
 * Glyphs are pluggable rendering components that handle specific feature types.
 * External plugins can add their own glyphs using pluginManager.addGlyphType().
 *
 * See RepeatRegionGlyph.ts for an example implementation.
 */
import RepeatRegionGlyph from './RepeatRegionGlyph'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function registerGlyphs(pluginManager: PluginManager) {
  pluginManager.addGlyphType(() => RepeatRegionGlyph)
}
