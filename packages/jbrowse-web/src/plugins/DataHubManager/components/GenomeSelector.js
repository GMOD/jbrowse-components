import React from 'react'
import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core/styles'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Typography from '@material-ui/core/Typography'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import CardActions from '@material-ui/core/CardActions'

const styles = {
  subtitle: {
    lineHeight: 'normal',
  },
}

function GenomeSelector(props) {
  const { hubTxtUrl, hubTxt } = props
  return (
    <Card>
      <CardHeader title={hubTxt.shortLabel} subheader={hubTxt.longLabel} />
      <CardContent>
        <Typography>Select Genome:</Typography>
      </CardContent>
      <CardActions>
        <IconButton
          href={`mailto:${hubTxt.email}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon>email</Icon>
        </IconButton>
        <IconButton
          href={new URL(hubTxt.descriptionUrl, hubTxtUrl).href}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon>open_in_new</Icon>
        </IconButton>
      </CardActions>
    </Card>
  )
}

GenomeSelector.propTypes = {
  hubTxtUrl: PropTypes.shape().isRequired,
  hubTxt: PropTypes.shape({
    hub: PropTypes.string.isRequired,
    shortLabel: PropTypes.string.isRequired,
    longLabel: PropTypes.string.isRequired,
    genomesFile: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    descriptionUrl: PropTypes.string,
  }).isRequired,
}

export default withStyles(styles)(GenomeSelector)
