import {
  Checkbox,
  FormControlLabel,
  FormGroup,
  Typography,
} from '@mui/material'

import type { ReactNode } from 'react'

// Forward/reverse strand checkboxes plus the "select at least one" guard, shared
// by the sequence-search mode panels. Extra checkboxes for a specific panel (e.g.
// "Case insensitive") slot in alongside via `children`.
export default function StrandCheckboxes({
  searchForward,
  searchReverse,
  setSearchForward,
  setSearchReverse,
  children,
}: {
  searchForward: boolean
  searchReverse: boolean
  setSearchForward: (arg: boolean) => void
  setSearchReverse: (arg: boolean) => void
  children?: ReactNode
}) {
  return (
    <>
      <FormGroup row>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={searchForward}
              onChange={event => {
                setSearchForward(event.target.checked)
              }}
            />
          }
          label="Forward strand"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={searchReverse}
              onChange={event => {
                setSearchReverse(event.target.checked)
              }}
            />
          }
          label="Reverse strand"
        />
        {children}
      </FormGroup>
      {!searchForward && !searchReverse ? (
        <Typography color="error" variant="body2">
          Select at least one strand
        </Typography>
      ) : null}
    </>
  )
}
