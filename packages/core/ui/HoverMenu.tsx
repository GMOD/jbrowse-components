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
        PaperProps={{
          ...props.PaperProps,
          style: {
            pointerEvents: 'auto',
            ...props.PaperProps?.style,
          },
        }}
        slotProps={{
          ...props.slotProps,
          paper: paperSlotProps,
        }}
      />
    )
  },
)

export default HoverMenu
