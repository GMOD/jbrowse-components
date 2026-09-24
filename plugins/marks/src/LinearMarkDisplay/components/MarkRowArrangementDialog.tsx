import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type {
  ColorColumn,
  RowSource,
  TreeLayoutModel,
} from '@jbrowse/tree-sidebar'

// A row's one colour is the tint beside its label: each mark paints the plot
// in its own.
const ROW_COLOR: ColorColumn<RowSource> = {
  field: 'labelColor',
  headerName: 'Color',
}

export default function MarkRowArrangementDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<RowSource>
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Mark display — row arrangement"
      colorColumns={[ROW_COLOR]}
    />
  )
}
