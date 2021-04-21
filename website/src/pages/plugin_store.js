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
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardMedia from '@material-ui/core/CardMedia'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'

import PersonIcon from '@material-ui/icons/Person'
import AccountBalanceIcon from '@material-ui/icons/AccountBalance'
import GitHubIcon from '@material-ui/icons/GitHub'
import AssignmentIcon from '@material-ui/icons/Assignment'
import AssignmentTurnedInIcon from '@material-ui/icons/AssignmentTurnedIn'
import HelpIcon from '@material-ui/icons/Help'
import CodeIcon from '@material-ui/icons/Code'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'

import { DialogContent } from '@material-ui/core'

// eslint-disable-next-line import/no-unresolved
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

  topLinks: {
    margin: '0 auto',
    display: 'flex',
    alignItems: 'space-between',
    justifyContent: 'center',
  },

  card: {
    margin: '1em auto',
    width: 800,
  },

  cardMedia: {
    height: 200,
    width: 800,
  },

  '@media (max-width: 800px)': {
    cardMedia: {
      display: 'none',
    },

    card: {
      width: 'auto',
    },
  },

  icon: {
    marginLeft: '0.5em',
    marginRight: '0.5em',
  },

  topButton: {
    margin: '1em',
  },

  closeButton: {
    color: '#fff',
    position: 'absolute',
    top: 5,
    right: 0,
  },

  dataField: {
    display: 'flex',
    alignItems: 'center',
    margin: '0.4em 0em',
  },

  dialogTitleBox: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    textAlign: 'center',
  },
}))

function TopDocumentation() {
  const classes = useStyles()
  const [aboutSectionOpen, setAboutSectionOpen] = useState(false)
  const [developerSectionOpen, setDeveloperSectionOpen] = useState(false)

  return (
    <>
      <div className={classes.topLinks}>
        <Button
          color="primary"
          variant="contained"
          size="medium"
          className={classes.topButton}
          onClick={() => setAboutSectionOpen(true)}
          disableRipple
        >
          <HelpIcon style={{ marginRight: '0.5em' }} /> About the plugin store
        </Button>
        <Button
          color="primary"
          variant="contained"
          size="medium"
          className={classes.topButton}
          onClick={() => setDeveloperSectionOpen(true)}
          disableRipple
        >
          <CodeIcon style={{ marginRight: '0.5em' }} /> Developer information
        </Button>
      </div>
      <Dialog
        open={aboutSectionOpen}
        onClose={() => setAboutSectionOpen(false)}
      >
        <DialogTitle className={classes.dialogTitleBox}>
          About
          <IconButton
            aria-label="close"
            className={classes.closeButton}
            onClick={() => setAboutSectionOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Welcome to the plugin store!
            <br />
            <br />
            This store contains the current list of white-listed JBrowse 2
            plugins that are available for use. Plugins can add functionality
            that doesn&apos;t exist in the core application, such as a new data
            adapter, or a custom track type.
            <br />
            <br />
            The configuration that is specified for each plugin can be added to
            the <code>plugins</code> array as a top-level entry. For example:
            <br />
            <br />
          </Typography>
          <pre>
            <code>{configExample}</code>
          </pre>
          <Typography>
            These plugins can also be added directly from inside the application
            via the File menu.
          </Typography>
        </DialogContent>
      </Dialog>
      <Dialog
        open={developerSectionOpen}
        onClose={() => setDeveloperSectionOpen(false)}
      >
        <DialogTitle className={classes.dialogTitleBox}>
          Developer info
          <IconButton
            aria-label="close"
            className={classes.closeButton}
            onClick={() => setDeveloperSectionOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography>
            We welcome developers who want to create a new JBrowse 2 plugin. The
            primary resource for getting started creating a new plugin is the{' '}
            <Link
              href="https://github.com/GMOD/jbrowse-plugin-template"
              target="_blank"
              rel="noopener"
            >
              plugin template
            </Link>
            .
            <br />
            <br />
            If you build a plugin that you would like to be featured in this
            store, please follow the instructions found{' '}
            <Link
              href="https://github.com/GMOD/jbrowse-plugin-list"
              target="_blank"
              rel="noopener"
            >
              here
            </Link>
            .
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PluginCard(props) {
  const classes = useStyles()
  const { plugin } = props

  const [showConfig, setShowConfig] = useState(false)

  return (
    <Card variant="outlined" key={plugin.name} className={classes.card}>
      {plugin.image ? (
        <CardMedia
          className={classes.cardMedia}
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
          <Link href={plugin.location} target="_blank" rel="noopener">
            <Typography>{plugin.location}</Typography>
          </Link>
        </div>
        <Typography variant="h6">Description:</Typography>
        <Typography>{plugin.description}</Typography>
      </CardContent>
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

function ConfigBlock(props) {
  const { plugin } = props
  const [clickedCopy, setClickedCopy] = useState(false)

  const configString = JSON.stringify(
    {
      name: plugin.name,
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
        <TopDocumentation />
        <div style={{ flexBasis: '50%' }}>
          {plugins.map(plugin => (
            <PluginCard plugin={plugin} key={plugin.name} />
          ))}
        </div>
      </div>
    </Layout>
  )
}

const configExample = `{
  "configuration": {
    /* global configs here */
  },
  "assemblies": [
    /* list of assembly configurations */
  ],
  "tracks": [
    /* array of tracks being loaded */
  ],
  "defaultSession": {
    /* optional default session */
  },
  "plugins": [
    {
      "name": "Msaview",
      "url": "https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js"
    }
  ]
}`

export default PluginStore
