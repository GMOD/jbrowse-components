import BaseExportSvgDialog from './BaseExportSvgDialog.tsx'

import type { BaseExportSvgOptions } from './BaseExportSvgDialog.tsx'

// The export dialog for a view whose `exportSvg` takes nothing beyond the
// shared options: the dotplot and circular views both lazy-import this. A view
// with extra controls wraps `BaseExportSvgDialog` itself and threads them
// through `exportSvg` (the LGV family's track labels and gridlines).
export default function ExportSvgDialog({
  model,
  handleClose,
}: {
  model: { exportSvg(opts: BaseExportSvgOptions): Promise<void> }
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
