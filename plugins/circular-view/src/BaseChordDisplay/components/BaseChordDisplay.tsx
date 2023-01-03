import React from 'react'
import { observer } from 'mobx-react'

// locals
import Loading from './Loading'
import DisplayError from './DisplayError'

export default observer(function BaseChordDisplay({
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
