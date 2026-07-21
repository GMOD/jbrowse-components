import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { PreConfiguredSyntenyTrackSelect } from '@jbrowse/synteny-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ImportSyntenyTrackSelector = observer(
  function ImportSyntenyTrackSelector({
    model,
    assemblyX,
    assemblyY,
    syntenyTracks,
  }: {
    model: DotplotViewModel
    assemblyX: string
    assemblyY: string
    syntenyTracks: AnyConfigurationModel[]
  }) {
    return (
      <PreConfiguredSyntenyTrackSelect
        model={model}
        tracks={syntenyTracks}
        rowIndex={0}
        emptyState={
          <Typography color="text.secondary">
            {assemblyX === assemblyY
              ? 'Choose two different assemblies, or pick "New track" above to add one.'
              : `No pre-configured synteny track connects ${assemblyX} and ${assemblyY}. Pick "New track" above to add one.`}
          </Typography>
        }
      >
        <Typography variant="body2" color="text.secondary">
          More synteny tracks can be toggled inside the dotplot from the track
          selector <TrackSelectorIcon />; multiple can show at once.
        </Typography>
      </PreConfiguredSyntenyTrackSelect>
    )
  },
)

export default ImportSyntenyTrackSelector
