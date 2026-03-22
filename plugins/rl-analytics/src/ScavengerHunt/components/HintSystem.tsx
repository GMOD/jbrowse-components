import { Alert, Box, Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

const HintSystem = observer(function HintSystem({
  hints,
  hintsRevealed,
  onRevealHint,
}: {
  hints: string[]
  hintsRevealed: number
  onRevealHint: () => void
}) {
  if (hints.length === 0) {
    return null
  }

  return (
    <Box sx={{ mt: 1, mb: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Hints
      </Typography>
      {Array.from({ length: hintsRevealed }, (_, i) => (
        <Alert key={i} severity="info" sx={{ mb: 0.5 }}>
          {hints[i]}
        </Alert>
      ))}
      {hintsRevealed < hints.length ? (
        <Button variant="text" size="small" onClick={onRevealHint}>
          Show hint ({hints.length - hintsRevealed} remaining)
        </Button>
      ) : (
        <Typography variant="caption" color="text.secondary">
          All hints revealed
        </Typography>
      )}
    </Box>
  )
})

export default HintSystem
