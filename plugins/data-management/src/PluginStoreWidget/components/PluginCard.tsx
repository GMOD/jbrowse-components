import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getEnv, getParent } from 'mobx-state-tree'

import { makeStyles } from '@material-ui/core/styles'
import {
  Card,
  CardActions,
  CardContent,
  Button,
  Link,
  Typography,
} from '@material-ui/core'

import PersonIcon from '@material-ui/icons/Person'
import AddIcon from '@material-ui/icons/Add'
import CheckIcon from '@material-ui/icons/Check'

import { getSession } from '@jbrowse/core/util'
import type { JBrowsePlugin } from '@jbrowse/core/util/types'
import { isSessionWithSessionPlugins } from '@jbrowse/core/util/types'

import type { PluginStoreModel } from '../model'

const useStyles = makeStyles(() => ({
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
}))

function PluginCard({
  plugin,
  model,
  adminMode,
}: {
  plugin: JBrowsePlugin
  model: PluginStoreModel
  adminMode: boolean
}) {
  const classes = useStyles()
  const session = getSession(model)
  const { pluginManager } = getEnv(model)
  const isInstalled = pluginManager.hasPlugin(`${plugin.name}Plugin`)
  const [tempDisabled, setTempDisabled] = useState(false)
  const disableButton = isInstalled || tempDisabled

  const rootModel = getParent(model, 3)
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
          color="primary"
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
}

export default observer(PluginCard)
