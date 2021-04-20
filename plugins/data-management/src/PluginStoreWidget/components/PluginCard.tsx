/* eslint-disable react/prop-types */
import React from 'react'
import { observer } from 'mobx-react'

import { makeStyles } from '@material-ui/core/styles'
import Link from '@material-ui/core/Link'
import Typography from '@material-ui/core/Typography'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import Button from '@material-ui/core/Button'

import PersonIcon from '@material-ui/icons/Person'
import AddIcon from '@material-ui/icons/Add'

import type { JBrowsePlugin } from '../types'

const useStyles = makeStyles(() => ({
  card: {
    margin: '1em',
  },
  icon: {
    marginLeft: '0.5em',
    marginRight: '0.5em',
  },
  bold: {
    fontWeight: 600,
  },
  dataField: {
    display: 'flex',
    alignItems: 'center',
    margin: '0.4em 0em',
  },
}))

function PluginCard({ plugin }: { plugin: JBrowsePlugin }) {
  const classes = useStyles()

  return (
    <Card variant="outlined" key={plugin.name} className={classes.card}>
      <CardContent>
        <div className={classes.dataField}>
          <Typography variant="h5">
            <Link
              href={`${plugin.location}#readme`}
              target="_blank"
              rel="noopener"
            >
              {plugin.name}
            </Link>
          </Typography>
        </div>
        <div className={classes.dataField}>
          <PersonIcon style={{ marginRight: '0.5em' }} />
          <Typography>{plugin.authors.join(', ')}</Typography>
        </div>
        <Typography className={classes.bold}>Description:</Typography>
        <Typography>{plugin.description}</Typography>
      </CardContent>
      <CardActions>
        <Button variant="contained" color="primary" startIcon={<AddIcon />}>
          Install
        </Button>
      </CardActions>
    </Card>
  )
}

export default observer(PluginCard)
