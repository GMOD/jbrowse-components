import { makeStyles } from '@jbrowse/core/util/tss-react'
import Star from '@mui/icons-material/Star'
import StarBorder from '@mui/icons-material/StarBorder'
import { Tooltip } from '@mui/material'

const useStyles = makeStyles()({
  starIcon: {
    marginLeft: 4,
    fontSize: 16,
    cursor: 'pointer',
  },
})

export default function StarIcon({
  isFavorite,
  onClick,
}: {
  isFavorite: boolean
  onClick: () => void
}) {
  const { classes } = useStyles()
  const Icon = isFavorite ? Star : StarBorder
  return (
    <Tooltip title="Favorite">
      <Icon
        className={classes.starIcon}
        style={{ color: isFavorite ? 'darkorange' : 'black' }}
        onClick={onClick}
      />
    </Tooltip>
  )
}
