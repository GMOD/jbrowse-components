import { Box, Typography, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { useCallback, useEffect, useRef } from 'react'

import type { RLObserverViewModel } from './viewModel.ts'

const ObserverView = observer(function ObserverView({
  model,
}: {
  model: RLObserverViewModel
}) {
  const theme = useTheme()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollPending = useRef(false)

  // Throttled scroll-to-bottom: at most once per animation frame
  const scrollToBottom = useCallback(() => {
    if (!scrollPending.current) {
      scrollPending.current = true
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' })
        scrollPending.current = false
      })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [model.logEntries.length, scrollToBottom])

  const isDark = theme.palette.mode === 'dark'

  return (
    <Box
      sx={{
        height: model.height,
        overflow: 'auto',
        bgcolor: isDark ? 'background.paper' : 'grey.900',
        color: isDark ? 'text.primary' : 'grey.300',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        p: 1,
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: isDark ? 'grey.600' : 'grey.700',
          borderRadius: 3,
        },
      }}
    >
      {model.logEntries.length === 0 && (
        <Typography
          sx={{
            color: isDark ? 'text.disabled' : 'grey.600',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
          }}
        >
          Action Monitor — waiting for actions...
        </Typography>
      )}
      {model.logEntries.map(entry => (
        <Box
          key={entry.id}
          sx={{ py: 0.15, whiteSpace: 'pre-wrap', lineHeight: 1.3 }}
        >
          {entry.text}
        </Box>
      ))}
      <div ref={bottomRef} />
    </Box>
  )
})

export default ObserverView
