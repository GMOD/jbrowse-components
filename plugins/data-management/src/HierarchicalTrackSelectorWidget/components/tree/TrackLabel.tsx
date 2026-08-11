import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material/styles'
import { observer } from 'mobx-react'

import { isUnsupported } from '../../util.ts'
import CheckboxLite from './CheckboxLite.tsx'
import OverrideBadge from './OverrideBadge.tsx'
import TrackSelectorTrackMenu from './TrackSelectorTrackMenu.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TrackRowAdornment } from '../../trackRowAdornment.ts'
import type { TreeTrackNode } from '../../types.ts'

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
    // shrinkable, so the name inside can ellipsise rather than the row running
    // past the drawer and taking the adornment and the ... menu with it
    minWidth: 0,
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
    minWidth: 0,
  },
  // The name is what yields when the drawer is narrow: it shrinks and
  // ellipsises while the adornment beside it keeps its full width, because a
  // few words half-truncated ("vs pea") read as damage rather than as
  // information. Needs the whole flex chain above it to allow shrinking —
  // rowContent, the label, and this — since each one's automatic minimum size
  // would otherwise be its own content.
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  adornmentIcon: {
    color: theme.palette.primary.main,
    flex: 'none',
  },
  adornmentLabel: {
    color: theme.palette.text.secondary,
    flex: 'none',
    fontSize: '0.85em',
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
        if (model.trackContainer?.toggleTrack(trackId)) {
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
  id,
  name,
  trackId,
  adornment,
  selectedClass,
}: {
  model: HierarchicalTrackSelectorModel
  id: string
  name: string
  trackId: string
  adornment?: TrackRowAdornment
  selectedClass: string
}) {
  const { classes } = useStyles()
  const selected = model.selectionSet.has(trackId)
  const AdornmentIcon = adornment?.icon
  return (
    <div
      data-testid={`htsTrackLabel-${id}`}
      className={`${classes.label} ${selected ? selectedClass : ''}`}
    >
      {/* fontSize inherit, not a class: MUI's default 20px icon would push the
      22px row taller, and the prop settles that without depending on which of
      two stylesheets was injected last */}
      {AdornmentIcon ? (
        <AdornmentIcon fontSize="inherit" className={classes.adornmentIcon} />
      ) : null}
      <span className={classes.name}>
        <SanitizedHTML html={name} />
      </span>
      {adornment?.label ? (
        <span
          className={classes.adornmentLabel}
          data-testid={`htsTrackAdornment-${id}`}
        >
          {adornment.label}
        </span>
      ) : null}
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
  const { id, name, conf, trackId, description, adornment } = item
  // one string, because the tree shares a single tooltip element keyed off this
  // attribute (SharedTooltip)
  const tooltip = [description, adornment?.detail].filter(Boolean).join(' — ')

  return (
    <>
      <label
        className={classes.checkboxLabel}
        data-tooltip={tooltip}
        aria-description={tooltip}
        onClick={event => {
          if (event.ctrlKey || event.metaKey) {
            if (model.selectionSet.has(trackId)) {
              model.removeFromSelection([trackId])
            } else {
              model.addToSelection([trackId])
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
          id={id}
          name={name}
          trackId={trackId}
          adornment={adornment}
          selectedClass={classes.selected}
        />
      </label>
      <TrackSelectorTrackMenu model={model} id={id} conf={conf} />
    </>
  )
})

export default TrackLabel
