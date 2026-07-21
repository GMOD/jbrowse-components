import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import {
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
} from '@mui/material'
import { observer } from 'mobx-react'

import { pickSyntenyTrackId } from './getSyntenyTracks.ts'

import type { ImportFormSyntenyModel } from './SelectorTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Pre-configured track picker shared by the synteny and dotplot import forms: a
 * labeled Select over the synteny tracks connecting the chosen assemblies, which
 * writes the pick into importFormSyntenyTrackSelections[rowIndex]. Callers supply
 * the assembly pair's track list, the empty state, and any note to show under the
 * Select (e.g. the dotplot's in-view track-selector hint).
 */
const PreConfiguredSyntenyTrackSelect = observer(
  function PreConfiguredSyntenyTrackSelect({
    model,
    tracks,
    rowIndex,
    emptyState,
    children,
  }: {
    model: IAnyStateTreeNode & ImportFormSyntenyModel
    tracks: AnyConfigurationModel[]
    rowIndex: number
    emptyState: React.ReactNode
    children?: React.ReactNode
  }) {
    const session = getSession(model)
    const selection = model.importFormSyntenyTrackSelections[rowIndex]
    const picked = selection?.type === 'preConfigured' ? selection.value : ''
    const value = pickSyntenyTrackId(picked, tracks) ?? ''
    return (
      <Paper style={{ padding: 12 }}>
        {tracks.length ? (
          <>
            <FormControl fullWidth style={{ marginBottom: 10 }}>
              <InputLabel id="preconfigured-synteny-track-label">
                Synteny track
              </InputLabel>
              <Select
                labelId="preconfigured-synteny-track-label"
                label="Synteny track"
                value={value}
                onChange={event => {
                  model.setImportFormSyntenyTrack(rowIndex, {
                    type: 'preConfigured',
                    value: event.target.value,
                  })
                }}
              >
                {tracks.map(track => (
                  <MenuItem key={track.trackId} value={track.trackId}>
                    {getTrackName(track, session)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {children}
          </>
        ) : (
          emptyState
        )}
      </Paper>
    )
  },
)

export default PreConfiguredSyntenyTrackSelect
