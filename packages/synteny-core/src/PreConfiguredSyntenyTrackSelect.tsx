import { useId } from 'react'

import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { FormControl, InputLabel, MenuItem, Paper, Select } from '@mui/material'
import { observer } from 'mobx-react'

import { pickSyntenyTrackId } from './getSyntenyTracks.ts'

import type { ImportFormSyntenyModel } from './SelectorTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  panel: {
    padding: theme.spacing(1.5),
  },
  // same reasoning as QuickStartPanel's Select: one short control, so it stops
  // at a readable width instead of stretching the width of the window away from
  // the assembly selectors it belongs with
  track: {
    marginBottom: theme.spacing(1),
    maxWidth: 500,
  },
}))

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
    model: IStateTreeNode & ImportFormSyntenyModel
    tracks: AnyConfigurationModel[]
    rowIndex: number
    emptyState: React.ReactNode
    children?: React.ReactNode
  }) {
    const { classes } = useStyles()
    const session = getSession(model)
    // one per instance: the synteny form has one of these per row pair and two
    // views can have an import form open at once, so a fixed id would point
    // every label at the first Select on the page
    const labelId = useId()
    const selection = model.importFormSyntenyTrackSelections[rowIndex]
    const picked = selection?.type === 'preConfigured' ? selection.value : ''
    const value = pickSyntenyTrackId(picked, tracks) ?? ''
    return (
      <Paper className={classes.panel}>
        {tracks.length ? (
          <>
            <FormControl fullWidth className={classes.track}>
              <InputLabel id={labelId}>Synteny track</InputLabel>
              <Select
                labelId={labelId}
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
