//  this code adapted from material-ui-popup-state by Andy Edwards, MIT license
//  https://github.com/jcoreio/material-ui-popup-state/blob/9dba66241a0c25b172c93ae7d9e45a9745f138e8/LICENSE.md

import * as React from 'react'

import { Menu } from '@mui/material'

import type { MenuProps } from '@mui/material'

const HoverMenu: React.ComponentType<MenuProps> = React.forwardRef(
  function HoverMenu(props: MenuProps, ref): any {
    return (
      <Menu
        {...props}
        ref={ref}
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
  },
)

export default HoverMenu
