import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import RenderedBlocks from './RenderedBlocks.tsx'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'
import type { BaseLinearDisplayModel } from '../model.ts'

// Warning: these styles are sensitive to causing 1px gaps between blocks.
// Using display:flex with fractional widths and style.left positioning works.
// Avoid using transform:translateX or inline-block as they cause subpixel
// rounding issues that result in visible gaps between track blocks.
const useStyles = makeStyles()({
  linearBlocks: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    position: 'absolute',
    minHeight: '100%',
    display: 'flex',
  },
})

const LinearBlocks = observer(function LinearBlocks({
  model,
}: {
  model: BaseLinearDisplayModel
}) {
  const { classes } = useStyles()
  const { blockDefinitions } = model
  const viewModel = getContainingView(model) as LinearGenomeViewModel
  // Warning: use style.left here, not transform:translateX, to avoid 1px gaps
  return (
    <div
      className={classes.linearBlocks}
      style={{
        left: blockDefinitions.offsetPx - viewModel.offsetPx,
      }}
    >
      <RenderedBlocks model={model} />
    </div>
  )
})

export default LinearBlocks
