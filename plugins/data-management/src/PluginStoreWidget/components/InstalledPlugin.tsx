import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import Dialog from '@jbrowse/core/ui/Dialog'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import ListItem from '@mui/material/ListItem'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { makeStyles } from 'tss-react/mui'

// icons
import CloseIcon from '@mui/icons-material/Close'
import LockIcon from '@mui/icons-material/Lock'

// misc
import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'
import {
  BasePlugin,
  isSessionWithSessionPlugins,
} from '@jbrowse/core/util/types'

// locals
import { PluginStoreModel } from '../model'

const useStyles = makeStyles()({
  lockedPluginTooltip: {
    marginRight: '0.5rem',
  },
})

function LockedPlugin() {
  const { classes } = useStyles()
  return (
    <Tooltip
      className={classes.lockedPluginTooltip}
      title="This plugin was installed by an administrator, you cannot remove it."
    >
      <LockIcon />
    </Tooltip>
  )
}

function PluginDialog({
  onClose,
  plugin,
}: {
  plugin: string
  onClose: (s?: string) => void
}) {
  return (
    <Dialog open onClose={() => onClose()} title="Remove plugin">
      <DialogContent>
        <Typography>
          Please confirm that you want to remove {plugin}. Note: if any
          resources in this session still use this plugin, it may cause your
          session to crash
        </Typography>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              // avoid showing runtime plugin warning
              window.setTimeout(() => {
                onClose(plugin)
              }, 500)
            }}
          >
            Confirm
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              onClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

function InstalledPlugin({
  plugin,
  model,
  pluginManager,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
  pluginManager: PluginManager
}) {
  const [dialogPlugin, setDialogPlugin] = useState<string>()

  const session = getSession(model)
  const { sessionPlugins } = session as unknown as {
    sessionPlugins: BasePlugin[]
  }
  const isSessionPlugin = sessionPlugins?.some(
    p => pluginManager.pluginMetadata[plugin.name].url === p.url,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootModel = getParent<any>(model, 3)
  const { jbrowse, adminMode } = rootModel

  return (
    <>
      {dialogPlugin ? (
        <PluginDialog
          plugin={dialogPlugin}
          onClose={name => {
            if (name) {
              const pluginMetadata = pluginManager.pluginMetadata[plugin.name]

              if (adminMode) {
                jbrowse.removePlugin(pluginMetadata)
              } else if (isSessionWithSessionPlugins(session)) {
                session.removeSessionPlugin(pluginMetadata)
              }
            }
            setDialogPlugin(undefined)
          }}
        />
      ) : null}
      <ListItem key={plugin.name}>
        {adminMode || isSessionPlugin ? (
          <IconButton
            aria-label="removePlugin"
            data-testid={`removePlugin-${plugin.name}`}
            onClick={() => setDialogPlugin(plugin.name)}
          >
            <CloseIcon />
          </IconButton>
        ) : (
          <LockedPlugin />
        )}
        <Typography>{plugin.name}</Typography>
      </ListItem>
    </>
  )
}

export default observer(InstalledPlugin)
