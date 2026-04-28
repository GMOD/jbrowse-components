import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, FormControlLabel } from '@mui/material'
import { observer } from 'mobx-react'

import { isUnsupported } from '../util.ts'
import TrackSelectorTrackMenu from './TrackSelectorTrackMenu.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TreeTrackNode } from '../../types.ts'

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

const TrackLabel = observer(function TrackLabel({
  model,
  item,
  checked,
}: {
  model: HierarchicalTrackSelectorModel
  item: TreeTrackNode
  checked: boolean
}) {
  const { classes } = useStyles()
  const { id, name, conf, trackId, description } = item
  const selected = model.selectionSet.has(conf)

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
      <TrackSelectorTrackMenu model={model} id={id} conf={conf} />
    </>
  )
})

export default TrackLabel
