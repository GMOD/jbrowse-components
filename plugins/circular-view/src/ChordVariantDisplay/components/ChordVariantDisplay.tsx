import { observer } from 'mobx-react'

import DisplayError from './DisplayError.tsx'
import Loading from './Loading.tsx'
import SVChordsReactComponent from '../../ChordRenderer/ReactComponent.tsx'

import type { ChordDisplayModel } from '../../ChordRenderer/types.ts'

const ChordVariantDisplay = observer(function ChordVariantDisplay({
  display,
}: {
  display: ChordDisplayModel
}) {
  return display.error ? (
    <DisplayError
      model={display}
      radius={display.radiusPx}
      onClick={() => {
        display.openErrorDialog()
      }}
    />
  ) : display.features ? (
    <SVChordsReactComponent display={display} />
  ) : (
    <Loading radius={display.radiusPx} />
  )
})

export default ChordVariantDisplay
