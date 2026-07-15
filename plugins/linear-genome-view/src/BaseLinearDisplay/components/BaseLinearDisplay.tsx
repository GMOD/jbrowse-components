import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { AnyReactComponentType } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})

// Thin container for GPU displays: every consumer (canvas, wiggle,
// multi-wiggle, gwas, variants) sets DisplayMessageComponent and renders its
// own canvas/tooltip/legend inside it. The `-done` test-id suffix is consumed
// by browser-test-utils waits.
const BaseLinearDisplay = observer(function BaseLinearDisplay(props: {
  model: {
    configuration: { displayId: string }
    canvasDrawn?: boolean
    DisplayMessageComponent: AnyReactComponentType
  }
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const { model, children } = props
  const { DisplayMessageComponent, canvasDrawn, configuration } = model
  return (
    <div
      data-testid={`display-${configuration.displayId}${
        canvasDrawn ? '-done' : ''
      }`}
      className={classes.display}
    >
      <DisplayMessageComponent model={model} />
      {children}
    </div>
  )
})

export default BaseLinearDisplay

export { default as Tooltip } from './Tooltip.tsx'
export { default as BlockMsg } from '../../shared/BlockMsg.tsx'
