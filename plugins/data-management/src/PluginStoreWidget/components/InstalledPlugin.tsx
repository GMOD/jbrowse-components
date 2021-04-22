/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'

import ListItem from '@material-ui/core/ListItem'
import Typography from '@material-ui/core/Typography'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'

import DialogTitle from '@material-ui/core/DialogTitle'
import Dialog from '@material-ui/core/Dialog'

import { getSession } from '@jbrowse/core/util'
import type { BasePlugin } from '@jbrowse/core/util/types'

import { PluginStoreModel } from '../model'

function InstalledPlugin({
  plugin,
  model,
}: {
  plugin: BasePlugin
  model: PluginStoreModel
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const session = getSession(model)
  const sessionSnapShot = getSnapshot(session)
  const { sessionPlugins } = sessionSnapShot

  return (
    <>
      <ListItem key={plugin.name}>
        <IconButton aria-label="remove" onClick={() => setDialogOpen(true)}>
          <CloseIcon />
        </IconButton>
        <Typography>{plugin.name}</Typography>
      </ListItem>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Foo</DialogTitle>
      </Dialog>
    </>
  )
}

export default observer(InstalledPlugin)

// () => {
//   if (
//     sessionPlugins.find(
//       (p: BasePlugin) => `${p.name}Plugin` === plugin.name,
//     ) === undefined
//   ) {
//     console.log('foo')
//   }
// }
