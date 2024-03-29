import React from 'react'
import { observer } from 'mobx-react'

// locals
import Loading from './Loading'
import DisplayError from './DisplayError'

const BaseChordDisplay = observer(function ({
  display,
}: {
  display: {
    filled: boolean
    error: unknown
    reactElement: React.ReactElement
    renderProps: { radius: number }
  }
}) {
  if (display.error) {
    return <DisplayError model={display} />
  }
  if (!display.filled) {
    return <Loading model={display} />
  }

  return display.reactElement
})

export default BaseChordDisplay
