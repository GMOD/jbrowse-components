import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ImportSyntenyOpenCustomTrack from './ImportSyntenyOpenCustomTrack.tsx'

import type { ImportFormSyntenyModel } from './SelectorTypes.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Binds the shared ImportSyntenyOpenCustomTrack uploader to an import-form
 * view model + row: pulls the plugin manager from the model's env and reports
 * the chosen track into the row's model slot. Used by both the linear synteny
 * (per row pair), dotplot (row 0) and circular (row 0) import forms.
 */
const ImportFormOpenCustomTrack = observer(function ImportFormOpenCustomTrack({
  model,
  rowIndex,
  assembly1,
  assembly2,
}: {
  // IStateTreeNode, not IAnyStateTreeNode: the latter resolves to `any`, and an
  // intersection with `any` is `any`, so the ImportFormSyntenyModel half stops
  // being checked at all
  model: ImportFormSyntenyModel & IStateTreeNode
  rowIndex: number
  assembly1: string
  assembly2: string
}) {
  const { pluginManager } = getEnv(model)
  return (
    <ImportSyntenyOpenCustomTrack
      assembly1={assembly1}
      assembly2={assembly2}
      pluginManager={pluginManager}
      onSetTrack={val => {
        model.setImportFormSyntenyTrack(rowIndex, val)
      }}
    />
  )
})

export default ImportFormOpenCustomTrack
