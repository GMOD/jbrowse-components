import { useEffect, useState } from 'react'

import {
  ErrorMessage,
  LabeledCheckbox,
  ReplaceCurrentViewButton,
  SubmitDialog,
} from '@jbrowse/core/ui'
import {
  assembleLocString,
  getBpDisplayStr,
  isAbortException,
  isSessionWithViewReplacement,
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

import {
  launchSyntenyViewForFeatures,
  resolvedMateSpan,
} from './buildSyntenyViewSpec.ts'
import {
  CollapsePanelsCheckbox,
  CopySourceTracksCheckbox,
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
import type {
  AbstractSessionModel,
  AbstractViewModel,
  Region,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/plugin-linear-genome-view'

// The panel list is one row per aligning assembly, so an all-vs-all locus can
// produce a dozen; at MUI's default checkbox padding that list alone is taller
// than the rest of the dialog. Rows are compacted to a single text line each
// (small checkbox, no vertical margin) so the whole list stays readable at once.
const useStyles = makeStyles()(theme => ({
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
  // outside the checkbox's own label, so the row's accessible name stays the
  // assembly — the locus is what the panel will show, not what it is
  panelLocus: {
    marginRight: theme.spacing(1),
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}))

// The mate interval a row's panel will open on, unpadded. Unpadded because the
// window size is a live field further down the dialog and this is meant to say
// where in the mate assembly the region lands, not to restate that arithmetic;
// the anchor row contributes nothing, since its locus is the dialog's own title
// line. The strand is spelled out rather than left to the locstring's `[rev]`,
// which means "this panel opens flipped" and so depends on the checkbox below.
function PanelLocus({
  row,
  region,
  className,
}: {
  row: PanelRow
  region: Region
  className?: string
}) {
  const span =
    row.kind === 'anchor' ? undefined : resolvedMateSpan(row.feature, region)
  return span ? (
    <Typography variant="body2" className={className}>
      {assembleLocString({
        refName: span.refName,
        start: span.start,
        end: span.end,
      })}
      {span.reversed ? ' (-)' : ''}
    </Typography>
  ) : null
}

// A locus on an all-vs-all file can reach dozens of samples the config declares
// no assembly for, so the list is capped rather than spilling the dialog.
function nameList(names: string[], max = 5) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return `${shown.join(', ')}${rest > 0 ? `, and ${rest} more` : ''}`
}

export default function LaunchSyntenyViewForRegionDialog({
  session,
  region,
  tracks,
  anchorTracks = [],
  sourceView,
  discoverMatesFor,
  handleClose,
}: {
  session: AbstractSessionModel
  region: Region
  tracks: { trackId: string; name: string }[]
  // the launching view's own tracks, for the panel that opens on its assembly
  anchorTracks?: TrackInit[]
  // the launching view itself, which the dialog offers to put the result in
  // place of
  sourceView?: AbstractViewModel
  discoverMatesFor: (trackId: string) => MateDiscovery
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [trackId, setTrackId] = useState(tracks[0]!.trackId)
  const [rows, setRows] = useState<PanelRow[] | undefined>()
  const [unconfigured, setUnconfigured] = useState<string[]>([])
  const [error, setError] = useState<unknown>()
  const [flipReversedMates, setFlipReversedMates] = useState(true)
  const [collapseEmptyRows, setCollapseEmptyRows] = useState(true)
  const [copySourceTracks, setCopySourceTracks] = useState(true)
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
    setUnconfigured([])
    setError(undefined)
    discoverMatesFor(trackId)(stopToken)
      .then(result => {
        if (alive) {
          // seeded once from the fetch rather than derived every render,
          // because from here on the list is the user's: they reorder it and
          // uncheck rows
          setRows(toPanelRows(region.assemblyName, result.mates))
          setUnconfigured(result.unconfigured)
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
  const canReplace = !!sourceView && isSessionWithViewReplacement(session)
  const launchDisabled = windowSize === undefined || !mates.length
  const launch = (replacing?: AbstractViewModel) => {
    if (windowSize !== undefined && mates.length) {
      launchSyntenyViewForFeatures({
        features: mates.map(row => row.feature),
        anchorAssembly: region.assemblyName,
        anchorIndex,
        anchorTracks: copySourceTracks ? anchorTracks : undefined,
        windowSize,
        flipReversedMates,
        collapseEmptyRows,
        trackId,
        session,
        region,
        replacing,
      })
      handleClose()
    }
  }

  return (
    <SubmitDialog
      open
      title="Launch synteny view for region"
      submitDisabled={launchDisabled}
      submitText={canReplace ? 'Open in new view' : undefined}
      actions={
        canReplace ? (
          <ReplaceCurrentViewButton
            disabled={launchDisabled}
            onClick={() => {
              launch(sourceView)
            }}
          />
        ) : null
      }
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        launch()
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
      {/* named, not a bare spinner: this is a feature fetch over the whole
       selection, which for a visible-region launch at chromosome zoom is a long
       enough wait to want to know what is being waited on */}
      {!rows && !error ? (
        <div className={classes.progress}>
          <CircularProgress size={20} />
          <Typography variant="body2">
            Finding assemblies that align to this region...
          </Typography>
        </div>
      ) : null}
      {/* Names the dataset rather than saying "this dataset": with the selector
       above, the fix is to try another one — unless the dataset does align here
       and simply reaches nothing openable, which is a different problem with a
       different fix, and saying "nothing aligns" for it contradicts the lanes
       the user can see drawn in the track they launched from. */}
      {rows && !mates.length ? (
        <Typography variant="body2">
          {unconfigured.length > 0
            ? `${track.name} aligns here only to ${nameList(unconfigured)}, which this track declares no assembly for. A panel can only open on an assembly JBrowse has loaded.`
            : `Nothing in ${track.name} aligns to this region`}
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
            {/* Where this panel will actually open, resolved the same way the
             launch resolves it — the assembly name alone says nothing about
             which contig the region reaches, whether the match is inverted, or
             that a mate's alignment stops short of the selection. The anchor
             row's own locus is the line at the top of the dialog. */}
            <PanelLocus
              row={row}
              region={region}
              className={classes.panelLocus}
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
      {/* Why the list is shorter than the lanes drawn in the track this was
       launched from: an all-vs-all file carries every sample it was built with,
       and only the ones the track declares an assembly for can be a panel. */}
      {unconfigured.length > 0 && mates.length > 0 ? (
        <Typography variant="body2">
          {nameList(unconfigured)} also align here, but this track declares no
          assembly for them, so they get no panel.
        </Typography>
      ) : null}
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
      {anchorTracks.length ? (
        <CopySourceTracksCheckbox
          checked={copySourceTracks}
          onChange={val => {
            setCopySourceTracks(val)
          }}
        />
      ) : null}
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
