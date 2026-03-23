import { Box, IconButton, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { createPortal } from 'react-dom'
import { useState } from 'react'

/**
 * Floating panel that renders as a portal on the right edge of the viewport.
 * Stays visible even when the track selector or other widgets open.
 * Can be minimized to a small tab.
 */
const FloatingPanel = observer(function FloatingPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [minimized, setMinimized] = useState(false)

  const panel = (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        right: 8,
        top: 60,
        width: minimized ? 40 : 320,
        maxHeight: minimized ? 40 : 'calc(100vh - 80px)',
        zIndex: 10000,
        overflow: 'hidden',
        transition: 'width 0.3s ease, max-height 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          cursor: 'pointer',
          minHeight: 36,
        }}
        onClick={() => {
          setMinimized(!minimized)
        }}
      >
        {minimized ? (
          <IconButton size="small" sx={{ color: 'inherit', p: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              Q
            </Typography>
          </IconButton>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {title}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              [minimize]
            </Typography>
          </>
        )}
      </Box>

      {/* Content */}
      {!minimized && (
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'grey.300',
              borderRadius: 2,
            },
          }}
        >
          {children}
        </Box>
      )}
    </Paper>
  )

  // Render as portal to document.body so it floats above everything
  if (typeof document !== 'undefined') {
    return createPortal(panel, document.body)
  }
  return panel
})

export default FloatingPanel
