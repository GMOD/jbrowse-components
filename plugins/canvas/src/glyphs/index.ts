/**
 * Pluggable glyphs for the CanvasFeatureRenderer
 *
 * Built-in glyphs (Box, CDS, ProcessedTranscript, Segments, Subfeatures,
 * MatureProteinRegion, RepeatRegion) are now defined in
 * CanvasFeatureRenderer/glyphs/.
 *
 * External plugins can still add their own glyphs using
 * pluginManager.addGlyphType(). See test_data/volvox/umd_plugin.js for an
 * example of adding a glyph from an external plugin.
 */
import type PluginManager from '@jbrowse/core/PluginManager'

export default function registerGlyphs(_pluginManager: PluginManager) {
  // All default glyphs are now builtin in CanvasFeatureRenderer/glyphs/
  // This function is kept for backwards compatibility and as a hook for
  // external plugins to register custom glyphs
}
