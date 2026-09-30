import { FileDropZone } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import { classifyFile } from './util.ts'

import type { Guessers, Member, Refusal } from './util.ts'

const DropZone = observer(function DropZone({
  guessers,
  addClassified,
}: {
  guessers: Guessers
  addClassified: (classified: (Member | Refusal)[]) => void
}) {
  return (
    <FileDropZone
      onDrop={accepted => {
        addClassified(accepted.map(file => classifyFile(file, guessers)))
      }}
    />
  )
})

export default DropZone
