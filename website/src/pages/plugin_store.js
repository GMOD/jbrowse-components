/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import copy from 'copy-to-clipboard'

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
import AssignmentIcon from '@material-ui/icons/Assignment'
import AssignmentTurnedInIcon from '@material-ui/icons/AssignmentTurnedIn'
import CodeIcon from '@material-ui/icons/Code'
import AddIcon from '@material-ui/icons/Add'

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

  topButtons: {
    margin: '0 auto',
    display: 'flex',
    alignItems: 'space-between',
    justifyContent: 'center',
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

function PluginCard(props) {
  const classes = useStyles()
  const { plugin } = props

  const [showConfig, setShowConfig] = useState(false)

  return (
    <Card variant="outlined" key={plugin.name} className={classes.card}>
      <CardActionArea>
        {plugin.image ? (
          <CardMedia
            style={{ height: 200, width: 800 }}
            image={plugin.image}
            title={plugin.name}
          />
        ) : null}
        <CardContent>
          <div className={classes.dataField}>
            <Typography variant="h4">{plugin.name}</Typography>
          </div>
          <div className={classes.dataField}>
            <PersonIcon style={{ marginRight: '0.5em' }} />
            <Typography>{plugin.authors.join(', ')}</Typography>
            <AccountBalanceIcon className={classes.icon} />
            <Typography>
              {plugin.license === 'NONE' ? 'No license' : plugin.license}
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
      <CardActions>
        <Button
          color="primary"
          variant="contained"
          disableRipple
          size="small"
          style={{ marginLeft: '1em' }}
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? 'Hide configuration' : 'Show configuration'}
        </Button>
      </CardActions>
      {showConfig ? <ConfigBlock plugin={plugin} /> : null}
    </Card>
  )
}

// snagged from https://stackoverflow.com/a/53952925
function toPascalCase(string) {
  return `${string}`
    .replace(new RegExp(/[-_]+/, 'g'), ' ')
    .replace(new RegExp(/[^\w\s]/, 'g'), '')
    .replace(
      new RegExp(/\s+(.)(\w+)/, 'g'),
      ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`,
    )
    .replace(new RegExp(/\s/, 'g'), '')
    .replace(new RegExp(/\w/), s => s.toUpperCase())
}

function ConfigBlock(props) {
  const { plugin } = props
  const [clickedCopy, setClickedCopy] = useState(false)

  let pluginName = plugin.name
  if (pluginName.endsWith('-api')) {
    pluginName = pluginName.replace(/-api/, '')
  }
  pluginName = toPascalCase(pluginName)

  const configString = JSON.stringify(
    {
      name: pluginName,
      url: plugin.url,
    },
    null,
    4,
  )

  return (
    <CardContent>
      <pre>
        <code>{configString}</code>
      </pre>
      <Button
        color="primary"
        variant="contained"
        disableRipple
        size="small"
        startIcon={
          clickedCopy ? <AssignmentTurnedInIcon /> : <AssignmentIcon />
        }
        onClick={() => {
          copy(configString)
          setClickedCopy(true)
          setTimeout(() => setClickedCopy(false), 1000)
        }}
      >
        {clickedCopy ? 'Copied!' : 'Copy'}
      </Button>
    </CardContent>
  )
}

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
        <div className={classes.topButtons}>
          <Button
            disableRipple
            color="primary"
            style={{ margin: '1em' }}
            variant="contained"
            size="large"
            startIcon={<CodeIcon />}
            href="https://github.com/GMOD/jbrowse-plugin-template"
          >
            Create a plugin
          </Button>
          <Button
            disableRipple
            color="primary"
            style={{ margin: '1em' }}
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            href="https://github.com/GMOD/jbrowse-plugin-list"
          >
            Add plugin to store
          </Button>
        </div>
        <div style={{ flexBasis: '50%' }}>
          {plugins.map(plugin => (
            <PluginCard plugin={plugin} key={plugin.name} />
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default PluginStore
