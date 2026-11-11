import MenuIcon from '@mui/icons-material/Menu'
import { observer } from 'mobx-react'

import CascadingMenuButton from './CascadingMenuButton.tsx'

import type { MenuItemsGetter } from './CascadingMenu.tsx'

const ViewMenuButton = observer(function ViewMenuButton({
  menuItems,
  className,
}: {
  menuItems: MenuItemsGetter
  className?: string
}) {
  return (
    <CascadingMenuButton
      data-testid="view_menu_icon"
      tooltip="View menu"
      menuItems={menuItems}
    >
      <MenuIcon className={className} fontSize="small" />
    </CascadingMenuButton>
  )
})

export default ViewMenuButton
