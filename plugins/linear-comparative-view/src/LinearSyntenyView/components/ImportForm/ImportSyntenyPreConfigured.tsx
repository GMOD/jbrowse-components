import { getSession } from '@jbrowse/core/util'
import {
  PreConfiguredSyntenyTrackSelect,
  getSyntenyTracks,
} from '@jbrowse/synteny-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

const ImportSyntenyPreConfigured = observer(
  function ImportSyntenyPreConfigured({
    model,
    assembly1,
    assembly2,
    selectedRow,
  }: {
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
    selectedRow: number
  }) {
    const session = getSession(model)
    const filteredTracks = getSyntenyTracks(session.tracks, [
      assembly1,
      assembly2,
    ])
    return (
      <PreConfiguredSyntenyTrackSelect
        model={model}
        tracks={filteredTracks}
        rowIndex={selectedRow}
        emptyState={
          <Typography color="text.secondary">
            {assembly1 === assembly2
              ? 'Choose two different assemblies, or switch to "Quick start" to launch from a synteny track.'
              : `No pre-configured synteny track connects ${assembly1} and ${assembly2}. Choose "New track" to add one, or switch to "Quick start" to launch from an existing track.`}
          </Typography>
        }
      />
    )
  },
)

export default ImportSyntenyPreConfigured
