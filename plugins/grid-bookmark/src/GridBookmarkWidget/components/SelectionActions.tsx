import { useState } from 'react'

import { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import Delete from '@mui/icons-material/Delete'
import Palette from '@mui/icons-material/Palette'
import { IconButton, Stack, Tooltip, Typography } from '@mui/material'

import { DEFAULT_HIGHLIGHT, HIGHLIGHT_ALPHA } from '../model.ts'

// gmail-style contextual action bar: shown above a grid once rows are selected,
// exposing the bulk actions (recolor, delete) as icons instead of a hamburger
export default function SelectionActions({
  count,
  color = DEFAULT_HIGHLIGHT,
  onDelete,
  onRecolor,
}: {
  count: number
  color?: string
  onDelete: () => void
  onRecolor?: (color: string) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  return count > 0 ? (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', px: 1, py: 0.5 }}
    >
      <Typography variant="body2">{count} selected</Typography>
      {onRecolor ? (
        <>
          <Tooltip title="Edit color of selected">
            <IconButton
              size="small"
              onClick={event => {
                setAnchorEl(event.currentTarget)
              }}
            >
              <Palette fontSize="small" />
            </IconButton>
          </Tooltip>
          <ColorPopover
            anchorEl={anchorEl}
            color={color}
            presetAlpha={HIGHLIGHT_ALPHA}
            onClose={() => {
              setAnchorEl(null)
            }}
            onChange={newColor => {
              onRecolor(newColor)
            }}
          />
        </>
      ) : null}
      <Tooltip title="Delete selected">
        <IconButton
          size="small"
          onClick={() => {
            onDelete()
          }}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  ) : null
}
