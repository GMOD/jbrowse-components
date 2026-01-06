import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit'
import TabIcon from '@mui/icons-material/Tab'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'

import { useDockview } from './DockviewContext.tsx'

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

export default function DockviewLeftHeaderActions({
  containerApi,
  group,
}: IDockviewHeaderActionsProps) {
  const { classes } = useStyles()
  const { addEmptyTab } = useDockview()

  const handleSplit = (direction: 'right' | 'below') => {
    const newGroup = containerApi.addGroup({
      referenceGroup: group,
      direction,
    })
    addEmptyTab(newGroup)
  }

  return (
    <div className={classes.headerActions}>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'New empty tab',
            icon: TabIcon,
            onClick: () => {
              addEmptyTab()
            },
          },
          {
            label: 'New empty split horizontal',
            icon: VerticalSplitIcon,
            onClick: () => {
              handleSplit('right')
            },
          },
          {
            label: 'New empty split vertical',
            icon: HorizontalSplitIcon,
            onClick: () => {
              handleSplit('below')
            },
          },
        ]}
        size="small"
        className={classes.headerButton}
        onClick={() => {
          group.api.setActive()
        }}
      >
        <AddIcon className={classes.headerIcon} />
      </CascadingMenuButton>
    </div>
  )
}
