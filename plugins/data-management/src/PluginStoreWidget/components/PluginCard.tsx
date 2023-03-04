import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { getSession, getEnv } from '@jbrowse/core/util'
import {
  JBrowsePlugin,
  isSessionWithSessionPlugins,
} from '@jbrowse/core/util/types'
import {
  Card,
  CardActions,
  CardContent,
  Button,
  Link,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons
import PersonIcon from '@mui/icons-material/Person'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'

// locals
import { PluginStoreModel } from '../model'

const useStyles = makeStyles()({
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
})

export default observer(function PluginCard({
  plugin,
  model,
  adminMode,
}: {
  plugin: JBrowsePlugin
  model: PluginStoreModel
  adminMode: boolean
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { pluginManager } = getEnv(model)
  const { runtimePluginDefinitions } = pluginManager
  const isInstalled = runtimePluginDefinitions.some(d => d.url === plugin.url)
  const [tempDisabled, setTempDisabled] = useState(false)
  const disableButton = isInstalled || tempDisabled

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootModel = getParent<any>(model, 3)
  const { jbrowse } = rootModel

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
        <Button
          variant="contained"
          disabled={disableButton}
          startIcon={isInstalled ? <CheckIcon /> : <AddIcon />}
          onClick={() => {
            if (adminMode) {
              jbrowse.addPlugin({ name: plugin.name, url: plugin.url })
            } else if (isSessionWithSessionPlugins(session)) {
              session.addSessionPlugin(plugin)
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
