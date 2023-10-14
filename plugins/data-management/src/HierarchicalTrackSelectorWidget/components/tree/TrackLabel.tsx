import React from 'react'
import { Checkbox, FormControlLabel, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

// icons
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'

// locals
import { isUnsupported, NodeData } from '../util'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { HierarchicalTrackSelectorModel } from '../../model'

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
}))

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

export default function TrackLabel({ data }: { data: NodeData }) {
  const { classes } = useStyles()
  const { checked, conf, model, drawerPosition, id, name, onChange, selected } =
    data
  const description = (conf && readConfObject(conf, ['description'])) || ''
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
              onChange={() => onChange(id)}
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
      <TrackMenuButton model={model} selected={selected} id={id} conf={conf} />
    </>
  )
}

function TrackMenuButton({
  id,
  model,
  selected,
  conf,
}: {
  id: string
  selected: boolean
  conf: AnyConfigurationModel
  model: HierarchicalTrackSelectorModel
}) {
  return (
    <CascadingMenuButton
      style={{ padding: 0 }}
      data-testid={`htsTrackEntryMenu-${id}`}
      menuItems={[
        ...(getSession(model).getTrackActionMenuItems?.(conf) || []),
        {
          label: 'Add to selection',
          onClick: () => model.addToSelection([conf]),
        },
        ...(selected
          ? [
              {
                label: 'Remove from selection',
                onClick: () => model.removeFromSelection([conf]),
              },
            ]
          : []),
      ]}
    >
      <MoreHorizIcon />
    </CascadingMenuButton>
  )
}
