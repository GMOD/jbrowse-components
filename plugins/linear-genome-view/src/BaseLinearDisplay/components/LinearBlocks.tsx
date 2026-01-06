import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import RenderedBlocks from './RenderedBlocks.tsx'

import type { BaseLinearDisplayModel } from '../model.ts'

// Warning: these styles are sensitive to causing 1px gaps between blocks.
// Using display:flex with fractional widths and style.left positioning works.
// Avoid using transform:translateX or inline-block as they cause subpixel
// rounding issues that result in visible gaps between track blocks.
const useStyles = makeStyles()({
  // Block container positioned using CSS calc() with --offset-px variable
  // set by parent TracksContainer - avoids JS recalculation per track
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
  // Uses --offset-px CSS variable from TracksContainer parent
  // Warning: use style.left here, not transform:translateX, to avoid 1px gaps
  return (
    <div
      className={classes.linearBlocks}
      style={{
        left: `calc(${blockDefinitions.offsetPx}px - var(--offset-px))`,
      }}
    >
      <RenderedBlocks model={model} />
    </div>
  )
})

export default LinearBlocks
