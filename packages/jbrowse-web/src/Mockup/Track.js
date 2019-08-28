import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import CardMedia from '@material-ui/core/CardMedia'
import Collapse from '@material-ui/core/Collapse'
import IconButton from '@material-ui/core/IconButton'
import { makeStyles } from '@material-ui/core/styles'
import ExpandLessIcon from '@material-ui/icons/ExpandLess'
import FavoriteIcon from '@material-ui/icons/Favorite'
import ShareIcon from '@material-ui/icons/Share'
import PropTypes from 'prop-types'
import React from 'react'
import FeatureDetails from './FeatureDetails'
import TrackAction from './TrackAction'
import TrackSettings from './TrackSettings'

const useStyles = makeStyles(theme => ({
  card: {
    // display: 'flex',
    margin: theme.spacing(1),
  },
  details: { display: 'flex', flexDirection: 'column' },
  content: {
    flex: '1 0 auto',
  },
  cover: {
    width: '100%',
    margin: theme.spacing(1),
    height: 0,
    paddingTop: '10%',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    paddingLeft: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  playIcon: {
    height: 38,
    width: 38,
  },
  expand: {
    // transform: 'rotate(0deg)',
    marginLeft: 'auto',
    // transition: theme.transitions.create('transform', {
    //   duration: theme.transitions.duration.shortest,
    // }),
  },
  header: { width: 150 },
}))

export default function MediaControlCard({ title, description }) {
  const classes = useStyles()
  const [expanded, setExpanded] = React.useState(false)
  const [detailsName, setDetailsName] = React.useState('feature')

  let DetailsStuff = null
  if (detailsName === 'feature') DetailsStuff = FeatureDetails
  if (detailsName === 'settings') DetailsStuff = TrackSettings

  function handleSettingsClick() {
    setDetailsName('settings')
    setExpanded(true)
  }

  function handleFeatureClick() {
    setDetailsName('feature')
    setExpanded(true)
  }

  function handleExpandClick() {
    setExpanded(!expanded)
  }

  return (
    <Card className={classes.card} elevation={8}>
      <div style={{ display: 'flex' }}>
        <CardHeader
          className={classes.header}
          action={<TrackAction onSettingsClick={handleSettingsClick} />}
          title={title}
          titleTypographyProps={{ variant: 'body1' }}
          subheader={description}
          subheaderTypographyProps={{ style: { fontSize: 12 } }}
        />
        <CardMedia
          className={classes.cover}
          image="/pileup.png"
          title="Live from space album cover"
          onClick={handleFeatureClick}
        />
      </div>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardActions disableSpacing>
          <IconButton aria-label="add to favorites">
            <FavoriteIcon />
          </IconButton>
          <IconButton aria-label="share">
            <ShareIcon />
          </IconButton>
          <IconButton
            className={classes.expand}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandLessIcon />
          </IconButton>
        </CardActions>
        <CardContent>
          <DetailsStuff />
        </CardContent>
      </Collapse>
    </Card>
  )
}

MediaControlCard.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
}

MediaControlCard.defaultProps = { title: '', description: '' }
