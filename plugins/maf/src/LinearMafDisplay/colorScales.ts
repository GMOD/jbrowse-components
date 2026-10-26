import {
  barHeightScale,
  identityColorScale,
} from '../LinearMafRenderer/identity.ts'
import {
  getCodonLegendItems,
  getFrameLegendItems,
} from '../LinearMafRenderer/util.ts'
import { refNameRankLegendItems } from './components/refNameRanks.ts'

import type { RowPlan } from './rowPlan.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { FieldColorEncoding } from '@jbrowse/display-kit/colorConfigSchema'

export interface MafColorScaleInputs {
  palette: JBrowsePalette
  plan: RowPlan
  colorEncoding: FieldColorEncoding | string | undefined
  colorKeyTitle: string
  oneBaseCells: boolean
  maxRefNameRank: number
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

/** The fill's key: the identity ramp, the source ranks, or the bars' height. */
function fillScales({
  plan,
  colorEncoding,
  colorKeyTitle,
  oneBaseCells,
  maxRefNameRank,
}: MafColorScaleInputs): ColorScale[] {
  const fill = typeof colorEncoding === 'object' ? colorEncoding : undefined
  return plan.color === 'identity'
    ? [
        identityColorScale(
          plan.mark === 'rect' && oneBaseCells,
          colorKeyTitle,
          fill?.scale === 'linear' ? fill : undefined,
        ),
      ]
    : plan.color === 'refNameRank'
      ? [
          categoricalScale(
            'refNameRank',
            colorKeyTitle,
            refNameRankLegendItems(
              maxRefNameRank,
              fill?.scale === 'ordinal' ? fill : {},
            ),
          ),
        ]
      : plan.mark === 'bar'
        ? [
            barHeightScale(
              undefined,
              typeof colorEncoding === 'string' ? colorEncoding : undefined,
            ),
          ]
        : []
}

export function mafColorScales(inputs: MafColorScaleInputs): ColorScale[] {
  return [
    ...fillScales(inputs),
    ...(inputs.plan.bases === 'codon'
      ? [
          categoricalScale(
            'codon',
            'Codon change',
            getCodonLegendItems(inputs.palette),
          ),
        ]
      : []),
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
