import { useState } from 'react'

import { pluginUrl } from '@jbrowse/core/PluginLoader'
import { ExternalLink } from '@jbrowse/core/ui'
import { getEnv, getSession, resolvePlugin } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isSessionWithSessionPlugins } from '@jbrowse/core/util/types'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import PersonIcon from '@mui/icons-material/Person'
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { PluginStoreModel } from '../model.ts'
import type { JBrowsePlugin } from '@jbrowse/core/util/types'

const useStyles = makeStyles()({
  card: {
    margin: '0.5em',
  },
  bold: {
    fontWeight: 600,
  },
  dataField: {
    display: 'flex',
    alignItems: 'center',
  },
  mr: {
    marginRight: '0.5em',
  },
})

const PluginCard = observer(function PluginCard({
  plugin,
  model,
}: {
  plugin: JBrowsePlugin
  model: PluginStoreModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { pluginManager } = getEnv(model)
  const { runtimePluginDefinitions } = pluginManager

  // resolve the plugin build that matches this JBrowse version, and install
  // that concrete (version-pinned) definition rather than the raw store entry
  const resolved = resolvePlugin(plugin, session.version)
  const resolvedUrl = pluginUrl(resolved.definition)
  const installDef = { ...resolved.definition, name: plugin.name }

  const isInstalled = runtimePluginDefinitions.some(
    d => pluginUrl(d) === resolvedUrl,
  )
  const [tempDisabled, setTempDisabled] = useState(false)
  const { adminMode, jbrowse } = session
  const { authors, description } = plugin
  return (
    <Card variant="outlined" className={classes.card}>
      <CardContent>
        <Typography variant="h5">
          <ExternalLink href={`${plugin.location}#readme`}>
            {plugin.name}
            {resolved.pluginVersion ? ` (v${resolved.pluginVersion})` : ''}
          </ExternalLink>
        </Typography>
        <div className={classes.dataField}>
          <PersonIcon className={classes.mr} />
          <Typography>{authors.join(', ')}</Typography>
        </div>
        <Typography className={classes.bold}>Description:</Typography>
        <Typography>{description}</Typography>
        {resolved.compatible ? null : (
          <Typography color="error">
            Not compatible with this version of JBrowse (requires JBrowse{' '}
            {resolved.supportedRanges.join(' or ')})
          </Typography>
        )}
      </CardContent>
      <CardActions>
        <Button
          variant="contained"
          disabled={isInstalled || tempDisabled || !resolved.compatible}
          startIcon={isInstalled ? <CheckIcon /> : <AddIcon />}
          onClick={() => {
            if (adminMode) {
              jbrowse.addPlugin(installDef)
            } else if (isSessionWithSessionPlugins(session)) {
              session.addSessionPlugin(installDef)
            } else {
              session.notify('No way to install plugin')
            }
            setTempDisabled(true)
          }}
        >
          {isInstalled ? 'Installed' : 'Install'}
        </Button>
      </CardActions>
    </Card>
  )
})

export default PluginCard
