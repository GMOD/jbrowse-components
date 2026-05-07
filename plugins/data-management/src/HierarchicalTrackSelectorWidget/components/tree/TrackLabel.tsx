import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, FormControlLabel } from '@mui/material'
import { observer } from 'mobx-react'

import { isUnsupported } from '../util.ts'
import TrackSelectorTrackMenu from './TrackSelectorTrackMenu.tsx'

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
}))

// Separate observer so only this checkbox re-renders when a track is toggled
const TrackCheckbox = observer(function TrackCheckbox({
  model,
  trackId,
  id,
  disabled,
  className,
}: {
  model: HierarchicalTrackSelectorModel
  trackId: string
  id: string
  disabled: boolean
  className: string
}) {
  return (
    <Checkbox
      className={className}
      checked={model.shownTrackIds.has(trackId)}
      onChange={() => {
        model.view.toggleTrack(trackId)
      }}
      disabled={disabled}
      slotProps={{
        input: {
          // @ts-expect-error
          'data-testid': `htsTrackEntry-${id}`,
        },
      }}
    />
  )
})

// Separate observer so only this label re-renders when selection changes
const TrackLabelText = observer(function TrackLabelText({
  model,
  conf,
  id,
  name,
  selectedClass,
}: {
  model: HierarchicalTrackSelectorModel
  conf: AnyConfigurationModel
  id: string
  name: string
  selectedClass: string
}) {
  const selected = model.selectionSet.has(conf)
  return (
    <div
      data-testid={`htsTrackLabel-${id}`}
      className={selected ? selectedClass : undefined}
    >
      <SanitizedHTML html={name} />
    </div>
  )
})

function TrackLabel({
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
        data-tooltip={description || undefined}
        aria-description={description || undefined}
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
            id={id}
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
            selectedClass={classes.selected}
          />
        }
      />
      <TrackSelectorTrackMenu model={model} id={id} conf={conf} />
    </>
  )
}

export default TrackLabel
