import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import SubmitDialog from '@jbrowse/core/ui/SubmitDialog'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { Typography } from '@mui/material'

import type React from 'react'

/**
 * Color by's Solid color... picker: `label`'s colour, with `children` as the
 * display's further pickers, and a note where the colour object holds an
 * expression a pick would replace.
 */
export default function SolidColorDialog({
  label,
  color,
  written,
  onChange,
  onReset,
  handleClose,
  children,
}: {
  label: string
  color: string
  written: string | undefined
  onChange: (color: string) => void
  onReset: () => void
  handleClose: () => void
  children?: React.ReactNode
}) {
  return (
    <SubmitDialog
      open
      title="Set colors"
      submitText="Close"
      onCancel={handleClose}
      onSubmit={handleClose}
      onReset={onReset}
    >
      <Typography>{label}</Typography>
      {written !== undefined && isJexl(written) ? (
        <Typography variant="body2" color="textSecondary">
          Picking a color replaces the track&apos;s expression{' '}
          <code>{written}</code>
        </Typography>
      ) : null}
      <ColorPicker color={color} onChange={onChange} />
      {children}
    </SubmitDialog>
  )
}
