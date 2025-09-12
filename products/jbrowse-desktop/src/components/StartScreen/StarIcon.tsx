import Star from '@mui/icons-material/Star'
import StarBorder from '@mui/icons-material/StarBorder'
import { Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  starIcon: {
    marginLeft: 4,
    fontSize: 16,
    color: 'darkorange',
    cursor: 'pointer',
  },
  starIconEmpty: {
    marginLeft: 4,
    fontSize: 16,
    color: 'black',
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
  return (
    <Tooltip title="Favorite">
      {isFavorite ? (
        <Star className={classes.starIcon} onClick={onClick} />
      ) : (
        <StarBorder className={classes.starIconEmpty} onClick={onClick} />
      )}
    </Tooltip>
  )
}
