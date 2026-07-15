import Star from '@mui/icons-material/Star'
import StarBorder from '@mui/icons-material/StarBorder'
import { IconButton, Tooltip } from '@mui/material'

export default function StarIcon({
  isFavorite,
  onClick,
  size = 'small',
}: {
  isFavorite: boolean
  onClick: () => void
  size?: 'small' | 'medium'
}) {
  const Icon = isFavorite ? Star : StarBorder
  return (
    <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
      <IconButton
        size={size}
        onClick={() => {
          onClick()
        }}
        style={{ color: isFavorite ? 'darkorange' : undefined }}
      >
        <Icon fontSize={size} />
      </IconButton>
    </Tooltip>
  )
}
