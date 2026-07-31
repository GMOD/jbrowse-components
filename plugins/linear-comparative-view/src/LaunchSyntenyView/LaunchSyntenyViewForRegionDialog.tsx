import { useEffect, useState } from 'react'

import { ErrorMessage, LabeledCheckbox, SubmitDialog } from '@jbrowse/core/ui'
import {
  assembleLocString,
  getBpDisplayStr,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import {
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'

import { launchSyntenyViewForFeatures } from './buildSyntenyViewSpec.ts'
import {
  CollapsePanelsCheckbox,
  DEFAULT_WINDOW_SIZE,
  FlipInvertedTargetsCheckbox,
  WindowSizeField,
} from './launchOptionFields.tsx'
import {
  launchOrder,
  movePanel,
  setAllPanelsChecked,
  setPanelChecked,
  toPanelRows,
} from './panelOrder.ts'

import type { MateDiscovery } from './discoverMates.ts'
import type { PanelRow } from './panelOrder.ts'
import type { AbstractSessionModel, Region } from '@jbrowse/core/util'

// The panel list is one row per aligning assembly, so an all-vs-all locus can
// produce a dozen; at MUI's default checkbox padding that list alone is taller
// than the rest of the dialog. Rows are compacted to a single text line each
// (small checkbox, no vertical margin) so the whole list stays readable at once.
const useStyles = makeStyles()({
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
    margin: 0,
  },
})

export default function LaunchSyntenyViewForRegionDialog({
  session,
  region,
  tracks,
  discoverMatesFor,
  handleClose,
}: {
  session: AbstractSessionModel
  region: Region
  tracks: { trackId: string; name: string }[]
  discoverMatesFor: (trackId: string) => MateDiscovery
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [trackId, setTrackId] = useState(tracks[0]!.trackId)
  const [rows, setRows] = useState<PanelRow[] | undefined>()
  const [error, setError] = useState<unknown>()
  const [flipReversedMates, setFlipReversedMates] = useState(true)
  const [collapseEmptyRows, setCollapseEmptyRows] = useState(true)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  const track = tracks.find(t => t.trackId === trackId)!

  // Hand-rolled rather than useFetch because the result is seeded into state
  // the user then owns: they reorder the rows and uncheck them, so this can't be
  // re-derived from `data` every render. `discoverMatesFor` is stable —
  // queueDialog resolves the dialog's props once, at the point the menu item was
  // clicked — so this re-runs on the dataset the user picks and nothing else,
  // and the cleanup stops the discovery for the dataset they picked away from.
  // A selection can be a whole chromosome, so that cleanup matters: the token is
  // created and stopped by the same effect, giving it the fetch's lifetime.
  useEffect(() => {
    const stopToken = createStopToken()
    let alive = true
    setRows(undefined)
    setError(undefined)
    discoverMatesFor(trackId)(stopToken)
      .then(candidates => {
        if (alive) {
          // seeded once from the fetch rather than derived every render,
          // because from here on the list is the user's: they reorder it and
          // uncheck rows
          setRows(toPanelRows(region.assemblyName, candidates))
        }
      })
      .catch((e: unknown) => {
        if (alive && !isAbortException(e)) {
          setError(e)
        }
      })
    return () => {
      alive = false
      stopStopToken(stopToken)
    }
  }, [discoverMatesFor, trackId, region.assemblyName])
  const { anchorIndex, mates } = launchOrder(rows ?? [])

  return (
    <SubmitDialog
      open
      title="Launch synteny view for region"
      submitDisabled={windowSize === undefined || !mates.length}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        if (windowSize !== undefined && mates.length) {
          launchSyntenyViewForFeatures({
            features: mates.map(row => row.feature),
            anchorAssembly: region.assemblyName,
            anchorIndex,
            windowSize,
            flipReversedMates,
            collapseEmptyRows,
            trackId,
            session,
            region,
          })
          handleClose()
        }
      }}
    >
      {/* the size, because a rubberband can cover a whole chromosome without
       looking like it, and every panel is framed on what it says. No assembly
       in the locstring: it is the anchor row of the list right below, and
       `{volvox}ctgA:1..50,000` reads as punctuation noise next to it */}
      <Typography>
        {assembleLocString({
          refName: region.refName,
          start: region.start,
          end: region.end,
        })}{' '}
        ({getBpDisplayStr(region.end - region.start)})
      </Typography>
      {/* First field, and present even for a single dataset: the panel list
       below is what this dataset aligns to, so which one it is has to be read
       before the list means anything. Changing it refetches that list. */}
      <TextField
        select
        fullWidth
        margin="dense"
        label="Synteny dataset"
        value={trackId}
        onChange={event => {
          setTrackId(event.target.value)
        }}
      >
        {tracks.map(t => (
          <MenuItem key={t.trackId} value={t.trackId}>
            {t.name}
          </MenuItem>
        ))}
      </TextField>
      {/* outside the scroller below: with a dozen panels the list scrolls, and
       the line saying what the order means is what would scroll away first */}
      <Typography variant="subtitle2">
        Panels, top to bottom. Alignments are drawn between neighbouring panels,
        so the order decides which comparisons the view shows.
      </Typography>
      {error ? <ErrorMessage error={error} /> : null}
      {!rows && !error ? <CircularProgress size={20} /> : null}
      {/* names the dataset rather than saying "this dataset": with the selector
       above, the fix is to try another one */}
      {rows && !mates.length ? (
        <Typography variant="body2">
          Nothing in {track.name} aligns to this region
        </Typography>
      ) : null}
      <div className={classes.panels}>
        {/* keyed by position, which is also what movePanel/setPanelChecked
        address: a self-alignment track keeps its own lane as a mate (see
        pickMatesForRegion), so the anchor and that mate carry the same
        assembly name and the name is not an identity */}
        {rows?.map((row, index) => (
          <div
            className={classes.panelRow}
            // eslint-disable-next-line @eslint-react/no-array-index-key -- see above
            key={`${row.assemblyName}-${index}`}
          >
            <LabeledCheckbox
              className={classes.panelLabel}
              size="small"
              // the anchor is the assembly the region was selected on, and
              // every mate's coordinates were resolved against it, so it is in
              // the stack unconditionally — it can only be moved
              disabled={row.kind === 'anchor'}
              checked={row.kind === 'anchor' || row.checked}
              onChange={val => {
                setRows(setPanelChecked(rows, index, val))
              }}
              label={
                row.kind === 'anchor'
                  ? `${row.assemblyName} (your selection)`
                  : row.assemblyName
              }
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
      {/* an all-vs-all locus can list a dozen assemblies, all checked, and
       picking two of them out is otherwise ten clicks of unchecking */}
      {rows && rows.length > 3 ? (
        <div>
          <Button
            size="small"
            onClick={() => {
              setRows(setAllPanelsChecked(rows, true))
            }}
          >
            Select all
          </Button>
          <Button
            size="small"
            onClick={() => {
              setRows(setAllPanelsChecked(rows, false))
            }}
          >
            Select none
          </Button>
        </div>
      ) : null}
      <FlipInvertedTargetsCheckbox
        checked={flipReversedMates}
        onChange={val => {
          setFlipReversedMates(val)
        }}
      />
      <CollapsePanelsCheckbox
        checked={collapseEmptyRows}
        onChange={val => {
          setCollapseEmptyRows(val)
        }}
      />
      <WindowSizeField
        onChange={val => {
          setWindowSize(val)
        }}
      />
    </SubmitDialog>
  )
}
