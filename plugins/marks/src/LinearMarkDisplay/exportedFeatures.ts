import { layerRootRows } from '@jbrowse/core/util/featureTransforms'
import { colorEntryReader } from '@jbrowse/core/util/markEncoding'

import { wireColorOf } from './markColor.ts'

import type { ColorSource } from './markColor.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type {
  FacetSpec,
  LayerRequest,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'

/**
 * The features a mark display draws out of a fetch: each one a mark drawing
 * at this zoom reaches through the steps the worker runs (`layerRootRows`),
 * in a section or row `sectionShown` keeps, outside the categories its color's
 * key hides. Each keeps its place in `features`.
 */
export function exportedMarkFeatures({
  features,
  request,
  drawing,
  colors,
  sectionShown,
  jexl,
}: {
  features: Feature[]
  request: {
    layers: readonly LayerRequest[]
    transform: readonly TransformStep[]
    facet?: FacetSpec
  }
  drawing: readonly number[]
  colors: readonly ColorSource[]
  sectionShown: (key: string) => boolean
  jexl: JexlInstance
}) {
  const layers = layerRootRows(
    features,
    {
      ...request,
      layers: request.layers.map(l => ({
        transform: l.transform,
        row: l.encoding.row,
      })),
    },
    jexl,
  )
  const drawn = new Uint8Array(features.length)
  for (const l of drawing) {
    const { table, inputRow, section } = layers[l]!
    const shownColor = colorShown(table, colors[l], jexl)
    for (let i = 0; i < table.length; i++) {
      if ((!section || sectionShown(section(i))) && shownColor(i)) {
        const row = inputRow(i)
        if (row !== undefined) {
          drawn[row] = 1
        }
      }
    }
  }
  return features.filter((_, i) => drawn[i])
}

// Whether a row's color is one its key shows.
function colorShown(
  table: FeatureTable,
  color: ColorSource | undefined,
  jexl: JexlInstance,
) {
  const listed: readonly (string | number)[] =
    color?.kind === 'categories' || color?.kind === 'identity'
      ? (color.hidden ?? [])
      : []
  const hidden = new Set(listed)
  const read =
    color && hidden.size > 0
      ? colorEntryReader(table, wireColorOf(color), jexl)
      : undefined
  return read ? (i: number) => !hidden.has(read(i)) : () => true
}
