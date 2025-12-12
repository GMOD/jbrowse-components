import React, { memo, useCallback, useMemo } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { Checkbox, FormControlLabel, Tooltip } from '../../../vendoredMUI'
import { isUnsupported } from '../util'
import TrackSelectorTrackMenu from './TrackSelectorTrackMenu'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { TreeTrackNode } from '../../types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// Check if string might contain HTML (quick check for < character)
function mightContainHTML(str: string) {
  return str.includes('<')
}

// Optimized text renderer - only uses SanitizedHTML if HTML might be present
const OptimizedText = memo(function OptimizedText({ text }: { text: string }) {
  if (mightContainHTML(text)) {
    return <SanitizedHTML html={text} />
  }
  return <>{text}</>
})

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
      <OptimizedText text={name} />
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
  const { id, name, conf, trackId } = item
  const description = useMemo(() => readConfObject(conf, 'description'), [conf])
  const onChange = useCallback(() => {
    model.view.toggleTrack(trackId)
  }, [model.view, trackId])

  return (
    <>
      <Tooltip title={description}>
        <FormControlLabel
          className={classes.checkboxLabel}
          onClick={(event: React.MouseEvent) => {
            if (event.ctrlKey || event.metaKey) {
              model.addToSelection([conf])
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
      <TrackSelectorTrackMenu
        model={model}
        trackId={trackId}
        id={id}
        conf={conf}
      />
    </>
  )
})

export default TrackLabel
