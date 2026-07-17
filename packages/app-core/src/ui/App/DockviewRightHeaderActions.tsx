import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import TableRowsIcon from '@mui/icons-material/TableRows'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import { IconButton, Tooltip } from '@mui/material'

import { useDockview } from './DockviewContext.tsx'
import { rearrangePanelsWithDirection } from './dockviewUtils.ts'

import type { IDockviewHeaderActionsProps } from 'dockview-react'

const useStyles = makeStyles()(theme => ({
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
  },
  headerButton: {
    padding: 4,
    color: theme.palette.primary.contrastText,
  },
  headerIcon: {
    fontSize: 16,
  },
}))

export default function DockviewRightHeaderActions({
  containerApi,
  group,
}: IDockviewHeaderActionsProps) {
  const { classes } = useStyles()
  const { rearrangePanels } = useDockview()

  // Re-tile every panel after the first relative to it. 'within' stacks them
  // all into one tab group; 'right'/'below' lay them out side by side.
  const tile = (direction: 'right' | 'below' | 'within') => {
    rearrangePanels(api => {
      rearrangePanelsWithDirection(api, (idx, states) =>
        idx === 0 ? undefined : { referencePanel: states[0]!.id, direction },
      )
    })
  }

  // rearrangePanelsWithDirection no-ops below 2 panels, so cols is only used
  // when there are enough panels for the grid math to matter.
  const tileGrid = () => {
    rearrangePanels(api => {
      const cols = Math.ceil(Math.sqrt(api.panels.length))
      rearrangePanelsWithDirection(api, (idx, states) => {
        if (idx === 0) {
          return undefined
        }
        const col = idx % cols
        const row = Math.floor(idx / cols)
        return col === 0
          ? { referencePanel: states[(row - 1) * cols]!.id, direction: 'below' }
          : { referencePanel: states[idx - 1]!.id, direction: 'right' }
      })
    })
  }

  const showLayoutOptions = containerApi.panels.length > 1
  const showCloseGroup = containerApi.groups.length > 1

  return (
    <div className={classes.headerActions}>
      {showLayoutOptions && (
        <CascadingMenuButton
          menuItems={[
            {
              label: 'Global: change layout into set of tabs',
              icon: DynamicFeedIcon,
              onClick: () => {
                tile('within')
              },
            },
            {
              label: 'Global: tile horizontally',
              icon: ViewColumnIcon,
              onClick: () => {
                tile('right')
              },
            },
            {
              label: 'Global: tile vertically',
              icon: TableRowsIcon,
              onClick: () => {
                tile('below')
              },
            },
            {
              label: 'Global: tile grid',
              icon: ViewModuleIcon,
              onClick: tileGrid,
            },
          ]}
          size="small"
          className={classes.headerButton}
        >
          <MoreHorizIcon className={classes.headerIcon} />
        </CascadingMenuButton>
      )}
      {showCloseGroup && (
        <Tooltip title="Close group">
          <IconButton
            size="small"
            onClick={() => {
              group.api.close()
            }}
            className={classes.headerButton}
          >
            <CloseIcon className={classes.headerIcon} />
          </IconButton>
        </Tooltip>
      )}
    </div>
  )
}
