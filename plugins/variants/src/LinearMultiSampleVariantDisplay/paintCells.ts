import { ALT_HUE, cellFill } from '../shared/cellFill.ts'
import { getCachedABGR } from '../shared/variantWebglUtils.ts'

import type { CellHue, CellHueValues } from '../shared/cellHue.ts'

export interface PaintableCells extends CellHueValues {
  cellColors: Uint32Array
  cellAltDosage: Uint8Array
  cellFeatureIndices: ArrayLike<number>
  numCells: number
  refCellCount: number
}

// Each distinct hue the values paint, `hues[0]` the hue of a variant with no
// value, and each value's index into them, `valueHue[0]` for no value. Values
// read for another `color` paint as though none were read.
function hueTable(data: CellHueValues, hue: CellHue, valuesRead: boolean) {
  const { colorValues } = data
  const hues: (string | undefined)[] = [hue.constant]
  const valueHue = new Uint32Array(colorValues.length + 1)
  if (valuesRead && hue.hueOf) {
    hue.deal?.(colorValues)
    const indexOf = new Map(hues.map((h, i) => [h, i]))
    for (let v = 0; v < colorValues.length; v++) {
      const css = hue.hueOf(colorValues[v]!)
      let h = indexOf.get(css)
      if (h === undefined) {
        h = hues.push(css) - 1
        indexOf.set(css, h)
      }
      valueHue[v + 1] = h
    }
  }
  return { hues, valueHue }
}

/** Each variant's lane colour: its hue at full dose, the alt hue by default. */
export function paintFeatureColors(
  data: CellHueValues,
  hue: CellHue,
  valuesRead: boolean,
) {
  const { hues, valueHue } = hueTable(data, hue, valuesRead)
  const packed = hues.map(css => getCachedABGR(css ?? ALT_HUE))
  const { featureColorValues } = data
  const featureColors = new Uint32Array(featureColorValues.length)
  for (let f = 0; f < featureColorValues.length; f++) {
    featureColors[f] = packed[valueHue[featureColorValues[f]!]!]!
  }
  return featureColors
}

/**
 * Each cell's colour, painted from the values the worker read so a recolour
 * refetches nothing. Only alt cells change, through
 * `fill = shade(hue, dosage)`: in allele-count mode every one, in phased mode
 * those a hue paints, the rest keeping the worker's allele colours. With no
 * hue and shading on, the default, the worker's array comes back as it is.
 */
export function paintCellColors(
  data: PaintableCells,
  hue: CellHue,
  {
    phased,
    shade,
    valuesRead,
  }: { phased: boolean; shade: boolean; valuesRead: boolean },
) {
  const { hues, valueHue } = hueTable(data, hue, valuesRead)
  if (hues.length === 1 && hues[0] === undefined && (phased || shade)) {
    return data.cellColors
  }
  const { featureColorValues, cellAltDosage, cellFeatureIndices } = data
  const featureHue = new Uint32Array(featureColorValues.length)
  for (let f = 0; f < featureColorValues.length; f++) {
    featureHue[f] = valueHue[featureColorValues[f]!]!
  }
  const cellColors = data.cellColors.slice()
  const { numCells, refCellCount } = data
  if (phased) {
    const packed = hues.map(css =>
      css === undefined ? -1 : getCachedABGR(css),
    )
    for (let i = refCellCount; i < numCells; i++) {
      if (cellAltDosage[i]) {
        const abgr = packed[featureHue[cellFeatureIndices[i]!]!]!
        if (abgr !== -1) {
          cellColors[i] = abgr
        }
      }
    }
    return cellColors
  }
  // one fill per (hue, dosage byte), made as the cells meet them; 0 is unmade,
  // so a fill that packs to 0, a transparent black, is only remade each time
  const fills = new Uint32Array(hues.length * 256)
  for (let f = 0; f < featureHue.length; f++) {
    featureHue[f] = featureHue[f]! << 8
  }
  for (let i = refCellCount; i < numCells; i++) {
    const dosage = cellAltDosage[i]!
    if (dosage) {
      const slot = featureHue[cellFeatureIndices[i]!]! + dosage
      let abgr = fills[slot]!
      if (abgr === 0) {
        abgr = getCachedABGR(
          cellFill(hues[slot >> 8] ?? ALT_HUE, dosage, shade),
        )
        fills[slot] = abgr
      }
      cellColors[i] = abgr
    }
  }
  return cellColors
}

/** The key rows the values an alt cell carried file under. */
export function paintedColorKeys(
  payloads: Iterable<Pick<CellHueValues, 'colorValues' | 'paintedColorValues'>>,
  hue: CellHue,
) {
  const keys = new Set<string>()
  const { keyOf } = hue
  if (keyOf) {
    for (const { colorValues, paintedColorValues } of payloads) {
      for (const v of paintedColorValues) {
        keys.add(keyOf(colorValues[v]!))
      }
    }
  }
  return [...keys]
}
