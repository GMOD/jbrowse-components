import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { chordConfigSchemaFields } from '../../chords/chordConfigSchemaFields.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const STROKE_SLOTS = {
  strokeColor: 'color',
  strokeColorSelected: 'colorSelected',
  strokeColorHover: 'colorHover',
} as const

// v4 spelt the chord colours `strokeColor*`, on the display or inside its
// `renderer`, and session tracks in share links still carry both.
const retired = Object.fromEntries(
  Object.entries(STROKE_SLOTS).map(([old, name]) => [
    old,
    (value: unknown) => ({ [name]: value }),
  ]),
)

/**
 * The same names inside a `renderer`, which is not declared retired: the track
 * config's legacy-renderer lift hoists a renderer's props onto the entry, and
 * consuming `renderer` before that lift would drop every renderer prop that is
 * not a colour. Read here instead, where that lift has already run, so an entry
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
  return rest
}

/**
 * #config ChordVariantDisplay
 *
 * #example
 * The circular-view display for a `VariantTrack` of structural variants;
 * translocations are drawn as chords across the circle. `color`, `colorHover`
 * and `colorSelected` are the chord's resting, hovered and selected colors, as
 * on the synteny ribbons, and each takes a `jexl:` expression over the
 * `feature` so a chord can be colored by what it is:
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
 *       color: "jexl:get(feature,'INFO').SVTYPE=='BND'?'#d95f02':'rgba(255,133,0,0.32)'",
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
      ...chordConfigSchemaFields,
      /**
       * #slot
       */
      onChordClick: {
        type: 'boolean',
        description:
          "a jexl callback run when a chord is clicked, in place of opening the record's details",
        defaultValue: false,
        contextVariable: ['feature', 'track', 'pluginManager'],
      },
      /**
       * #slot
       */
      color: {
        type: 'color',
        description: 'the line color of each chord',
        defaultValue: 'rgba(255,133,0,0.32)',
        contextVariable: ['feature'],
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
