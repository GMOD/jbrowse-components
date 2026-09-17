import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { SubmitDialog } from '@jbrowse/core/ui'
import { getSession, parseBpString, toLocale } from '@jbrowse/core/util'
import {
  allSessionTracks,
  filterTracks,
  getTrackName,
} from '@jbrowse/core/util/tracks'
import {
  Autocomplete,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model.ts'

interface TrackOption {
  trackId: string
  name: string
}

/**
 * The span a new level opens at, ten times the widest level in the stack — the
 * same default the model's own action carries, seeded here so the reader can
 * type over it.
 */
function defaultSpan(model: LinearGenomeViewModel) {
  const widest = model.contextLevelViews[0]
  return (widest?.windowWidthBp ?? model.windowWidthBp) * 10
}

/**
 * Where a context level arrives: how wide, which side of the tracks, and with
 * which tracks already on it.
 *
 * The side belongs to the stack rather than to this level, so the radio moves
 * levels that are already here — the narrowest level touches the tracks either
 * way, and a stack split over both sides is two figures in one view.
 *
 * Picking tracks here rather than leaving it to the level's own selector is the
 * whole reason the dialog is worth opening: a level arrives empty, and the
 * track it is for is the reason anybody added it.
 */
const AddContextLevelDialog = observer(function AddContextLevelDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const session = getSession(model)
  const options: TrackOption[] = filterTracks(allSessionTracks(session), {
    view: model,
    assemblyNames: model.assemblyNames,
  }).map(conf => ({
    trackId: readConfObject(conf, 'trackId') as string,
    name: getTrackName(conf, session),
  }))

  const [span, setSpan] = useState(() =>
    toLocale(Math.floor(defaultSpan(model))),
  )
  const [below, setBelow] = useState(model.contextLevelsBelow)
  const [tracks, setTracks] = useState<TrackOption[]>([])

  const windowWidthBp = parseBpString(span)
  const tooNarrow =
    windowWidthBp !== undefined && windowWidthBp <= model.windowWidthBp
  const valid = windowWidthBp !== undefined && !tooNarrow
  const stacked = model.contextLevelViews.length

  return (
    <SubmitDialog
      open
      maxWidth="sm"
      fullWidth
      title="Add context level"
      onCancel={handleClose}
      submitText="Add"
      submitDisabled={!valid}
      onSubmit={() => {
        if (valid) {
          model.setContextLevelsBelow(below)
          model.addContextLevel({
            windowWidthBp,
            trackIds: tracks.map(t => t.trackId),
          })
        }
        handleClose()
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Typography>
          A context level is a second view of this same locus at a wider span,
          with tracks of its own, joined to the tracks by a trapezoid. It stays
          centred on this view, and zooming it changes its span alone.
        </Typography>
        <TextField
          label="Level width (bp)"
          autoFocus
          fullWidth
          variant="outlined"
          value={span}
          error={!valid}
          helperText={
            tooNarrow
              ? 'A level shows more than the tracks under it, so this has to be wider than the current view'
              : 'In full or abbreviated, e.g. 500kb or 1.5Mbp'
          }
          slotProps={{ htmlInput: { 'data-testid': 'context-level-span' } }}
          onChange={event => {
            setSpan(event.target.value)
          }}
        />
        <Autocomplete
          multiple
          options={options}
          value={tracks}
          getOptionLabel={option => option.name}
          isOptionEqualToValue={(option, value) =>
            option.trackId === value.trackId
          }
          onChange={(_event, value) => {
            setTracks(value)
          }}
          renderInput={params => (
            <TextField
              {...params}
              variant="outlined"
              label="Tracks on the level"
              placeholder={options.length ? 'Search tracks' : 'No tracks'}
            />
          )}
        />
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
