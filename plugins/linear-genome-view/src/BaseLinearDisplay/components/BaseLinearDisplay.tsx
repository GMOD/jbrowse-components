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
// ternary. Every in-tree display that wants it now composes this directly in
// the component it registers (canvas, wiggle, multi-wiggle, gwas), which is
// what let their models drop the `DisplayMessageComponent` getter and the
// model↔component cycle it forced.
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

// `DisplayContainer` plus a body taken from the model's `DisplayMessageComponent`
// getter (`BaseDisplayModel`). **No in-tree display registers this any more** —
// the three that did (wiggle, multi-wiggle, gwas) now register their own
// container+body pair, so nothing in this repo reads that getter on the GPU
// path. It stays for two reasons: it is public plugin API, and ~15 test
// harnesses register it as a stand-in `ReactComponent` for a display they never
// actually render. Don't reach for it in new code — compose `DisplayContainer`.
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
