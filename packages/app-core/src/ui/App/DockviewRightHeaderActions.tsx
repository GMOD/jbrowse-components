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

  const tileHorizontally = () => {
    rearrangePanels(api => {
      rearrangePanelsWithDirection(api, (idx, states) =>
        idx === 0
          ? undefined
          : { referencePanel: states[0]!.id, direction: 'right' },
      )
    })
  }

  const tileVertically = () => {
    rearrangePanels(api => {
      rearrangePanelsWithDirection(api, (idx, states) =>
        idx === 0
          ? undefined
          : { referencePanel: states[0]!.id, direction: 'below' },
      )
    })
  }

  const tileGrid = () => {
    rearrangePanels(api => {
      const panels = api.panels
      if (panels.length <= 1) {
        return
      }
      const cols = Math.ceil(Math.sqrt(panels.length))
      rearrangePanelsWithDirection(api, (idx, states) => {
        if (idx === 0) {
          return undefined
        }
        const col = idx % cols
        const row = Math.floor(idx / cols)
        if (col === 0) {
          const refIdx = (row - 1) * cols
          return { referencePanel: states[refIdx]!.id, direction: 'below' }
        }
        return { referencePanel: states[idx - 1]!.id, direction: 'right' }
      })
    })
  }

  const stackAll = () => {
    rearrangePanels(api => {
      rearrangePanelsWithDirection(api, (idx, states) =>
        idx === 0
          ? undefined
          : { referencePanel: states[0]!.id, direction: 'within' },
      )
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
              onClick: stackAll,
            },
            {
              label: 'Global: tile horizontally',
              icon: ViewColumnIcon,
              onClick: tileHorizontally,
            },
            {
              label: 'Global: tile vertically',
              icon: TableRowsIcon,
              onClick: tileVertically,
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
              for (const panel of group.panels) {
                panel.api.close()
              }
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
