import React from 'react'
import { SvgIcon } from '@mui/material'
import type { SvgIconProps } from '@mui/material'

export function Curves(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        fill="currentColor"
        d="M16.5,21C13.5,21 12.31,16.76 11.05,12.28C10.14,9.04 9,5 7.5,5C4.11,5 4,11.93 4,12H2C2,11.63 2.06,3 7.5,3C10.5,3 11.71,7.25 12.97,11.74C13.83,14.8 15,19 16.5,19C19.94,19 20.03,12.07 20.03,12H22.03C22.03,12.37 21.97,21 16.5,21Z"
      />
    </SvgIcon>
  )
}

export function StraightLines(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        fill="currentColor"
        d="M22 12L17 22L7.1 6.04L4.24 12H2L7 2L16.9 17.96L19.76 12H22Z"
      />
    </SvgIcon>
  )
}
