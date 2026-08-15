import { useEffect, useId, useState } from 'react'

import {
  ErrorMessage,
  LabeledCheckbox,
  StatusProgressBar,
  SubmitDialog,
  replaceViewAction,
} from '@jbrowse/core/ui'
import {
  assembleLocString,
  createGuardedStatusSink,
  createStatusThrottle,
  getBpDisplayStr,
  isAbortException,
  statusFraction,
  statusProgressLabel,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AnchorIcon from '@mui/icons-material/Anchor'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import {
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import { launchSyntenyViewForFeatures } from './buildSyntenyViewSpec.ts'
import {
  AdvancedLaunchOptions,
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
  RpcStatus,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

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
  anchorLabel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
  },
  // stands in the checkbox column the mate rows have. MUI's small Checkbox is a
  // 20px icon in 9px of padding either side, so 38px starts the anchor's name in
  // the same place as every mate's.
  anchorMark: {
    width: 38,
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
  },
  // The select this stands in for carried `margin="dense"`, and without that
  // space the locus, the dataset and the line explaining the panel order stack
  // as three touching lines of text with nothing to say where one ends.
  dataset: {
    marginBottom: theme.spacing(1),
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

// The interval a row's panel will open on, unpadded. Unpadded because the
// window size is a live field further down the dialog and this is meant to say
// where in each assembly the region lands, not to restate that arithmetic. The
// strand is spelled out rather than left to the locstring's `[rev]`, which means
// "this panel opens flipped" and so depends on the checkbox below.
//
// The anchor's locus is the selection itself, which the dialog's title line also
// carries. That repetition is deliberate: this is a column and it is read down,
// a mate's locus says little except against the anchor's, and the row every
// other row was resolved against is the wrong place to leave a hole.
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
    row.kind === 'anchor'
      ? { ...region, reversed: false }
      : row.span && {
          refName: row.span.refName,
          start: row.span.mateStart,
          end: row.span.mateEnd,
          reversed: row.span.reversed,
        }
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
  const panelsLabelId = useId()
  const [trackId, setTrackId] = useState(tracks[0]!.trackId)
  const [rows, setRows] = useState<PanelRow[] | undefined>()
  const [unconfigured, setUnconfigured] = useState<string[]>([])
  const [error, setError] = useState<unknown>()
  // the discovery RPC's own phase, which replaces the hardcoded label below
  // once the worker says something more specific
  const [status, setStatus] = useState<RpcStatus | undefined>()
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
    setStatus(undefined)
    // guarded and throttled like every other owner of a progress stream: the
    // RPC emits at download granularity and each write re-renders the dialog.
    // One window per effect run, ended with it, so a trailing write cannot
    // outlive the discovery it describes
    const throttle = createStatusThrottle()
    const statusCallback = createGuardedStatusSink({
      isCurrent: () => alive,
      sink: setStatus,
      throttle,
    })
    discoverMatesFor(trackId)(stopToken, statusCallback)
      .then(result => {
        if (alive) {
          // seeded once from the fetch rather than derived every render,
          // because from here on the list is the user's: they reorder it and
          // uncheck rows
          setRows(toPanelRows(region.assemblyName, result.mates, region))
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
      // the guard already makes a queued write a no-op; the timer behind it
      // would otherwise still stand for up to a window past unmount
      throttle.reset()
    }
    // `region` whole rather than its assemblyName: the rows carry each panel's
    // resolved locus, which is cut from all four of its fields. Stable for the
    // dialog's life for the same reason `discoverMatesFor` is
  }, [discoverMatesFor, trackId, region])
  const { anchorIndex, mates } = launchOrder(rows ?? [])
  const launchDisabled = windowSize === undefined || !mates.length
  const launch = (replacing?: AbstractViewModel) => {
    if (windowSize !== undefined && mates.length) {
      launchSyntenyViewForFeatures({
        // flattened, in row order: the builder puts every alignment of one mate
        // assembly on that assembly's single panel
        features: mates.flatMap(row => row.features),
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
      {...replaceViewAction({
        session,
        sourceView,
        disabled: launchDisabled,
        onReplace: launch,
      })}
      open
      title="Launch synteny view for region"
      submitDisabled={launchDisabled}
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
      {/* Which dataset the panels are cut from has to be READ before the list
       below means anything, but with one open synteny track there is nothing to
       decide — and a full-width select holding its only value is a control the
       reader has to try before ruling it out. Stated in a line instead, in the
       same words as the field's label so the two renderings agree. Changing the
       field, when there is one, refetches the list. */}
      {tracks.length > 1 ? (
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
      ) : (
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.dataset}
        >
          Synteny dataset: {track.name}
        </Typography>
      )}
      {/* outside the scroller below: with a dozen panels the list scrolls, and
       the line saying what the order means is what would scroll away first.
       Named rather than merely adjacent, so the checkbox group below announces
       what it is a group of. */}
      <Typography variant="subtitle2" id={panelsLabelId}>
        Panels, top to bottom. Alignments are drawn between neighbouring panels,
        so the order decides which comparisons the view shows.
      </Typography>
      {error ? <ErrorMessage error={error} /> : null}
      {/* named, not a bare spinner: this is a feature fetch over the whole
       selection, which for a visible-region launch at chromosome zoom is a long
       enough wait to want to know what is being waited on. The RPC's own phase
       takes over as soon as it reports one, so the sentence below is what is
       shown up to the first status rather than for the whole wait */}
      {!rows && !error ? (
        <div className={classes.progress}>
          <CircularProgress size={20} />
          <Typography variant="body2">
            {statusProgressLabel(status) ||
              'Finding assemblies that align to this region'}
            ...
          </Typography>
        </div>
      ) : null}
      {!rows && !error && statusFraction(status) !== undefined ? (
        <StatusProgressBar fraction={statusFraction(status)} />
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
      <div
        className={classes.panels}
        role="group"
        aria-labelledby={panelsLabelId}
      >
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
            {row.kind === 'anchor' ? (
              // Not a disabled checkbox. The anchor is in the stack
              // unconditionally — it is the assembly the region was selected
              // on, and every mate's coordinates were resolved against it — but
              // `disabled` said so by making the row everything else is
              // measured from the lowest-contrast line in the dialog, and by
              // dropping its name out of the tab order while its own move
              // buttons stayed in it. A mark instead of a control: nothing to
              // click, and nothing greyed out.
              <Tooltip title="The assembly you selected in. Every other panel's locus is resolved against it, so this panel can be moved but not removed.">
                <div className={classes.anchorLabel}>
                  <div className={classes.anchorMark}>
                    <AnchorIcon fontSize="small" />
                  </div>
                  <Typography>{`${row.assemblyName} (your selection)`}</Typography>
                </div>
              </Tooltip>
            ) : (
              <LabeledCheckbox
                className={classes.panelLabel}
                size="small"
                checked={row.checked}
                onChange={val => {
                  setRows(setPanelChecked(rows, index, val))
                }}
                label={row.assemblyName}
              />
            )}
            {/* Where this panel will actually open, resolved the same way the
             launch resolves it — the assembly name alone says nothing about
             which contig the region reaches, whether the match is inverted, or
             that a mate's alignment stops short of the selection. */}
            <PanelLocus
              row={row}
              region={region}
              className={classes.panelLocus}
            />
            {/* positioned as well as named: a self-alignment track lists the
             anchor's assembly twice (see the key above), and "Move volvox up"
             twice over is two buttons a screen reader cannot tell apart */}
            <IconButton
              size="small"
              aria-label={`Move ${row.assemblyName} (panel ${index + 1}) up`}
              disabled={index === 0}
              onClick={() => {
                setRows(movePanel(rows, index, -1))
              }}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Move ${row.assemblyName} (panel ${index + 1}) down`}
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
      {/* Everything below the panel list is folded away, and the list is what
       the dialog is for — see AdvancedLaunchOptions for why these four and not
       the pairwise dialog's. */}
      <AdvancedLaunchOptions>
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
      </AdvancedLaunchOptions>
    </SubmitDialog>
  )
}
