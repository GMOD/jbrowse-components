import { useState } from 'react'

import { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import { HIGHLIGHT_ALPHA } from '@jbrowse/core/util/highlights'
import Delete from '@mui/icons-material/Delete'
import Palette from '@mui/icons-material/Palette'
import { IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

// contextual bar over the grid while rows are selected, holding the bulk
// recolor and delete
const SelectionActions = observer(function SelectionActions({
  count,
  color,
  onDelete,
  onRecolor,
}: {
  count: number
  color: string
  onDelete: () => void
  onRecolor: (color: string) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  return count > 0 ? (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', px: 1, py: 0.5 }}
    >
      <Typography variant="body2">{count} selected</Typography>
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
        onChange={onRecolor}
      />
      <Tooltip title="Delete selected">
        <IconButton size="small" onClick={onDelete}>
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  ) : null
})

export default SelectionActions
