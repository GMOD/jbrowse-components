import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import EditIcon from '@mui/icons-material/Edit'
import { Checkbox, FormControlLabel, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import TrackSelectorTrackMenu from './TrackSelectorTrackMenu.tsx'
import { isUnsupported } from '../../util.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TreeTrackNode } from '../../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()(theme => ({
  compactCheckbox: {
    padding: 0,
  },
  checkboxLabel: {
    marginRight: 0,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  selected: {
    background: '#cccc',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  editIcon: {
    fontSize: '0.9rem',
    color: theme.palette.text.secondary,
  },
}))

// shown when a track carries session-track config edits that shadow the
// admin-owned config track (see session.isTrackOverride / updateTrackConfiguration)
const OverrideBadge = observer(function OverrideBadge({
  model,
  trackId,
}: {
  model: HierarchicalTrackSelectorModel
  trackId: string
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const isOverride =
    'isTrackOverride' in session &&
    (session.isTrackOverride as (id: string) => boolean)(trackId)
  return isOverride ? (
    <Tooltip title="Edited — settings differ from the default. Use 'Reset track settings' to revert.">
      <EditIcon className={classes.editIcon} />
    </Tooltip>
  ) : null
})

// Separate observer so only this checkbox re-renders when a track is toggled
const TrackCheckbox = observer(function TrackCheckbox({
  model,
  trackId,
  disabled,
  className,
}: {
  model: HierarchicalTrackSelectorModel
  trackId: string
  disabled: boolean
  className: string
}) {
  return (
    <Checkbox
      className={className}
      checked={model.shownTrackIds.has(trackId)}
      onChange={() => {
        if (model.view.toggleTrack(trackId)) {
          model.addToRecentlyUsed(trackId)
        }
      }}
      disabled={disabled}
    />
  )
})

// Separate observer so only this label re-renders when selection changes
const TrackLabelText = observer(function TrackLabelText({
  model,
  conf,
  id,
  name,
  trackId,
  selectedClass,
}: {
  model: HierarchicalTrackSelectorModel
  conf: AnyConfigurationModel
  id: string
  name: string
  trackId: string
  selectedClass: string
}) {
  const { classes } = useStyles()
  const selected = model.selectionSet.has(conf)
  return (
    <div
      data-testid={`htsTrackLabel-${id}`}
      className={`${classes.label} ${selected ? selectedClass : ''}`}
    >
      <SanitizedHTML html={name} />
      <OverrideBadge model={model} trackId={trackId} />
    </div>
  )
})

const TrackLabel = observer(function TrackLabel({
  model,
  item,
}: {
  model: HierarchicalTrackSelectorModel
  item: TreeTrackNode
}) {
  const { classes } = useStyles()
  const { id, name, conf, trackId, description } = item

  return (
    <>
      <FormControlLabel
        className={classes.checkboxLabel}
        data-tooltip={description}
        aria-description={description}
        onClick={event => {
          if (event.ctrlKey || event.metaKey) {
            if (model.selectionSet.has(conf)) {
              model.removeFromSelection([conf])
            } else {
              model.addToSelection([conf])
            }
            event.preventDefault()
          }
        }}
        control={
          <TrackCheckbox
            model={model}
            trackId={trackId}
            disabled={isUnsupported(name)}
            className={classes.compactCheckbox}
          />
        }
        label={
          <TrackLabelText
            model={model}
            conf={conf}
            id={id}
            name={name}
            trackId={trackId}
            selectedClass={classes.selected}
          />
        }
      />
      <TrackSelectorTrackMenu model={model} id={id} conf={conf} />
    </>
  )
})

export default TrackLabel
