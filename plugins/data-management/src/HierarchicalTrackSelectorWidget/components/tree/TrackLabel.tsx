import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material/styles'
import { observer } from 'mobx-react'

import { isUnsupported } from '../../util.ts'
import CheckboxLite from './CheckboxLite.tsx'
import OverrideBadge from './OverrideBadge.tsx'
import TrackSelectorTrackMenu from './TrackSelectorTrackMenu.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TreeTrackNode } from '../../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// checkboxLabel merges MUI FormControlLabel's root styles, so the row renders a
// plain <label> instead of mounting FormControlLabel + its Typography wrapper
// once per virtualized row. marginLeft -11 is MUI's own offset, kept so track
// rows keep aligning with their parent category
const useStyles = makeStyles()(theme => ({
  compactCheckbox: {
    padding: 0,
  },
  checkboxLabel: {
    // FormControlLabel wrapped the label text in a body1 <Typography>; restated
    // here rather than left to inherit, so dropping that wrapper can't change
    // the row's type
    fontFamily: theme.typography.body1.fontFamily,
    fontWeight: theme.typography.body1.fontWeight,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    letterSpacing: theme.typography.body1.letterSpacing,
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    verticalAlign: 'middle',
    WebkitTapHighlightColor: 'transparent',
    marginLeft: -11,
    marginRight: 0,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  selected: {
    // stronger than the hover tint (action.selected), which this would
    // otherwise be indistinguishable from, and readable in both modes
    background: alpha(
      theme.palette.primary.main,
      theme.palette.action.selectedOpacity * 4,
    ),
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
}))

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
    <CheckboxLite
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
      <OverrideBadge model={model} trackId={trackId} name={name} />
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
      <label
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
      >
        <TrackCheckbox
          model={model}
          trackId={trackId}
          disabled={isUnsupported(name)}
          className={classes.compactCheckbox}
        />
        <TrackLabelText
          model={model}
          conf={conf}
          id={id}
          name={name}
          trackId={trackId}
          selectedClass={classes.selected}
        />
      </label>
      <TrackSelectorTrackMenu model={model} id={id} conf={conf} />
    </>
  )
})

export default TrackLabel
