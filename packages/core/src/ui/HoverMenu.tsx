//  this code adapted from material-ui-popup-state by Andy Edwards, MIT license
//  https://github.com/jcoreio/material-ui-popup-state/blob/9dba66241a0c25b172c93ae7d9e45a9745f138e8/LICENSE.md

import { Menu } from '@mui/material'

import type { MenuProps } from '@mui/material'

function HoverMenu(props: MenuProps) {
  return (
    <Menu
      {...props}
      style={{
        pointerEvents: 'none',
        ...props.style,
      }}
      slotProps={{
        ...props.slotProps,
        paper: {
          style: { pointerEvents: 'auto' },
        },
      }}
    />
  )
}

export default HoverMenu
