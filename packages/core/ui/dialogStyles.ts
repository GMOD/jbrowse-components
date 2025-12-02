import type { Theme } from '@mui/material'

export function getCloseButtonStyle(theme: Theme) {
  return {
    position: 'absolute' as const,
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  }
}
