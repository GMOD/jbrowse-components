import { observer } from 'mobx-react'

import ImportForm from './ImportForm.tsx'
import GraphCanvas from './GraphCanvas.tsx'

import type { GraphGenomeViewModel } from '../model.ts'

const GraphGenomeView = observer(function GraphGenomeView({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  if (model.hasGraph) {
    return <GraphCanvas model={model} />
  }
  return <ImportForm model={model} />
})

export default GraphGenomeView
