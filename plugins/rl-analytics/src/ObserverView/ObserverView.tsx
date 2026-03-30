import { Box, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { useEffect, useRef } from 'react'

import type { RLObserverViewModel } from './viewModel.ts'

const ObserverView = observer(function ObserverView({
  model,
}: {
  model: RLObserverViewModel
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [model.logEntries.length])

  return (
    <Box
      sx={{
        height: model.height,
        overflow: 'auto',
        bgcolor: '#1a1a2e',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        p: 1,
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: '#444',
          borderRadius: 3,
        },
      }}
    >
      {model.logEntries.length === 0 && (
        <Typography
          sx={{
            color: '#666',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
          }}
        >
          RL Observer — waiting for actions...
        </Typography>
      )}
      {model.logEntries.map((entry, i) => (
        <Box key={i} sx={{ py: 0.15, whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>
          {entry}
        </Box>
      ))}
      <div ref={bottomRef} />
    </Box>
  )
})

export default ObserverView
