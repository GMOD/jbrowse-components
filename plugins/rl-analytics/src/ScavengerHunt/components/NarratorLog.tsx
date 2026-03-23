import { Box, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { useEffect, useRef } from 'react'

export interface NarratorEntry {
  id: number
  text: string
  type: 'intro' | 'success' | 'hint' | 'award' | 'system'
}

const typeStyles: Record<NarratorEntry['type'], Record<string, unknown>> = {
  intro: { bgcolor: 'grey.50', color: 'text.primary' },
  success: { bgcolor: 'success.light', color: 'success.contrastText' },
  hint: { bgcolor: 'info.light', color: 'info.contrastText' },
  award: { bgcolor: 'warning.light', color: 'warning.contrastText' },
  system: { bgcolor: 'grey.200', color: 'text.secondary', fontSize: '0.75rem' },
}

const NarratorLog = observer(function NarratorLog({
  entries,
}: {
  entries: NarratorEntry[]
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

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
            p: 1,
            mb: 0.5,
            borderRadius: 1,
            fontStyle: entry.type === 'intro' || entry.type === 'hint' ? 'italic' : 'normal',
            fontSize: entry.type === 'system' ? '0.75rem' : '0.8125rem',
            animation: 'narratorFadeIn 0.3s ease-out',
            '@keyframes narratorFadeIn': {
              '0%': { opacity: 0, transform: 'translateY(4px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' },
            },
            ...typeStyles[entry.type],
          }}
        >
          {entry.text}
        </Typography>
      ))}
      <div ref={bottomRef} />
    </Box>
  )
})

export default NarratorLog
