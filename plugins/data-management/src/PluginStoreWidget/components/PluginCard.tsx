import { useState } from 'react'

import { ExternalLink } from '@jbrowse/core/ui'
import { getEnv, getSession } from '@jbrowse/core/util'
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

import type { PluginStoreModel } from '../model'
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
  const isInstalled = runtimePluginDefinitions.some(
    d => 'url' in d && d.url === plugin.url,
  )
  const [tempDisabled, setTempDisabled] = useState(false)
  const { adminMode, jbrowse } = session
  const { name, authors, description } = plugin
  return (
    <Card variant="outlined" key={name} className={classes.card}>
      <CardContent>
        <Typography variant="h5">
          <ExternalLink href={`${plugin.location}#readme`}>
            {plugin.name}
          </ExternalLink>
        </Typography>
        <div className={classes.dataField}>
          <PersonIcon className={classes.mr} />
          <Typography>{authors.join(', ')}</Typography>
        </div>
        <Typography className={classes.bold}>Description:</Typography>
        <Typography>{description}</Typography>
      </CardContent>
      <CardActions>
        <Button
          variant="contained"
          disabled={isInstalled || tempDisabled}
          startIcon={isInstalled ? <CheckIcon /> : <AddIcon />}
          onClick={() => {
            if (adminMode) {
              jbrowse.addPlugin(plugin)
            } else if (isSessionWithSessionPlugins(session)) {
              session.addSessionPlugin(plugin)
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
