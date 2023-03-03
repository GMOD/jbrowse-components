import React, { useState } from 'react'
import { Checkbox, FormControlLabel, IconButton, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import { getSession } from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

// icons
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'

// locals
import { isUnsupported, NodeData } from '../util'
import { SanitizedHTML } from '@jbrowse/core/ui'

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
  const [info, setInfo] = useState<InfoArgs>()
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
            <div style={{ background: selected ? '#cccc' : undefined }}>
              <SanitizedHTML html={name} />
            </div>
          }
        />
      </Tooltip>
      <IconButton
        onClick={e => setInfo({ target: e.currentTarget, id, conf })}
        style={{ padding: 0 }}
        data-testid={`htsTrackEntryMenu-${id}`}
      >
        <MoreHorizIcon />
      </IconButton>

      {info ? (
        <JBrowseMenu
          anchorEl={info?.target}
          menuItems={[
            ...(getSession(model).getTrackActionMenuItems?.(info.conf) || []),
            {
              label: 'Add to selection',
              onClick: () => model.addToSelection([info.conf]),
            },
            ...(selected
              ? [
                  {
                    label: 'Remove from selection',
                    onClick: () => model.removeFromSelection([info.conf]),
                  },
                ]
              : []),
          ]}
          onMenuItemClick={(_event, callback) => {
            callback()
            setInfo(undefined)
          }}
          open={Boolean(info)}
          onClose={() => setInfo(undefined)}
        />
      ) : null}
    </>
  )
}
