import { useId, useState } from 'react'

import { ErrorMessage, StatusProgressBar } from '@jbrowse/core/ui'
import {
  assembleLocString,
  getBpDisplayStr,
  statusFraction,
  statusProgressLabel,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'

import PanelList from './PanelList.tsx'
import SyntenyLaunchDialog from './SyntenyLaunchDialog.tsx'
import { launchSyntenyViewForPanels } from './buildSyntenyViewSpec.ts'
import {
  AdvancedLaunchOptions,
  CollapsePanelsCheckbox,
  CopySourceTracksCheckbox,
  DEFAULT_WINDOW_SIZE,
  FlipInvertedTargetsCheckbox,
  WindowSizeField,
} from './launchOptionFields.tsx'
import { launchOrder } from './panelOrder.ts'
import { useMateDiscovery } from './useMateDiscovery.ts'

import type { MateDiscovery } from './discoverMates.ts'
import type {
  AbstractViewContainer,
  AbstractViewModel,
  NotificationSink,
  Region,
  RpcStatus,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

const useStyles = makeStyles()(theme => ({
  // The select this stands in for carried `margin="dense"`, and without that
  // space the locus, the dataset and the line explaining the panel order stack
  // as three touching lines of text with nothing to say where one ends.
  dataset: {
    marginBottom: theme.spacing(1),
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}))

interface LaunchableTrack {
  trackId: string
  name: string
}

// A locus on an all-vs-all file can reach dozens of samples the config declares
// no assembly for, so the list is capped rather than spilling the dialog.
function nameList(names: string[], max = 5) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return `${shown.join(', ')}${rest > 0 ? `, and ${rest} more` : ''}`
}

// The size, because a rubberband can cover a whole chromosome without looking
// like it, and every panel is framed on what it says. No assembly in the
// locstring: it is the anchor row of the panel list below, and
// `{volvox}ctgA:1..50,000` reads as punctuation noise next to it.
function SelectedRegion({ region }: { region: Region }) {
  return (
    <Typography>
      {assembleLocString({
        refName: region.refName,
        start: region.start,
        end: region.end,
      })}{' '}
      ({getBpDisplayStr(region.end - region.start)})
    </Typography>
  )
}

// Which dataset the panels are cut from has to be READ before the list below
// means anything, but with one open synteny track there is nothing to decide —
// and a full-width select holding its only value is a control the reader has to
// try before ruling it out. Stated in a line instead, in the same words as the
// field's label so the two renderings agree. Changing the field, when there is
// one, refetches the list.
function DatasetField({
  tracks,
  trackId,
  onChange,
}: {
  tracks: LaunchableTrack[]
  trackId: string
  onChange: (trackId: string) => void
}) {
  const { classes } = useStyles()
  return tracks.length > 1 ? (
    <TextField
      select
      fullWidth
      margin="dense"
      label="Synteny dataset"
      value={trackId}
      onChange={event => {
        onChange(event.target.value)
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
      Synteny dataset: {tracks[0]!.name}
    </Typography>
  )
}

// Everything between "asked the worker" and "here are your panels": the wait,
// the failure, and the two ways a dataset can reach nothing openable. Naming the
// dataset rather than saying "this dataset", because with the selector above the
// fix is to try another one — unless the dataset does align here and simply
// reaches nothing openable, which is a different problem with a different fix,
// and saying "nothing aligns" for it contradicts the lanes the user can see
// drawn in the track they launched from.
function DiscoveryStatus({
  trackName,
  loading,
  error,
  onRetry,
  mateCount,
  unconfigured,
  status,
}: {
  trackName: string
  loading: boolean
  error: unknown
  onRetry: () => void
  mateCount: number | undefined
  unconfigured: string[]
  status: RpcStatus | undefined
}) {
  const { classes } = useStyles()
  if (error) {
    // Retry, because what failed is a fetch over the network and cancelling out
    // of the dialog to find the menu entry again loses the dataset, the panel
    // order and the options chosen before the blip.
    return (
      <>
        <ErrorMessage error={error} />
        <Button size="small" onClick={onRetry}>
          Retry
        </Button>
      </>
    )
  }
  if (loading) {
    // named, not a bare spinner: this is a feature fetch over the whole
    // selection, which for a visible-region launch at chromosome zoom is a long
    // enough wait to want to know what is being waited on. The RPC's own phase
    // takes over as soon as it reports one, so the sentence below is what is
    // shown up to the first status rather than for the whole wait
    return (
      <>
        <div className={classes.progress}>
          <CircularProgress size={20} />
          <Typography variant="body2">
            {statusProgressLabel(status) ||
              'Finding assemblies that align to this region'}
            ...
          </Typography>
        </div>
        {statusFraction(status) !== undefined ? (
          <StatusProgressBar fraction={statusFraction(status)} />
        ) : null}
      </>
    )
  }
  if (mateCount === 0) {
    return (
      <Typography variant="body2">
        {unconfigured.length > 0
          ? `${trackName} aligns here only to ${nameList(unconfigured)}, which this track declares no assembly for. A panel can only open on an assembly JBrowse has loaded.`
          : `Nothing in ${trackName} aligns to this region`}
      </Typography>
    )
  }
  return null
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
  session: AbstractViewContainer & NotificationSink
  region: Region
  tracks: LaunchableTrack[]
  // the launching view's own tracks, for the panel that opens on its assembly
  anchorTracks?: TrackInit[]
  // the launching view itself, which the dialog offers to put the result in
  // place of
  sourceView?: AbstractViewModel
  discoverMatesFor: (trackId: string) => MateDiscovery
  handleClose: () => void
}) {
  const panelsLabelId = useId()
  const [trackId, setTrackId] = useState(tracks[0]!.trackId)
  const [flipReversedMates, setFlipReversedMates] = useState(true)
  const [collapseEmptyRows, setCollapseEmptyRows] = useState(true)
  const [copySourceTracks, setCopySourceTracks] = useState(true)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  const track = tracks.find(t => t.trackId === trackId)!
  const { rows, setRows, unconfigured, error, status, retry } =
    useMateDiscovery({
      discoverMatesFor,
      trackId,
      region,
    })
  const { anchorIndex, mates } = launchOrder(rows ?? [])

  return (
    <SyntenyLaunchDialog
      session={session}
      sourceView={sourceView}
      title="Launch synteny view for region"
      ready={
        windowSize !== undefined && mates.length
          ? { windowSize, anchorIndex, mates }
          : undefined
      }
      handleClose={handleClose}
      onLaunch={({ windowSize, anchorIndex, mates }, replacing) => {
        launchSyntenyViewForPanels({
          // the rows themselves: the worker resolved each panel against this
          // region, and reordering or unchecking moves a panel rather than
          // moving where it opens
          panels: mates,
          anchorAssembly: region.assemblyName,
          anchorRefName: region.refName,
          anchorIndex,
          anchorTracks: copySourceTracks ? anchorTracks : undefined,
          windowSize,
          flipReversedMates,
          collapseEmptyRows,
          trackId,
          session,
          replacing,
        })
      }}
    >
      <SelectedRegion region={region} />
      <DatasetField tracks={tracks} trackId={trackId} onChange={setTrackId} />
      {/* outside the scroller below: with a dozen panels the list scrolls, and
       the line saying what the order means is what would scroll away first.
       Named rather than merely adjacent, so the checkbox group below announces
       what it is a group of. */}
      <Typography variant="subtitle2" id={panelsLabelId}>
        Panels, top to bottom. Alignments are drawn between neighbouring panels,
        so the order decides which comparisons the view shows.
      </Typography>
      <DiscoveryStatus
        trackName={track.name}
        loading={!rows}
        status={status}
        error={error}
        onRetry={retry}
        mateCount={rows && mates.length}
        unconfigured={unconfigured}
      />
      {rows ? (
        <PanelList
          rows={rows}
          region={region}
          setRows={setRows}
          labelledBy={panelsLabelId}
        />
      ) : null}
      {/* Why the list is shorter than the lanes drawn in the track this was
       launched from: an all-vs-all file carries every sample it was built with,
       and only the ones the track declares an assembly for can be a panel. */}
      {unconfigured.length > 0 && mates.length > 0 ? (
        <Typography variant="body2">
          {nameList(unconfigured)} also align here, but this track declares no
          assembly for them, so they get no panel.
        </Typography>
      ) : null}
      {/* Everything below the panel list is folded away, and the list is what
       the dialog is for — see AdvancedLaunchOptions for why these four and not
       the pairwise dialog's. */}
      <AdvancedLaunchOptions>
        <FlipInvertedTargetsCheckbox
          checked={flipReversedMates}
          onChange={setFlipReversedMates}
        />
        {anchorTracks.length ? (
          <CopySourceTracksCheckbox
            checked={copySourceTracks}
            onChange={setCopySourceTracks}
          />
        ) : null}
        <CollapsePanelsCheckbox
          checked={collapseEmptyRows}
          onChange={setCollapseEmptyRows}
        />
        <WindowSizeField onChange={setWindowSize} />
      </AdvancedLaunchOptions>
    </SyntenyLaunchDialog>
  )
}
