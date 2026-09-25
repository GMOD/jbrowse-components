import { LD_ROLE_FIELD } from '../GWASAdapter/ldFields.ts'

import type {
  ColorEncoding,
  CoreGetEncodedLayersArgs,
  Encoded,
  EncodedChannels,
  LayerRequest,
  ShapeEncoding,
} from '@jbrowse/core/util/markEncoding'

/** The point shape's lanes, and the index the hover reads. */
export const MANHATTAN_LANES = ['y', 'color', 'glyph', 'index'] as const

/** One region's points, as the encoder answers the Manhattan layer. */
export type ManhattanChannels = Encoded<(typeof MANHATTAN_LANES)[number]>

/** The request a region's points came back under, which a click sends again. */
export type ManhattanRequest = Omit<CoreGetEncodedLayersArgs, 'byteLimit'>

const SV_SHAPE: ShapeEncoding = {
  field: 'svtype',
  scale: 'categorical',
  domain: ['INS'],
  range: ['triangle-down', 'circle'],
}

const LD_SHAPE: ShapeEncoding = {
  field: LD_ROLE_FIELD,
  scale: 'categorical',
  domain: ['index', 'partner'],
  range: ['diamond', 'circle'],
}

/**
 * The one layer a Manhattan plot draws. Shape carries the SV type, an
 * insertion the triangle, except under LD colouring, where colour carries the
 * r² to the index SNP and shape the index itself, the diamond.
 */
export function manhattanLayer({
  scoreField,
  color,
  ldColoring,
}: {
  scoreField: string
  color: ColorEncoding
  ldColoring: boolean
}): LayerRequest {
  return {
    encoding: {
      y: scoreField,
      color,
      shape: ldColoring ? LD_SHAPE : SV_SHAPE,
    },
    lanes: [...MANHATTAN_LANES],
  }
}

export function manhattanChannels(
  layer: EncodedChannels | undefined,
): ManhattanChannels {
  const { y, color, glyph } = layer ?? {}
  if (!layer || !y || !color || !glyph) {
    throw new Error(
      'CoreGetEncodedLayers answered without the lanes the Manhattan layer asked for',
    )
  }
  return { ...layer, y, color, glyph }
}

/** Whether any point in a region plays this part in the LD join. */
export function hasLdRole(
  { shapeScale }: EncodedChannels,
  role: 'index' | 'partner',
) {
  return (
    shapeScale?.field === LD_ROLE_FIELD &&
    shapeScale.entries.some(e => e.value === role)
  )
}
