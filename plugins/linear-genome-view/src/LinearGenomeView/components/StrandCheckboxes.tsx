import { LabeledCheckbox } from '@jbrowse/core/ui'
import { FormGroup, Typography } from '@mui/material'

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
        <LabeledCheckbox
          size="small"
          checked={searchForward}
          onChange={val => {
            setSearchForward(val)
          }}
          label="Forward strand"
        />
        <LabeledCheckbox
          size="small"
          checked={searchReverse}
          onChange={val => {
            setSearchReverse(val)
          }}
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
