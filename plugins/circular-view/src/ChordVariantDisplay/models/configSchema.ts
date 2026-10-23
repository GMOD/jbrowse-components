import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { chordMarkConfigSchema } from '../../chords/chordMarkConfigSchema.ts'
import { chordEncodingConfigSchema } from './chordEncodingConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const STROKE_SLOTS = {
  strokeColorSelected: 'colorSelected',
  strokeColorHover: 'colorHover',
} as const

const restingColor = (value: unknown) => ({ encoding: { color: { value } } })

// v4 spelt the chord colors `strokeColor*`, on the display or inside its
// `renderer`, and session tracks in share links still carry both.
const retired = {
  strokeColor: restingColor,
  ...Object.fromEntries(
    Object.entries(STROKE_SLOTS).map(([old, name]) => [
      old,
      (value: unknown) => ({ [name]: value }),
    ]),
  ),
}

/**
 * The same names inside a `renderer`, which is not declared retired: the track
 * config's legacy-renderer lift hoists a renderer's props onto the entry, and
 * consuming `renderer` before that lift would drop every renderer prop that is
 * not a color. Read here instead, where that lift has already run, so an entry
 * created straight from a v4 snapshot still finds them. `retired` runs first,
 * so the display's own spelling wins.
 */
function liftRendererStrokeSlots(snap: Record<string, unknown>) {
  const { renderer, ...rest } = snap
  if (!renderer || typeof renderer !== 'object') {
    return 'renderer' in snap ? rest : snap
  }
  const inner = renderer as Record<string, unknown>
  for (const [old, name] of Object.entries(STROKE_SLOTS)) {
    if (rest[name] === undefined && inner[old] !== undefined) {
      rest[name] = inner[old]
    }
  }
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
 * the chord's resting color, a constant or a field of the record with a key, and
 * `colorHover` and `colorSelected` its hovered and selected ones:
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
 *       encoding: { color: 'svType' },
 *       opacity: 0.45,
 *       colorHover: '#555',
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
        type: 'boolean',
        description:
          "a jexl callback run when a chord is clicked, in place of opening the record's details",
        defaultValue: false,
        contextVariable: ['feature', 'track'],
      },
      /**
       * #slot encoding
       * The channels each resting chord paints through: `encoding.color`,
       * its line color.
       */
      encoding: chordEncodingConfigSchema,
      /**
       * #slot
       */
      opacity: {
        type: 'number',
        description:
          "the alpha every resting chord draws at, over its color's own",
        defaultValue: 0.32,
      },
      /**
       * #slot
       */
      colorSelected: {
        type: 'color',
        description: 'the line color of a chord that has been selected',
        defaultValue: 'black',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      colorHover: {
        type: 'color',
        description:
          'the line color of a chord that is being hovered over with the mouse',
        defaultValue: '#555',
        contextVariable: ['feature'],
      },
    },
    {
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
      retired,
      preProcessSnapshot: liftRendererStrokeSlots,
    },
  )
}

export default configSchemaF

export type ChordVariantDisplayConfigModel = ReturnType<typeof configSchemaF>
