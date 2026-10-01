import { ALT_HUE, cellFill } from './cellFill.ts'
import { getCachedABGR } from './variantWebglUtils.ts'

import type { CellPaint } from './cellHue.ts'

export interface PaintableCells {
  cellColors: Uint32Array
  cellAltDosage: Uint8Array
  cellFeatureIndices: ArrayLike<number>
  numCells: number
  refCellCount: number
  featureColorValues: Uint32Array
  colorValues: string[]
}

export interface CellPaintOptions {
  phased: boolean
  shade: boolean
  // Whether the payload's values were read for the current `color`; a payload
  // read for another one paints as though it read none.
  valuesRead: boolean
}

/**
 * Each alt cell's colour and each variant's lane colour, painted on the main
 * thread from the values the worker read, so a recolour refetches nothing.
 *
 * Only alt cells change, and only through `fill = shade(hue, dosage)`: in
 * allele-count mode every alt cell, in phased mode those a hue paints, the rest
 * keeping the worker's allele colours. Every other cell keeps the worker's
 * colour, and so does every cell while no hue is set and shading is on, the
 * default, which hands back the worker's array.
 */
export function paintCells(
  data: PaintableCells,
  paint: CellPaint,
  options: CellPaintOptions,
) {
  const { phased, shade, valuesRead } = options
  const { colorValues, featureColorValues, cellAltDosage, cellFeatureIndices } =
    data
  const hueIndex = new Map<string | undefined, number>([[paint.constant, 0]])
  const hues: (string | undefined)[] = [paint.constant]
  const valueHue = new Uint32Array(colorValues.length + 1)
  if (valuesRead && paint.hueOf) {
    for (let v = 0; v < colorValues.length; v++) {
      const hue = paint.hueOf(colorValues[v]!)
      let h = hueIndex.get(hue)
      if (h === undefined) {
        h = hues.push(hue) - 1
        hueIndex.set(hue, h)
      }
      valueHue[v + 1] = h
    }
  }

  const huePacked = hues.map(hue => getCachedABGR(hue ?? ALT_HUE))
  const numFeatures = featureColorValues.length
  const featureColors = new Uint32Array(numFeatures)
  for (let f = 0; f < numFeatures; f++) {
    featureColors[f] = huePacked[valueHue[featureColorValues[f]!]!]!
  }

  if (hues.length === 1 && hues[0] === undefined && (phased || shade)) {
    return { cellColors: data.cellColors, featureColors }
  }

  const cellColors = data.cellColors.slice()
  const { numCells, refCellCount } = data
  if (phased) {
    for (let i = refCellCount; i < numCells; i++) {
      if (cellAltDosage[i]) {
        const h = valueHue[featureColorValues[cellFeatureIndices[i]!]!]!
        if (hues[h] !== undefined) {
          cellColors[i] = huePacked[h]!
        }
      }
    }
    return { cellColors, featureColors }
  }

  // one shade per (hue, dosage byte), filled as the cells meet them
  const shades = new Uint32Array(hues.length * 256)
  const shaded = new Uint8Array(hues.length * 256)
  for (let i = refCellCount; i < numCells; i++) {
    const dosage = cellAltDosage[i]!
    if (dosage) {
      const h = valueHue[featureColorValues[cellFeatureIndices[i]!]!]!
      const slot = h * 256 + dosage
      if (!shaded[slot]) {
        shades[slot] = getCachedABGR(
          cellFill(hues[h] ?? ALT_HUE, dosage, shade),
        )
        shaded[slot] = 1
      }
      cellColors[i] = shades[slot]!
    }
  }
  return { cellColors, featureColors }
}

/** The key rows the values an alt cell carried file under. */
export function paintedColorKeys(
  payloads: Iterable<
    Pick<PaintableCells, 'colorValues'> & { paintedColorValues: number[] }
  >,
  paint: CellPaint,
) {
  const keys = new Set<string>()
  const { keyOf } = paint
  if (keyOf) {
    for (const { colorValues, paintedColorValues } of payloads) {
      for (const v of paintedColorValues) {
        keys.add(keyOf(colorValues[v]!))
      }
    }
  }
  return [...keys]
}
