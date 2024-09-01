import React, { useState } from 'react'
import copy from 'copy-to-clipboard'

import Layout from '@theme/Layout'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'

import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import { ThemeProvider, createTheme } from '@mui/material/styles'

import Person from '@mui/icons-material/Person'
import AccountBalance from '@mui/icons-material/AccountBalance'
import GitHub from '@mui/icons-material/GitHub'
import Assignment from '@mui/icons-material/Assignment'
import AssignmentTurnedIn from '@mui/icons-material/AssignmentTurnedIn'
import Help from '@mui/icons-material/Help'
import Code from '@mui/icons-material/Code'
import Close from '@mui/icons-material/Close'

import pluginJSON from '../../plugins.json'

import pluginStyles from '../css/pluginStyles.module.css'

const { plugins } = pluginJSON

const theme = createTheme({
  palette: { secondary: { main: '#ccc' }, primary: { main: '#3f51b5' } },
})

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
            <Help style={{ marginRight: '0.5em' }} /> About the plugin store
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
            <Code style={{ marginRight: '0.5em' }} /> Developer information
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
              <Close style={{ color: '#fff' }} />
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
              <Close style={{ color: '#fff' }} />
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
          <Person style={{ marginRight: '0.5em' }} />
          <Typography>{plugin.authors.join(', ')}</Typography>
          <AccountBalance className={pluginStyles.icon} />
          <Typography>
            {plugin.license === 'NONE' ? 'No license' : plugin.license}
          </Typography>
          <GitHub className={pluginStyles.icon} />
          <Link href={plugin.location} target="_blank" rel="noopener">
            {plugin.location}
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
        startIcon={clickedCopy ? <AssignmentTurnedIn /> : <Assignment />}
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
    <ThemeProvider theme={theme}>
      {/*
// @ts-expect-error */}
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
    </ThemeProvider>
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
