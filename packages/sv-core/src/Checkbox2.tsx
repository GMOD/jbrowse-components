import React from 'react'

import { Checkbox, FormControlLabel } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  block: {
    display: 'block',
  },
})

export default function Checkbox2({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const { classes } = useStyles()
  return (
    <FormControlLabel
      disabled={disabled}
      className={classes.block}
      control={<Checkbox checked={checked} onChange={onChange} />}
      label={label}
    />
  )
}
