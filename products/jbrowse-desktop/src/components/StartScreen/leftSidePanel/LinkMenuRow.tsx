import { ActionLink, CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

import type { MenuItem } from '@jbrowse/core/ui'

// a long genome or session name used to wrap and leave the menu button alone on
// a line of its own; both callers already scroll this table horizontally
const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
  },
})

/** A table row with a clickable label link and a cascading context menu. */
export default function LinkMenuRow({
  label,
  onLinkClick,
  menuItems,
}: {
  label: string
  onLinkClick: () => void
  menuItems: MenuItem[]
}) {
  const { classes } = useStyles()

  return (
    <tr>
      <td className={classes.cell}>
        <ActionLink title={label} onClick={onLinkClick}>
          {label}
        </ActionLink>{' '}
        <CascadingMenuButton style={{ padding: 0 }} menuItems={menuItems}>
          <MoreHoriz />
        </CascadingMenuButton>
      </td>
    </tr>
  )
}
