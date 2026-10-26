import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { chordMarkConfigSchema } from '../../chords/chordMarkConfigSchema.ts'
import { chordEncodingConfigSchema } from './chordEncodingConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const restingColor = (value: unknown) => ({ encoding: { color: { value } } })

// v4 spelt the chord colors `strokeColor*`, on the display or inside its
// `renderer`, and session tracks in share links still carry both.
const dropped = () => ({})

// The hover and selection colors went to the shape's own color and the
// theme's highlight.
const retired = {
  strokeColor: restingColor,
  strokeColorSelected: dropped,
  strokeColorHover: dropped,
  colorSelected: dropped,
  colorHover: dropped,
}

/**
 * A v4 `strokeColor` inside a `renderer`, which is not declared retired: the
 * track config's legacy-renderer lift hoists a renderer's props onto the
 * entry, and consuming `renderer` before that lift would drop every renderer
 * prop that is not a color. Read here instead, where that lift has already
 * run, so an entry created straight from a v4 snapshot still finds it.
 * `retired` runs first, so the display's own spelling wins.
 */
function liftRendererStrokeColor(snap: Record<string, unknown>) {
  const { renderer, ...rest } = snap
  if (!renderer || typeof renderer !== 'object') {
    return 'renderer' in snap ? rest : snap
  }
  const inner = renderer as Record<string, unknown>
  return rest.encoding === undefined && inner.strokeColor !== undefined
    ? { ...rest, ...restingColor(inner.strokeColor) }
    : rest
}

/**
 * #config ChordVariantDisplay
 * Draws the structural variants of a `VariantTrack` in a `CircularView`, each
 * translocation as a chord across the circle.
 *
 * #example
 * The circular-view display for a `VariantTrack` of structural variants;
 * translocations are drawn as chords across the circle. `encoding.color` is
 * the chord's resting color, a constant or a field of the record with a key; a
 * hovered chord darkens it and a selected one takes the theme's highlight:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'sv',
 *   name: 'Structural variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/sv.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'ChordVariantDisplay',
 *       displayId: 'sv-ChordVariantDisplay',
 *       encoding: { color: 'svType', opacity: 0.45 },
 *     },
 *   ],
 * }
 * ```
 */
function configSchemaF(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ChordVariantDisplay',
    {
      /**
       * #slot
       * How far each chord curves toward the center, a
       * [](/docs/config/chordmark) object
       */
      mark: chordMarkConfigSchema,
      /**
       * #slot
       */
      onChordClick: {
        type: 'maybeString',
        description:
          "a jexl callback run when a chord is clicked, in place of opening the record's details; unset opens the details",
        contextVariable: ['feature', 'track'],
      },
      /**
       * #slot encoding
       * The channels each resting chord paints through: `encoding.color`,
       * its line color, and `encoding.opacity`, its alpha.
       */
      encoding: chordEncodingConfigSchema,
    },
    {
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
      retired,
      preProcessSnapshot: liftRendererStrokeColor,
    },
  )
}

export default configSchemaF

export type ChordVariantDisplayConfigModel = ReturnType<typeof configSchemaF>
