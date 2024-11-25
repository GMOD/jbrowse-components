import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { Checkbox, FormControlLabel, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
// locals
import { isUnsupported } from '../util'
import TrackLabelMenu from './TrackLabelMenu'
import type { NodeData } from '../util'
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

export default function TrackLabel({ data }: { data: NodeData }) {
  const { classes } = useStyles()
  const {
    checked,
    conf,
    model,
    drawerPosition,
    id,
    trackId,
    name,
    onChange,
    selected,
  } = data
  const description = readConfObject(conf, 'description')
  return (
    <>
      <Tooltip
        title={description + (selected ? ' (in selection)' : '')}
        placement={drawerPosition === 'left' ? 'right' : 'left'}
      >
        <FormControlLabel
          className={classes.checkboxLabel}
          control={
            <Checkbox
              className={classes.compactCheckbox}
              checked={checked}
              onChange={() => {
                onChange(trackId)
              }}
              disabled={isUnsupported(name)}
              inputProps={{
                // @ts-expect-error
                'data-testid': `htsTrackEntry-${id}`,
              }}
            />
          }
          label={
            <div
              data-testid={`htsTrackLabel-${id}`}
              style={{ background: selected ? '#cccc' : undefined }}
            >
              <SanitizedHTML html={name} />
            </div>
          }
        />
      </Tooltip>
      <TrackLabelMenu model={model} trackId={trackId} id={id} conf={conf} />
    </>
  )
}
