import { useState } from 'react'

import { ErrorMessage, NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import {
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Typography,
} from '@mui/material'

import { launchSyntenyViewForFeatures } from './buildSyntenyViewSpec.ts'
import {
  checkedPanels,
  movePanel,
  setPanelChecked,
  toPanelRows,
} from './panelOrder.ts'

import type { PanelRow } from './panelOrder.ts'
import type { MateCandidate } from './pickMatesForRegion.ts'
import type { AbstractSessionModel, Region } from '@jbrowse/core/util'

const DEFAULT_WINDOW_SIZE = 1000

const useStyles = makeStyles()({
  formControl: {
    margin: 10,
    border: '1px solid #ccc',
  },
  panels: {
    margin: 10,
    maxHeight: 260,
    overflowY: 'auto',
  },
  panelRow: {
    display: 'flex',
    alignItems: 'center',
  },
  panelLabel: {
    flex: 1,
  },
})

export default function LaunchSyntenyViewForRegionDialog({
  session,
  region,
  track,
  discoverMates,
  handleClose,
}: {
  session: AbstractSessionModel
  region: Region
  track: { trackId: string; name: string }
  discoverMates: () => Promise<MateCandidate[]>
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [rows, setRows] = useState<PanelRow[] | undefined>()
  const [flipReversedMates, setFlipReversedMates] = useState(true)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  const { error } = useFetch(
    ['syntenyMatesForRegion', track.trackId, assembleLocString(region)],
    discoverMates,
    {
      // seeded once from the fetch rather than derived every render, because
      // from here on the list is the user's: they reorder it and uncheck rows
      onSuccess: candidates => {
        setRows(toPanelRows(candidates))
      },
    },
  )
  const selected = rows ? checkedPanels(rows) : []

  return (
    <SubmitDialog
      open
      title="Launch synteny view for region"
      submitDisabled={windowSize === undefined || !selected.length}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        if (windowSize !== undefined && selected.length) {
          launchSyntenyViewForFeatures({
            features: selected.map(row => row.feature),
            anchorAssembly: region.assemblyName,
            windowSize,
            flipReversedMates,
            trackId: track.trackId,
            session,
            region,
          })
          handleClose()
        }
      }}
    >
      <Typography>
        {assembleLocString(region)} on {track.name}
      </Typography>
      <div className={classes.panels}>
        <Typography variant="subtitle2">
          Panels, top to bottom. Alignments are drawn between neighbouring
          panels, so the order decides which comparisons the view shows.
        </Typography>
        {error ? <ErrorMessage error={error} /> : null}
        {!rows && !error ? <CircularProgress size={20} /> : null}
        {rows && !rows.length ? (
          <Typography variant="body2">
            No other assembly aligns to this region
          </Typography>
        ) : null}
        {rows?.map((row, index) => (
          <div className={classes.panelRow} key={row.assemblyName}>
            <FormControlLabel
              className={classes.panelLabel}
              control={
                <Checkbox
                  checked={row.checked}
                  onChange={event => {
                    setRows(setPanelChecked(rows, index, event.target.checked))
                  }}
                />
              }
              label={row.assemblyName}
            />
            <IconButton
              size="small"
              aria-label={`Move ${row.assemblyName} up`}
              disabled={index === 0}
              onClick={() => {
                setRows(movePanel(rows, index, -1))
              }}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Move ${row.assemblyName} down`}
              disabled={index === rows.length - 1}
              onClick={() => {
                setRows(movePanel(rows, index, 1))
              }}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </div>
        ))}
      </div>
      <FormControlLabel
        className={classes.formControl}
        control={
          <Checkbox
            checked={flipReversedMates}
            onChange={event => {
              setFlipReversedMates(event.target.checked)
            }}
          />
        }
        label="Horizontally flip targets that are inverted (without flipping, an inverted panel's coordinates decrease left to right)"
      />
      <NumberTextField
        label="Add window size in bp"
        defaultValue={DEFAULT_WINDOW_SIZE}
        onValueChange={val => {
          setWindowSize(val)
        }}
        min={0}
        errorText="Must be a non-negative number"
      />
    </SubmitDialog>
  )
}
