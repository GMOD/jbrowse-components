import DropDownMenu from '@jbrowse/core/ui/DropDownMenu'
import { AppBar, Toolbar } from '@mui/material'
import { observer } from 'mobx-react'

import type { ViewModel } from '../createModel/createModel.ts'

/**
 * The app-shaped menu bar, for parity with `@jbrowse/react-app`: a bare view
 * title with nothing but a hamburger on it reads as unfinished next to one.
 *
 * `dense`, unlike the app's, because this bar spends a bounded embed's height
 * rather than a page's: 48px of a 400px box is enough to give up without
 * spending the app's 64.
 *
 * It renders nothing when there are no menus, which is what `disableAddTracks`
 * leaves behind -- a File menu whose every item is refused by the session
 * guards is worse than no bar at all.
 */
const EmbeddedAppBar = observer(function EmbeddedAppBar({
  viewState,
}: {
  viewState: ViewModel
}) {
  const menus = viewState.menus()
  return menus.length ? (
    <AppBar position="static" style={{ gridColumn: '1 / -1' }}>
      <Toolbar variant="dense" disableGutters>
        {menus.map(menu => (
          <DropDownMenu
            key={menu.label}
            menuTitle={menu.label}
            menuItems={menu.menuItems}
            // the root model's menu items take the session as their argument,
            // same binding the app's toolbar makes
            onMenuItemClick={callback => {
              callback(viewState.session)
            }}
          />
        ))}
      </Toolbar>
    </AppBar>
  ) : null
})

export default EmbeddedAppBar
