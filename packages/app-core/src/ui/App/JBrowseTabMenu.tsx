import { useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'

const useStyles = makeStyles()({
  // hidden until the tab is hovered or focused, by a rule in `TabStrip` keyed
  // on the `jbrowse-tab-menu` class — hence the plain class name beside the
  // generated one. `visibility` rather than `display`, so the tab does not
  // change width under the pointer as it arrives.
  tabIcons: {
    display: 'flex',
    alignItems: 'center',
    visibility: 'hidden',
  },
  // the pointer is over the menu, not the tab, for as long as the menu is open,
  // so the hover rule stops applying the moment it opens — leaving the popover
  // anchored to an invisible button
  open: {
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
  onRename,
  onClose,
}: {
  onRename: () => void
  onClose: () => void
}) {
  const { classes, cx } = useStyles()
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cx('jbrowse-tab-menu', classes.tabIcons, open && classes.open)}
      // The tab strip starts a tab drag on pointerdown and takes POINTER
      // CAPTURE for it, and a captured pointer retargets the compatibility
      // mouse events with it — so `click` is delivered to the tab rather than
      // to this button, and the menu silently never opens. Stopping the
      // pointerdown here means a press that starts on the menu is not a drag
      // and never captures, which is the same reason the rename input in
      // `WorkspaceTab` stops it.
      onPointerDown={event => {
        event.stopPropagation()
      }}
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
        setOpen={setOpen}
        stopPropagation
      >
        <MoreVertIcon className={classes.smallIcon} />
      </CascadingMenuButton>
    </div>
  )
}
