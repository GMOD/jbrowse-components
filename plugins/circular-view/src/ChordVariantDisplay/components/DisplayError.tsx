import { useTheme } from '@mui/material/styles'
import { observer } from 'mobx-react'

import HatchCircle from './HatchCircle.tsx'

function truncate(str: string, max: number) {
  return str.length > max ? `${str.slice(0, max)}…` : str
}

const DisplayError = observer(function DisplayError({
  model,
  radius,
  onClick,
}: {
  model: { error: unknown }
  radius: number
  onClick?: () => void
}) {
  const theme = useTheme()
  const text = truncate(String(model.error), 80)
  return (
    <g
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={
        onClick
          ? () => {
              onClick()
            }
          : undefined
      }
    >
      <HatchCircle
        radius={radius}
        fill={theme.palette.error.light}
        hatchColor={theme.palette.error.main}
        text={onClick ? `${text} (click for details)` : text}
      />
    </g>
  )
})

export default DisplayError
