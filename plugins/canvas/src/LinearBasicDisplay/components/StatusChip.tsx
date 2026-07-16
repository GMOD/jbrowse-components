import type { MouseEvent, ReactElement } from 'react'

import { Chip, Tooltip } from '@mui/material'

// Shared look for every bottom-right status "blurb" (feature-count, isoform
// collapse, ...). One outlined MUI Chip so the indicators read as a single
// consistent system rather than a grab-bag of differently-styled widgets. An
// optional onClick makes the chip an action; an optional onDelete adds the (×).
export default function StatusChip({
  icon,
  label,
  tooltip,
  onClick,
  onDelete,
}: {
  icon: ReactElement
  label: string
  tooltip: string
  onClick?: (event: MouseEvent<HTMLElement>) => void
  onDelete?: () => void
}) {
  return (
    <Tooltip title={tooltip}>
      <Chip
        size="small"
        variant="outlined"
        icon={icon}
        label={label}
        onClick={
          onClick
            ? event => {
                onClick(event)
              }
            : undefined
        }
        onDelete={
          onDelete
            ? () => {
                onDelete()
              }
            : undefined
        }
      />
    </Tooltip>
  )
}
