import { BaseExportSvgDialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { ExportSvgOptions } from '../model.ts'

const ExportSvgDialog = observer(function ExportSvgDialog({
  model,
  handleClose,
}: {
  model: { exportSvg(opts: ExportSvgOptions): Promise<void> }
  handleClose: () => void
}) {
  return (
    <BaseExportSvgDialog
      model={model}
      handleClose={handleClose}
      exportSvg={opts => model.exportSvg(opts)}
    />
  )
})

export default ExportSvgDialog
