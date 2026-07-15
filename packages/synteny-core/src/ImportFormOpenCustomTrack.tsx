import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ImportSyntenyOpenCustomTrack from './ImportSyntenyOpenCustomTrack.tsx'
import { defaultSyntenyFileFormats } from './defaultSyntenyFileFormats.tsx'

import type { ImportFormSyntenyModel } from './SelectorTypes.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Binds the shared ImportSyntenyOpenCustomTrack uploader to an import-form
 * view model + row: pulls the plugin manager from the model's env and reports
 * the chosen track into the row's model slot. Used by both the linear synteny
 * (per row pair) and dotplot (row 0) import forms.
 */
const ImportFormOpenCustomTrack = observer(function ImportFormOpenCustomTrack({
  model,
  rowIndex,
  extensionPoint,
  assembly1,
  assembly2,
}: {
  model: ImportFormSyntenyModel & IAnyStateTreeNode
  rowIndex: number
  extensionPoint: string
  assembly1: string
  assembly2: string
}) {
  const { pluginManager } = getEnv(model)
  return (
    <ImportSyntenyOpenCustomTrack
      assembly1={assembly1}
      assembly2={assembly2}
      extensionPoint={extensionPoint}
      baseFormats={defaultSyntenyFileFormats}
      pluginManager={pluginManager}
      onSetTrack={val => {
        model.setImportFormSyntenyTrack(rowIndex, val)
      }}
    />
  )
})

export default ImportFormOpenCustomTrack
