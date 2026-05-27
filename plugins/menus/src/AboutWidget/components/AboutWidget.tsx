import { readConfObject } from '@jbrowse/core/configuration'
import { ExternalLink } from '@jbrowse/core/ui'
import {
  availableRenderers,
  preferredRenderer,
} from '@jbrowse/core/ui/getGraphicsCapabilities'
import { useGraphicsCapabilities } from '@jbrowse/core/ui/useGraphicsCapabilities'
import { getSession } from '@jbrowse/core/util'
import { hasSharedArrayBuffer } from '@jbrowse/core/util/stopToken'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(2),
    paddingTop: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(1),
  },
  accordions: {
    marginTop: theme.spacing(3),
  },
  icon: {
    color: theme.palette.tertiary.contrastText || '#fff',
  },
}))

const AboutWidget = observer(function AboutWidget({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { version } = session
  const { pluginManager } = getEnv(model)
  const { plugins } = pluginManager as PluginManager
  const graphicsCapabilities = useGraphicsCapabilities()
  const defaultRpcDriver = readConfObject(
    session.rpcManager.mainConfiguration,
    'defaultDriver',
  ) as string
  const corePlugins = new Set(
    plugins
      .filter(p => pluginManager.pluginMetadata[p.name]?.isCore)
      .map(p => p.name),
  )

  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center">
        JBrowse 2
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        {version}
      </Typography>
      <Typography align="center">
        JBrowse is a <ExternalLink href="http://gmod.org/">GMOD</ExternalLink>{' '}
        project
      </Typography>
      <br />
      <Typography align="center">
        © 2019-2026 The Evolutionary Software Foundation
      </Typography>

      <div className={classes.accordions}>
        {graphicsCapabilities ? (
          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon className={classes.icon} />}
            >
              <Typography>
                Graphics:{' '}
                <strong>{preferredRenderer(graphicsCapabilities)}</strong>
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <ul>
                <li>
                  Available:{' '}
                  {availableRenderers(graphicsCapabilities).join(', ')}
                </li>
              </ul>
            </AccordionDetails>
          </Accordion>
        ) : null}

        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon className={classes.icon} />}
          >
            <Typography>
              RPC: <strong>{defaultRpcDriver}</strong>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              <li>
                {defaultRpcDriver === 'WebWorkerRpcDriver'
                  ? 'Rendering runs off the main thread in a web worker.'
                  : 'Rendering runs on the main thread — UI blocks during heavy work.'}
              </li>
              <li>
                Worker abort:{' '}
                {hasSharedArrayBuffer
                  ? 'SharedArrayBuffer (fast atomic abort)'
                  : 'XHR fallback (cross-origin isolation headers missing — synchronous worker abort is slow)'}
              </li>
            </ul>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon className={classes.icon} />}
          >
            <Typography>External plugins loaded</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {plugins
                .filter(plugin => !corePlugins.has(plugin.name))
                .map(plugin => {
                  const { url, name, version = '' } = plugin
                  const text = `${name} ${version || ''}`
                  return (
                    <li key={plugin.name}>
                      {plugin.url ? (
                        <ExternalLink href={url}>{text}</ExternalLink>
                      ) : (
                        <span>{text}</span>
                      )}
                    </li>
                  )
                })}
            </ul>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon className={classes.icon} />}
          >
            <Typography>Core plugins loaded</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ul>
              {plugins
                .filter(plugin => corePlugins.has(plugin.name))
                .map(plugin => (
                  <li key={plugin.name}>
                    {plugin.name} {plugin.version || ''}
                  </li>
                ))}
            </ul>
          </AccordionDetails>
        </Accordion>
      </div>
    </div>
  )
})

export default AboutWidget
