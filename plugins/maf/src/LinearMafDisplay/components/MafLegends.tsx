import React from 'react'

import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Color key for the active row rendering (codon changes, source-chromosome
 * ranks, or the identity ramp). Entries come from the model so the SVG export
 * emits the same key; this is only the on-screen presentation, via the shared
 * `FloatingLegend` every other display's legend uses.
 */
const MafLegends = observer(function MafLegends({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  return <FloatingLegend items={model.legendItems} />
})

export default MafLegends
