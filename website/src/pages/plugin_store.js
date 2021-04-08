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

import PersonIcon from '@material-ui/icons/Person'
import AccountBalanceIcon from '@material-ui/icons/AccountBalance'
import GitHubIcon from '@material-ui/icons/GitHub'

import { plugins } from '../../plugins.json'

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

  card: {
    margin: '1em auto',
    width: 800,
  },

  icon: { marginLeft: '0.5em', marginRight: '0.5em' },

  dataField: {
    display: 'flex',
    alignItems: 'center',
    margin: '0.4em 0em',
  },
}))

function PluginStore() {
  const context = useDocusaurusContext()
  const { siteConfig = {} } = context
  const classes = useStyles()

  // console.log(plugins)

  return (
    <Layout title={`${siteConfig.title}`}>
      <div className={classes.body}>
        <div style={{ flexBasis: '50%' }}>
          <h1 style={{ textAlign: 'center' }}>JBrowse 2 Plugin Store</h1>
        </div>
        <div style={{ flexBasis: '50%' }}>
          {plugins.map(plugin => (
            <Card variant="outlined" key={plugin.name} className={classes.card}>
              <CardActionArea>
                <CardMedia
                  style={{ height: 200, width: 800 }}
                  image={plugin.image}
                  title={plugin.name}
                />
                <CardContent>
                  <div className={classes.dataField}>
                    <Typography variant="h4">{plugin.name}</Typography>
                    <Button
                      color="primary"
                      variant="contained"
                      disableRipple="true"
                      size="small"
                      style={{ marginLeft: '1em' }}
                    >
                      Show configuration
                    </Button>
                  </div>
                  <div className={classes.dataField}>
                    <PersonIcon style={{ marginRight: '0.5em' }} />
                    <Typography>{plugin.authors.join(', ')}</Typography>
                    <AccountBalanceIcon className={classes.icon} />
                    <Typography>
                      {plugin.license === 'NONE'
                        ? 'No license'
                        : plugin.license}
                    </Typography>
                    <GitHubIcon className={classes.icon} />
                    <Link href={plugin.location}>
                      <Typography>{plugin.location}</Typography>
                    </Link>
                  </div>
                  <Typography variant="h6">Description:</Typography>
                  <Typography>{plugin.description}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default PluginStore
