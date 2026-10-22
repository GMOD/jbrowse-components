import { CONNECTION_LABELS } from '@jbrowse/alignments-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  arcSlotCategory,
  buildArcColorPalette,
} from '../../shaders/palettes.ts'
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { arcColorCategoryLabel } from '../../shared/legendUtils.ts'
import { connectorColorShift } from '../arcs/arcColors.ts'
import { classifyPair } from './compute.ts'

import type { SwatchCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { ArcColorField } from '../../shared/types.ts'
import type { ReadEntry } from './compute.ts'

export interface ConnectorStyle {
  /** opaque CSS color */
  color: string
  /** the key row and tooltip line naming the color */
  label: string
}

export type ConnectorStyler = (
  e1: ReadEntry,
  e2: ReadEntry,
  isSplit: boolean,
  crossesChromosomes: boolean,
) => ConnectorStyle

/**
 * The color and label a connector between two reads paints with: its arc
 * slot under `colorField`, through the palette and key the display's own
 * connectors and arcs use. The two entries may come from different
 * displays, as a breakpoint split view's two panels do.
 */
export function connectorStyler({
  colors,
  colorField,
  labels,
}: {
  colors: ColorPalette
  colorField: ArcColorField
  labels?: Partial<Record<SwatchCategory, string>>
}): ConnectorStyler {
  const palette = buildArcColorPalette(colors, colorField).map(c => rgb255(c))
  const shift = connectorColorShift(colorField)
  return (e1, e2, isSplit, crossesChromosomes) => {
    const { colorType } = classifyPair(e1, e2, isSplit, crossesChromosomes)
    const slot = linkedReadColorSlot(colorType, shift)
    return {
      color: palette[slot]!,
      label:
        arcColorCategoryLabel(
          arcSlotCategory(slot, colorField),
          !isSplit,
          labels,
        ) ?? CONNECTION_LABELS.readPair,
    }
  }
}
