import { observer } from 'mobx-react'

import MafLegend from './MafLegend.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Legend for the color-by-source-chromosome SV mode. Coloring is by each row's
 * per-row source-chromosome rank (not by chromosome name), so the legend is the
 * fixed rank scheme — "Main chromosome" plus an accent per rearrangement depth
 * present in view — rather than a swatch per scaffold. Renders nothing outside
 * that mode.
 */
const MafSourceChromLegend = observer(function MafSourceChromLegend({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  return <MafLegend entries={model.sourceChromLegend} />
})

export default MafSourceChromLegend
