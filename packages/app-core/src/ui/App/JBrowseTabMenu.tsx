import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'

const useStyles = makeStyles()({
  tabIcons: {
    display: 'flex',
    alignItems: 'center',
    visibility: 'hidden',
  },
  tabIconsVisible: {
    visibility: 'visible',
  },
  tabIcon: {
    padding: 2,
    marginLeft: 2,
    color: 'inherit',
  },
  smallIcon: {
    fontSize: 14,
  },
})

export default function JBrowseTabMenu({
  isHovered,
  onRename,
  onClose,
}: {
  isHovered: boolean
  onRename: () => void
  onClose: () => void
}) {
  const { classes } = useStyles()

  return (
    <div
      className={`${classes.tabIcons} ${isHovered ? classes.tabIconsVisible : ''}`}
    >
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Rename tab',
            icon: EditIcon,
            onClick: onRename,
          },
          {
            label: 'Close tab',
            icon: CloseIcon,
            onClick: onClose,
          },
        ]}
        size="small"
        className={classes.tabIcon}
        stopPropagation
      >
        <MoreVertIcon className={classes.smallIcon} />
      </CascadingMenuButton>
    </div>
  )
}
