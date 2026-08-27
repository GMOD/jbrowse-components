import { renderArcSvg as renderShared } from '../shared/renderArcSvg.tsx'
import Arcs from './components/Arcs.tsx'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

// The lazy boundary for this display's export path — see the twin in
// LinearArcDisplay/renderSvg.tsx for why it is a module rather than two
// `import()`s inlined into the model, and why the parameter is the bare node.
export async function renderArcSvg(
  model: IStateTreeNode,
): Promise<React.ReactNode> {
  return renderShared(model as LinearPairedArcDisplayModel, Arcs)
}
