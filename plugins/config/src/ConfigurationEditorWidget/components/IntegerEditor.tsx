import { observer } from 'mobx-react'

import NumberEditor from './NumberEditor.tsx'

// thin wrapper: an integer slot is a number slot that only commits whole values
const IntegerEditor = observer(function IntegerEditor({
  slot,
}: {
  slot: {
    name?: string
    value: number
    description?: string
    set: (num: number) => void
  }
}) {
  return <NumberEditor slot={slot} integer />
})

export default IntegerEditor
