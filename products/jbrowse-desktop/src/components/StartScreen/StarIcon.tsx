import StarIcon2 from '@mui/icons-material/Star'
import { Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  starIcon: {
    marginLeft: 4,
    fontSize: 16,
    color: 'darkorange',
  },
})

export default function StarIcon() {
  const { classes } = useStyles()
  return (
    <Tooltip title="Favorite">
      <StarIcon2 className={classes.starIcon} />
    </Tooltip>
  )
}
