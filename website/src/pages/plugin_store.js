import React from 'react'
// eslint-disable-next-line import/no-unresolved
import Layout from '@theme/Layout'

// eslint-disable-next-line import/no-unresolved
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { makeStyles } from '@material-ui/core/styles'

import Link from '@material-ui/core/Link'
import Typography from '@material-ui/core/Typography'

import Card from '@material-ui/core/Card'
import CardActionArea from '@material-ui/core/CardActionArea'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardMedia from '@material-ui/core/CardMedia'
import Button from '@material-ui/core/Button'

const useStyles = makeStyles(theme => ({
  button: {
    textTransform: 'none',
  },
  section: {
    marginTop: '24px',
    marginBottom: '32px',
  },

  container: {
    display: 'flex',
    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
    justifyContent: 'center',
    alignItems: 'center',
  },

  body: {
    [theme.breakpoints.down('md')]: {
      margin: '0.5em',
    },
    margin: '5em',
  },
}))

function PluginStore() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  const classes = useStyles()

  return (
    <Layout title={`${siteConfig.title}`}>
      <div className={classes.body}>
        <div style={{ flexBasis: '50%' }}>
          <h1 style={{ textAlign: 'center' }}>JBrowse 2 Plugin Store</h1>
        </div>
      </div>
    </Layout>
  )
}

export default PluginStore
