import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TRACK_MENU_PRIORITY, subMenuIfAny } from '@jbrowse/core/ui/menuItems'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import LowPriorityIcon from '@mui/icons-material/LowPriority'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import { containingLgv } from '../../LinearGenomeView/containingLgv.ts'
import { getTrackOrderSubMenu } from './trackLabelMenuItems.ts'

import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { MenuItem } from '@jbrowse/core/ui'

// IconButton's default 5px padding made this the tallest thing in the label
// (27px), so it, not the text or the other controls, set the label height and
// hence the offset the track body gets. 3px trims the label to 23px while
// keeping a hit area past the 17px icon; 2px reads as too compact.
const useStyles = makeStyles()({
  menuButton: {
    padding: 3,
  },
})

const TrackLabelMenu = observer(function TrackLabelMenu({
  track,
}: {
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const view = containingLgv(track)
  const session = getSession(track)

  function getMenuItems(): MenuItem[] {
    const orderSubMenu = getTrackOrderSubMenu({ view, track })
    const sessionItems =
      session.getTrackActionMenuItems?.({
        config: track.configuration,
        view,
      }) ?? []

    return [
      ...subMenuIfAny({
        label: 'Track order',
        icon: LowPriorityIcon,
        priority: TRACK_MENU_PRIORITY.trackOrder,
        subMenu: orderSubMenu,
      }),
      ...sessionItems,
      track.saveTrackDataMenuItem,
      ...track.trackMenuItems(),
    ]
  }

  return (
    <CascadingMenuButton
      menuItems={getMenuItems}
      className={classes.menuButton}
      data-testid="track_menu_icon"
      data-trackid={track.trackId}
      tooltip="Track settings"
    >
      <MoreVertIcon fontSize="small" />
    </CascadingMenuButton>
  )
})

export default TrackLabelMenu
