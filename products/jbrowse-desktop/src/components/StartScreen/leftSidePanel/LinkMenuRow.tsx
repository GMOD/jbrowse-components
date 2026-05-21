import { ActionLink, CascadingMenuButton } from '@jbrowse/core/ui'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

import type { MenuItem } from '@jbrowse/core/ui'

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
  return (
    <tr>
      <td>
        <ActionLink onClick={onLinkClick}>{label}</ActionLink>{' '}
        <CascadingMenuButton style={{ padding: 0 }} menuItems={menuItems}>
          <MoreHoriz />
        </CascadingMenuButton>
      </td>
    </tr>
  )
}
