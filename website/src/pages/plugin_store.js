/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import copy from 'copy-to-clipboard'

// eslint-disable-next-line import/no-unresolved
import Layout from '@theme/Layout'
// eslint-disable-next-line import/no-unresolved
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'

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

import pluginStyles from '../css/pluginStyles.module.css'

function TopDocumentation() {
  const [aboutSectionOpen, setAboutSectionOpen] = useState(false)
  const [developerSectionOpen, setDeveloperSectionOpen] = useState(false)

  return (
    <>
      <div className={pluginStyles.topLinks}>
        <div className={pluginStyles.topButton}>
          <Button
            color="primary"
            variant="contained"
            size="medium"
            onClick={() => setAboutSectionOpen(true)}
            disableRipple
          >
            <HelpIcon style={{ marginRight: '0.5em' }} /> About the plugin store
          </Button>
        </div>
        <div className={pluginStyles.topButton}>
          <Button
            color="primary"
            variant="contained"
            size="medium"
            onClick={() => setDeveloperSectionOpen(true)}
            disableRipple
          >
            <CodeIcon style={{ marginRight: '0.5em' }} /> Developer information
          </Button>
        </div>
      </div>
      <Dialog
        open={aboutSectionOpen}
        onClose={() => setAboutSectionOpen(false)}
      >
        <DialogTitle className={pluginStyles.dialogTitleBox}>
          About
          <div className={pluginStyles.closeButton}>
            <IconButton
              aria-label="close"
              onClick={() => setAboutSectionOpen(false)}
            >
              <CloseIcon style={{ color: '#fff' }} />
            </IconButton>
          </div>
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
        <DialogTitle className={pluginStyles.dialogTitleBox}>
          Developer info
          <div className={pluginStyles.closeButton}>
            <IconButton
              aria-label="close"
              onClick={() => setDeveloperSectionOpen(false)}
            >
              <CloseIcon style={{ color: '#fff' }} />
            </IconButton>
          </div>
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
  const { plugin } = props

  const [showConfig, setShowConfig] = useState(false)

  return (
    <Card variant="outlined" key={plugin.name} className={pluginStyles.card}>
      {plugin.image ? (
        <CardMedia
          className={pluginStyles.cardMedia}
          image={plugin.image}
          title={plugin.name}
        />
      ) : null}
      <CardContent>
        <div className={pluginStyles.dataField}>
          <Typography variant="h4">{plugin.name}</Typography>
        </div>
        <div className={pluginStyles.dataField}>
          <PersonIcon style={{ marginRight: '0.5em' }} />
          <Typography>{plugin.authors.join(', ')}</Typography>
          <AccountBalanceIcon className={pluginStyles.icon} />
          <Typography>
            {plugin.license === 'NONE' ? 'No license' : plugin.license}
          </Typography>
          <GitHubIcon className={pluginStyles.icon} />
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

  return (
    <Layout title={`${siteConfig.title}`}>
      <div className={pluginStyles.body}>
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
