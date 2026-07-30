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

// The outer box a GPU display's ReactComponent paints into, and the single home
// of the `display-<displayId>` / `-done` test-id convention that
// browser-test-utils waits on — so no display hand-writes the `canvasDrawn`
// ternary. Compose it directly when the display registers its own body
// component (canvas: see LinearBasicDisplayComponent); go through
// BaseLinearDisplay below when the body comes from the model's
// `DisplayMessageComponent` getter (wiggle, multi-wiggle, gwas).
export const DisplayContainer = observer(function DisplayContainer({
  model,
  children,
}: {
  model: {
    configuration: { displayId: string }
    canvasDrawn?: boolean
  }
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const { canvasDrawn, configuration } = model
  return (
    <div
      data-testid={`display-${configuration.displayId}${
        canvasDrawn ? '-done' : ''
      }`}
      className={classes.display}
    >
      {children}
    </div>
  )
})

// Thin container for the GPU displays whose body is a model getter: each sets
// DisplayMessageComponent and renders its own canvas/tooltip/legend inside it.
const BaseLinearDisplay = observer(function BaseLinearDisplay(props: {
  model: {
    configuration: { displayId: string }
    canvasDrawn?: boolean
    DisplayMessageComponent: AnyReactComponentType
  }
  children?: React.ReactNode
}) {
  const { model, children } = props
  const { DisplayMessageComponent } = model
  return (
    <DisplayContainer model={model}>
      <DisplayMessageComponent model={model} />
      {children}
    </DisplayContainer>
  )
})

export default BaseLinearDisplay

export { default as BlockMsg } from '../../shared/BlockMsg.tsx'
