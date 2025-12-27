import { observer } from 'mobx-react'

import DisplayError from './DisplayError'
import Loading from './Loading'

const ChordVariantDisplay = observer(function ChordVariantDisplay({
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
  } else if (!display.filled) {
    return <Loading model={display} />
  } else {
    return display.reactElement
  }
})

export default ChordVariantDisplay
