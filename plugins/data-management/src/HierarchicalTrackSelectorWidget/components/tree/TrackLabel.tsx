import { memo, useCallback } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, FormControlLabel, Tooltip } from '@mui/material'
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

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

// Memoized checkbox - only re-renders when checked state changes
const TrackCheckbox = memo(function TrackCheckbox({
  checked,
  onChange,
  id,
  disabled,
  className,
}: {
  checked: boolean
  onChange: () => void
  id: string
  disabled: boolean
  className: string
}) {
  return (
    <Checkbox
      className={className}
      checked={checked}
      onChange={onChange}
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

// Memoized component - receives checked from parent to avoid observing shownTrackIds
const TrackLabel = memo(function TrackLabel({
  model,
  item,
  checked,
}: {
  model: HierarchicalTrackSelectorModel
  item: TreeTrackNode
  checked: boolean
}) {
  const { classes } = useStyles()
  const { drawerPosition } = getSession(model)
  const { id, name, conf, trackId } = item
  const description = readConfObject(conf, 'description')
  const onChange = useCallback(() => {
    model.view.toggleTrack(trackId)
  }, [model.view, trackId])

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
              checked={checked}
              onChange={onChange}
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
      <TrackSelectorTrackMenu model={model} id={id} conf={conf} />
    </>
  )
})

export default TrackLabel
