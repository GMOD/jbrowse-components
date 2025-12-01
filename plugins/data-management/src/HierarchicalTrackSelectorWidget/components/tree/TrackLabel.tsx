import { memo } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { Checkbox, FormControlLabel, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { isUnsupported } from '../util'
import TrackLabelMenu from './TrackLabelMenu'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { TreeTrackNode } from '../../types'
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

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

// Small observer component that only re-renders when track visibility changes
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
  const checked = model.shownTrackIds.has(trackId)
  return (
    <Checkbox
      className={className}
      checked={checked}
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

// Small observer for selection state
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

// Memoized outer component - expensive MUI components don't re-render on track toggle
const TrackLabel = memo(function TrackLabel({
  model,
  item,
}: {
  model: HierarchicalTrackSelectorModel
  item: TreeTrackNode
}) {
  const { classes } = useStyles()
  const { drawerPosition } = getSession(model)
  const { id, name, conf } = item
  const trackId = readConfObject(conf, 'trackId')
  const description = readConfObject(conf, 'description')

  return (
    <>
      <Tooltip
        title={description}
        placement={drawerPosition === 'left' ? 'right' : 'left'}
      >
        <FormControlLabel
          className={classes.checkboxLabel}
          onClick={event => {
            if (event.ctrlKey || event.metaKey) {
              model.addToSelection([conf])
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
      </Tooltip>
      <TrackLabelMenu model={model} trackId={trackId} id={id} conf={conf} />
    </>
  )
})

export default TrackLabel
