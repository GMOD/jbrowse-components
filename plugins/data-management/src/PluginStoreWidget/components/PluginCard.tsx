import React, { useState } from 'react'
import { getSession, getEnv } from '@jbrowse/core/util'
import { isSessionWithSessionPlugins } from '@jbrowse/core/util/types'

// icons
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import PersonIcon from '@mui/icons-material/Person'
import {
  Card,
  CardActions,
  CardContent,
  Button,
  Link,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import type { PluginStoreModel } from '../model'
import type { JBrowsePlugin } from '@jbrowse/core/util/types'

const useStyles = makeStyles()({
  card: {
    margin: '0.5em',
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
  },
})

const PluginCard = observer(function PluginCard({
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
  // @ts-expect-error
  const isInstalled = runtimePluginDefinitions.some(d => d.url === plugin.url)
  const [tempDisabled, setTempDisabled] = useState(false)
  const disableButton = isInstalled || tempDisabled

  const rootModel = getParent<any>(model, 3)
  const { jbrowse } = rootModel

  return (
    <Card variant="outlined" key={plugin.name} className={classes.card}>
      <CardContent>
        <Typography variant="h5">
          <Link
            href={`${plugin.location}#readme`}
            target="_blank"
            rel="noopener"
          >
            {plugin.name}
          </Link>
        </Typography>
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

export default PluginCard
