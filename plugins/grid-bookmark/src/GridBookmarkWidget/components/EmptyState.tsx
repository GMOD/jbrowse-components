import { Stack, Typography } from '@mui/material'

// friendly DataGrid "no rows" overlay, shared by the bookmark and highlight
// grids via slots.noRowsOverlay
export default function EmptyState({ message }: { message: string }) {
  return (
    <Stack
      sx={{
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary" align="center">
        {message}
      </Typography>
    </Stack>
  )
}
