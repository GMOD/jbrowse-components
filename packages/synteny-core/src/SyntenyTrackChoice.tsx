import { useId } from 'react'

import { coarseStripHTML, getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  // stops at a readable width instead of stretching across a wide window away
  // from the controls it belongs with
  track: {
    marginBottom: theme.spacing(1),
    maxWidth: 500,
  },
}))

/**
 * The synteny track a pair or a Quick start launch uses. With one candidate
 * there is nothing to choose, so the track is named as text; a Select appears
 * only when two or more tracks fit. Callers render their own empty state.
 */
const SyntenyTrackChoice = observer(function SyntenyTrackChoice({
  model,
  tracks,
  value,
  onChange,
}: {
  // only read for getSession. IStateTreeNode rather than IAnyStateTreeNode,
  // which resolves to `any`
  model: IStateTreeNode
  tracks: AnyTrackConfig[]
  value: string
  onChange: (trackId: string) => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  // two views can have an import form open at once, so a fixed id would point
  // the label at whichever Select rendered first
  const labelId = useId()
  const name = (track: AnyTrackConfig) =>
    coarseStripHTML(getTrackName(track, session))
  const only = tracks.length === 1 ? tracks[0] : undefined
  return only ? (
    <Typography className={classes.track} data-testid="synteny-track-name">
      <Typography component="span" color="text.secondary">
        Synteny track:
      </Typography>{' '}
      {name(only)}
    </Typography>
  ) : (
    <FormControl fullWidth className={classes.track}>
      <InputLabel id={labelId}>Synteny track</InputLabel>
      <Select
        labelId={labelId}
        label="Synteny track"
        value={value}
        onChange={event => {
          onChange(event.target.value)
        }}
      >
        {tracks.map(track => (
          <MenuItem key={track.trackId} value={track.trackId}>
            {name(track)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default SyntenyTrackChoice
