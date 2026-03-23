import { Box, Typography } from '@mui/material'
import { useEffect, useRef } from 'react'

import type { NarratorEntry } from '../GameEngine.ts'

const typeStyles: Record<NarratorEntry['type'], Record<string, unknown>> = {
  intro: { bgcolor: 'grey.50', color: 'text.primary' },
  success: { bgcolor: 'success.light', color: 'success.contrastText' },
  hint: { bgcolor: 'info.light', color: 'info.contrastText' },
  award: { bgcolor: 'warning.light', color: 'warning.contrastText' },
  system: { bgcolor: 'grey.200', color: 'text.secondary' },
}

export default function NarratorLog({
  entries,
}: {
  entries: NarratorEntry[]
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  if (entries.length === 0) {
    return null
  }

  return (
    <Box
      sx={{
        maxHeight: 200,
        overflowY: 'auto',
        mb: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'grey.300',
          borderRadius: 2,
        },
      }}
    >
      {entries.map(entry => (
        <Typography
          key={entry.id}
          variant="body2"
          sx={{
            p: 0.75,
            mb: 0.5,
            borderRadius: 1,
            fontStyle:
              entry.type === 'intro' || entry.type === 'hint'
                ? 'italic'
                : 'normal',
            fontSize: entry.type === 'system' ? '0.75rem' : '0.8125rem',
            ...typeStyles[entry.type],
          }}
        >
          {entry.text}
        </Typography>
      ))}
      <div ref={bottomRef} />
    </Box>
  )
}
