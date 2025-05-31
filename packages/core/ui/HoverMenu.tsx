//  this code adapted from material-ui-popup-state by Andy Edwards, MIT license
//  https://github.com/jcoreio/material-ui-popup-state/blob/9dba66241a0c25b172c93ae7d9e45a9745f138e8/LICENSE.md

import * as React from 'react'

import { Menu } from '@mui/material'

import type { MenuProps } from '@mui/material'

const HoverMenu: React.ComponentType<MenuProps> = React.forwardRef(
  function HoverMenu(props: MenuProps, ref): any {
    const paperSlotProps = React.useMemo(() => {
      const wrapped = props.slotProps?.paper
      if (typeof wrapped === 'function') {
        return (ownerProps: Parameters<typeof wrapped>[0]) => {
          const base = wrapped(ownerProps)
          return {
            ...base,
            style: {
              pointerEvents: 'auto',
              ...base.style,
            },
          } as const
        }
      }
      return {
        ...wrapped,
        style: { pointerEvents: 'auto', ...wrapped?.style },
      } as const
    }, [props.slotProps?.paper])

    return (
      <Menu
        {...props}
        ref={ref}
        style={{ pointerEvents: 'none', ...props.style }}
        slotProps={{
          ...props.slotProps,
          paper: paperSlotProps,
        }}
      />
    )
  },
)

export default HoverMenu
