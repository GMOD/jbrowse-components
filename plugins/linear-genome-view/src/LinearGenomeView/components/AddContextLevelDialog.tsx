import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { SubmitDialog } from '@jbrowse/core/ui'
import { coarseStripHTML, getSession } from '@jbrowse/core/util'
import {
  allSessionTracks,
  getTrackName,
  offeredTracks,
} from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()(theme => ({
  list: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 260,
    overflowY: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.5, 1),
  },
  filter: {
    marginBottom: theme.spacing(1),
  },
}))

interface TrackOption {
  trackId: string
  name: string
}

function trackIds(tracks: { configuration: AnyConfigurationModel }[]) {
  return tracks.map(
    track => readConfObject(track.configuration, 'trackId') as string,
  )
}

/**
 * Where a context level arrives: which tracks are on it, and which side of the
 * tracks the stack sits on.
 *
 * It asks for no span. The level arrives ten times wider than the widest one
 * there is and the wheel takes it from there, which is a gesture over the
 * picture rather than a number nobody brings to the dialog. The model's action
 * still takes `windowWidthBp`, for a stack a spec or an agent builds outright.
 *
 * The tracks open here are the ones checked, so Add alone is a wider view of
 * what is already on screen. A name is stripped of the markup a track config
 * may carry (`coarseStripHTML`), since this row is a label rather than a place
 * a link could be followed.
 *
 * The side belongs to the stack rather than to this level, so the radio moves
 * levels that are already here — the narrowest level touches the tracks either
 * way, and a stack split over both sides is two figures in one view.
 */
const AddContextLevelDialog = observer(function AddContextLevelDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const options: TrackOption[] = offeredTracks(allSessionTracks(session), {
    view: model,
    assemblyNames: model.assemblyNames,
  }).map(conf => ({
    trackId: readConfObject(conf, 'trackId') as string,
    name: coarseStripHTML(getTrackName(conf, session)),
  }))

  const [below, setBelow] = useState(model.contextLevelsBelow)
  // The view's own tracks, which are what the list opens checked AND what it
  // sorts to the top: a session's track list runs to tens of entries, so the
  // rows a reader came to see would otherwise be below the fold with every
  // visible box unchecked. Read once rather than off `checked`, so the order
  // holds still while the boxes are clicked.
  const [opened] = useState(() => new Set(trackIds(model.tracks)))
  const [checked, setChecked] = useState(() => new Set(opened))
  const [filter, setFilter] = useState('')
  const needle = filter.toLowerCase()
  const matched = needle
    ? options.filter(option => option.name.toLowerCase().includes(needle))
    : options
  const shown = matched.toSorted(
    (a, b) => Number(opened.has(b.trackId)) - Number(opened.has(a.trackId)),
  )
  const stacked = model.contextLevelViews.length

  return (
    <SubmitDialog
      open
      maxWidth="sm"
      fullWidth
      title="Add context level"
      onCancel={handleClose}
      submitText="Add"
      onSubmit={() => {
        model.setContextLevelsBelow(below)
        model.addContextLevel({
          trackIds: options
            .map(option => option.trackId)
            .filter(trackId => checked.has(trackId)),
        })
        handleClose()
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Typography>
          A wider view of this locus with tracks of its own, ten times the
          widest level here. It stays centred on this view, and zooming it
          changes its span alone.
        </Typography>
        <div>
          <Typography>Tracks on the level</Typography>
          <div data-testid="context-level-tracks">
            <TextField
              autoFocus
              fullWidth
              size="small"
              variant="outlined"
              className={classes.filter}
              placeholder="Filter tracks"
              value={filter}
              slotProps={{
                htmlInput: { 'data-testid': 'context-level-track-filter' },
              }}
              onChange={event => {
                setFilter(event.target.value)
              }}
            />
            <div className={classes.list}>
              {shown.map(({ trackId, name }) => (
                <FormControlLabel
                  key={trackId}
                  label={name}
                  control={
                    <Checkbox
                      size="small"
                      checked={checked.has(trackId)}
                      data-testid={`context-level-track-${trackId}`}
                      onChange={() => {
                        setChecked(current => {
                          const next = new Set(current)
                          if (!next.delete(trackId)) {
                            next.add(trackId)
                          }
                          return next
                        })
                      }}
                    />
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <div>
          <Typography>Where the stack goes</Typography>
          <RadioGroup
            row
            value={below ? 'below' : 'above'}
            onChange={event => {
              setBelow(event.target.value === 'below')
            }}
          >
            <FormControlLabel
              value="above"
              control={<Radio />}
              label="Above the tracks"
            />
            <FormControlLabel
              value="below"
              control={<Radio />}
              label="Below the tracks"
            />
          </RadioGroup>
          {stacked ? (
            <Typography variant="body2" color="text.secondary">
              The whole stack sits on one side, so this moves the{' '}
              {stacked === 1 ? 'level' : `${stacked} levels`} already here.
            </Typography>
          ) : null}
        </div>
      </div>
    </SubmitDialog>
  )
})

export default AddContextLevelDialog
