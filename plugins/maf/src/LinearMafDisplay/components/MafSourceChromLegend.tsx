import { observer } from 'mobx-react'

import MafLegend from './MafLegend.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

// Cap the legend so a many-scaffold alignment (e.g. fragmented nematode multiz)
// doesn't paper over the track. `visibleSourceChromosomes` is ordered by
// prevalence, so the cap keeps the chromosomes covering the most bases and folds
// the long tail of rare scaffolds into a "+N more" count (all still colored).
const MAX_LEGEND_ENTRIES = 8

/**
 * Legend for the color-by-source-chromosome SV mode: the most prevalent source
 * chromosomes in view with their swatches. Renders nothing outside that mode.
 */
const MafSourceChromLegend = observer(function MafSourceChromLegend({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const entries = model.visibleSourceChromosomes
  const shown = entries.slice(0, MAX_LEGEND_ENTRIES)
  const overflow = entries.length - shown.length
  return (
    <MafLegend
      entries={[
        ...shown.map(({ chr, color }) => ({ label: chr, color })),
        ...(overflow > 0 ? [{ label: `+${overflow} more` }] : []),
      ]}
    />
  )
})

export default MafSourceChromLegend
