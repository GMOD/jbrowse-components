import { getEnv } from '@jbrowse/core/util'
import {
  ImportSyntenyOpenCustomTrack,
  defaultSyntenyFileFormats,
} from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

const LinearImportSyntenyOpenCustomTrack = observer(
  function LinearImportSyntenyOpenCustomTrack({
    model,
    assembly1,
    assembly2,
    selectedRow,
  }: {
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
    selectedRow: number
  }) {
    const { pluginManager } = getEnv(model)
    return (
      <ImportSyntenyOpenCustomTrack
        assembly1={assembly1}
        assembly2={assembly2}
        selectedRow={selectedRow}
        extensionPoint="LinearSyntenyView-SyntenyFileFormats"
        baseFormats={defaultSyntenyFileFormats}
        pluginManager={pluginManager}
        onSetTrack={(row, val) => model.setImportFormSyntenyTrack(row, val)}
      />
    )
  },
)

export default LinearImportSyntenyOpenCustomTrack
