import { identityColorScale } from '../LinearMafRenderer/identity.ts'
import {
  getCodonLegendItems,
  getFrameLegendItems,
} from '../LinearMafRenderer/util.ts'
import { sourceChromLegendItems } from './components/drawSourceChrom.ts'

import type { MafColorField, RowRendering } from './rowRenderings.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { FieldColorEncoding } from '@jbrowse/display-kit/colorConfigSchema'

export interface MafColorScaleInputs {
  palette: JBrowsePalette
  rendering: RowRendering
  rowsColor: MafColorField
  colorEncoding: FieldColorEncoding
  colorKeyTitle: string
  oneBaseCells: boolean
  maxSourceChromRank: number
  showsFrames: boolean
  rowColorScales: ColorScale[]
}

function categoricalScale(
  id: string,
  title: string,
  items: { label: string; color?: string }[],
): ColorScale {
  return {
    kind: 'categorical',
    id,
    title,
    entries: items.map(({ label, color }) => ({ value: label, label, color })),
  }
}

function renderedScales({
  palette,
  rendering,
  rowsColor,
  colorEncoding,
  colorKeyTitle,
  oneBaseCells,
  maxSourceChromRank,
}: MafColorScaleInputs): ColorScale[] {
  const named = colorEncoding.scale === 'categorical' ? colorEncoding : {}
  if (rendering === 'codon') {
    return [
      categoricalScale(
        'codon',
        colorKeyTitle,
        getCodonLegendItems(palette, named),
      ),
    ]
  }
  if (rendering === 'chromosome') {
    return [
      categoricalScale(
        'sourceChrom',
        colorKeyTitle,
        sourceChromLegendItems(maxSourceChromRank, named),
      ),
    ]
  }
  if (rendering === 'identity' || rowsColor === 'identity') {
    return [
      identityColorScale(
        'heatmap',
        oneBaseCells,
        colorKeyTitle,
        colorEncoding.scale === 'linear' ? colorEncoding : undefined,
      ),
    ]
  }
  return rendering === 'xyplot'
    ? [identityColorScale('xyplot', oneBaseCells)]
    : []
}

export function mafColorScales(inputs: MafColorScaleInputs): ColorScale[] {
  return [
    ...renderedScales(inputs),
    ...(inputs.showsFrames
      ? [
          categoricalScale(
            'cdsFrame',
            'CDS frame',
            getFrameLegendItems(inputs.palette),
          ),
        ]
      : []),
    ...inputs.rowColorScales,
  ]
}
