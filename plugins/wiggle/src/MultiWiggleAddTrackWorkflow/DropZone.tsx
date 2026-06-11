import { FileDropZone } from '@jbrowse/core/ui'
import { fileToLocation } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { TrackItem } from './util.ts'

const DropZone = observer(function DropZone({
  addTracks,
}: {
  addTracks: (items: TrackItem[]) => void
}) {
  return (
    <FileDropZone
      onDrop={accepted => {
        addTracks(
          accepted.map(file => ({
            type: 'BigWigAdapter',
            bigWigLocation: fileToLocation(file),
            source: file.name,
          })),
        )
      }}
    />
  )
})

export default DropZone
