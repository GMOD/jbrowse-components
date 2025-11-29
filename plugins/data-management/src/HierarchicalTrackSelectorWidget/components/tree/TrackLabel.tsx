import { readConfObject } from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { Checkbox, FormControlLabel, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

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

const TrackLabel = observer(function TrackLabel({
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
  const selected = model.selectionSet.has(trackId)
  const checked = model.shownTrackIds.has(trackId)
  console.log('here abel')
  return (
    <>
      <Tooltip
        title={description + (selected ? ' (in selection)' : '')}
        placement={drawerPosition === 'left' ? 'right' : 'left'}
      >
        <FormControlLabel
          className={classes.checkboxLabel}
          onClick={event => {
            if (event.ctrlKey || event.metaKey) {
              if (selected) {
                model.removeFromSelection([conf])
              } else {
                model.addToSelection([conf])
              }
              event.preventDefault()
            }
          }}
          control={
            <Checkbox
              className={classes.compactCheckbox}
              checked={checked}
              onChange={() => {
                model.view.toggleTrack(trackId)
              }}
              disabled={isUnsupported(name)}
              slotProps={{
                input: {
                  // @ts-expect-error
                  'data-testid': `htsTrackEntry-${id}`,
                },
              }}
            />
          }
          label={
            <div
              data-testid={`htsTrackLabel-${id}`}
              className={selected ? classes.selected : undefined}
            >
              <SanitizedHTML html={name} />
            </div>
          }
        />
      </Tooltip>
      <TrackLabelMenu model={model} trackId={trackId} id={id} conf={conf} />
    </>
  )
})

export default TrackLabel
