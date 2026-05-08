import { getEnv } from '@jbrowse/core/util'
import {
  ImportSyntenyOpenCustomTrack,
  defaultSyntenyFileFormats,
} from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../../model.ts'

const DotplotImportSyntenyOpenCustomTrack = observer(
  function DotplotImportSyntenyOpenCustomTrack({
    model,
    assembly1,
    assembly2,
  }: {
    model: DotplotViewModel
    assembly1: string
    assembly2: string
  }) {
    const { pluginManager } = getEnv(model)
    return (
      <ImportSyntenyOpenCustomTrack
        assembly1={assembly1}
        assembly2={assembly2}
        selectedRow={0}
        extensionPoint="DotplotView-SyntenyFileFormats"
        baseFormats={defaultSyntenyFileFormats}
        pluginManager={pluginManager}
        onSetTrack={(row, val) => model.setImportFormSyntenyTrack(row, val)}
      />
    )
  },
)

export default DotplotImportSyntenyOpenCustomTrack
