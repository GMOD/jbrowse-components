import { BaseExportSvgDialog } from '@jbrowse/core/ui'

import type { ExportSvgOptions } from '../model.ts'

export default function ExportSvgDialog({
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
}
