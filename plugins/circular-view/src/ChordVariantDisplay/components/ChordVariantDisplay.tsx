import { observer } from 'mobx-react'

import Chords from '../../chords/Chords.tsx'
import DisplayError from './DisplayError.tsx'
import Loading from './Loading.tsx'

import type { ChordDisplayModel } from '../../chords/types.ts'

const ChordVariantDisplay = observer(function ChordVariantDisplay({
  display,
}: {
  display: ChordDisplayModel
}) {
  // `ready`, not just `features`: blocksForRefs falls back to untranslated
  // refNames while the map is in flight, so drawing as soon as the features
  // land flashes a chordless circle whenever the adapter's names differ from
  // the assembly's (`1` vs `chr1`)
  return display.error ? (
    <DisplayError
      model={display}
      onClick={() => {
        display.openErrorDialog()
      }}
      onRetry={() => {
        display.reload()
      }}
    />
  ) : display.ready ? (
    <Chords display={display} />
  ) : (
    <Loading model={display} />
  )
})

export default ChordVariantDisplay
