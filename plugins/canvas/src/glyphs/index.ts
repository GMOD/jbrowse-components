/**
 * Default glyphs for the CanvasFeatureRenderer
 *
 * Glyphs are pluggable rendering components that handle specific feature types.
 * External plugins can add their own glyphs using pluginManager.addGlyphType().
 *
 * See RepeatRegionGlyph.ts for an example implementation, or
 * test_data/volvox/umd_plugin.js for an example of adding a glyph from an
 * external plugin.
 */
import RepeatRegionGlyph from './RepeatRegionGlyph'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function registerGlyphs(pluginManager: PluginManager) {
  pluginManager.addGlyphType(() => RepeatRegionGlyph)
}
