import { lazy } from 'react'

import {
  clearPromotedDefaults,
  getDisplayTypeDefaultChanges,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { ResolvableDisplay } from '@jbrowse/core/configuration'

const TrackSettingsChangesDialog = lazy(
  () => import('../dialogs/TrackSettingsChangesDialog.tsx'),
)

const useStyles = makeStyles()(theme => ({
  editButton: {
    padding: 0,
  },
  editIcon: {
    fontSize: '0.9rem',
    color: theme.palette.text.secondary,
  },
}))

// The open displays of `trackId` in the track list this selector is attached
// to. Session-default effects are read from live display models (not track
// config) so the resolution can't drift; a closed track has no display and so
// no badge.
function openDisplays(model: HierarchicalTrackSelectorModel, trackId: string) {
  const track = model.trackContainer?.tracks.find(
    t => t.configuration.trackId === trackId,
  )
  return track?.displays ?? []
}

// shown when a track's effective settings differ from its configured defaults,
// for either reason: a per-track config edit shadowing an admin track (see
// session.getTrackConfigChanges / updateTrackConfiguration) or a session-wide
// pin the user promoted. One pencil marks both; the tooltip and
// the dialog it opens name the actual source (and its reset) in words.
const OpenTrackBadge = observer(function OpenTrackBadge({
  model,
  trackId,
  name,
  displays,
}: {
  model: HierarchicalTrackSelectorModel
  trackId: string
  name: string
  displays: ResolvableDisplay[]
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { getTrackConfigChanges, resetTrackConfiguration } = session
  const changes = getTrackConfigChanges?.(trackId) ?? []
  const onReset = resetTrackConfiguration
    ? () => {
        resetTrackConfiguration(trackId)
      }
    : undefined

  // read straight off the cascade rather than through a per-display MST hook:
  // both functions are total (a schema with no promotable slot yields no changes
  // and clears nothing), so there is nothing to dispatch on and no display needs
  // to opt in
  const perDisplay = displays.map(display => ({
    display,
    changes: getDisplayTypeDefaultChanges(display),
  }))
  // Addressed by display type, the same shape `flattenTrackConfigDelta` gives
  // the "edited on this track" rows above — the two tables sit one under the
  // other in the dialog, and a bare slot name in one of them reads as a
  // different kind of setting. It is also what keeps the rows apart:
  // `SettingsChangesTable` keys on the joined path, and the cascade's own paths
  // are one segment long, so a track holding two displays that share a slot
  // name (`showLegend`, `heightMode`) hands React two identical keys.
  const displayTypeDefaults = perDisplay.flatMap(({ display, changes }) =>
    changes.map(c => ({ ...c, path: [display.type, ...c.path] })),
  )
  // clear exactly the slots the dialog listed, keeping the button's blast radius
  // equal to what the user is looking at — a promoted default this track
  // customized over, or one equal to the base, appears in no row yet still
  // governs sibling tracks
  const onClearDefaults = () => {
    for (const { display, changes } of perDisplay) {
      clearPromotedDefaults(
        display,
        changes.map(c => c.path[0]!),
      )
    }
  }

  const edited = changes.length > 0
  const affectedByDefault = displayTypeDefaults.length > 0
  if (!edited && !affectedByDefault) {
    return null
  }
  // Prefer the "edited" pencil when a real per-track edit exists; otherwise the
  // track is affected only by a session default.
  const title = edited
    ? 'Edited — click to view the changed settings'
    : 'Affected by a session-wide default — click to view'
  return (
    <Tooltip title={title}>
      <IconButton
        className={classes.editButton}
        data-testid={
          edited ? 'track_edited_badge' : 'track_session_default_badge'
        }
        onClick={() => {
          session.queueDialog(handleClose => [
            TrackSettingsChangesDialog,
            {
              changes,
              displayTypeDefaults,
              trackName: name,
              onReset,
              onClearDefaults,
              handleClose,
            },
          ])
        }}
      >
        <EditIcon className={classes.editIcon} />
      </IconButton>
    </Tooltip>
  )
})

// Only a track that's currently shown can be badged: a closed track has no open
// display, so its edited/default state isn't visible anywhere to act on. The
// gate lives out here, ahead of OpenTrackBadge's cascade reads (a resolveSlot +
// deepEqual per promotable slot) — one badge renders per row of the tree, and
// most rows are closed tracks.
const OverrideBadge = observer(function OverrideBadge({
  model,
  trackId,
  name,
}: {
  model: HierarchicalTrackSelectorModel
  trackId: string
  name: string
}) {
  const displays = openDisplays(model, trackId)
  return displays.length > 0 ? (
    <OpenTrackBadge
      model={model}
      trackId={trackId}
      name={name}
      displays={displays}
    />
  ) : null
})

export default OverrideBadge
