import CloseIcon from '@mui/icons-material/Close'
import { AppBar, Box, IconButton, Toolbar } from '@mui/material'
import { observer } from 'mobx-react'

import WidgetHeading from './WidgetHeading.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Widget } from '@jbrowse/core/util'

const ModalWidgetAppBar = observer(function ModalWidgetAppBar({
  widget,
  pluginManager,
  onClose,
}: {
  widget: Widget
  pluginManager: PluginManager
  onClose: () => void
}) {
  return (
    <AppBar position="static">
      <Toolbar>
        <WidgetHeading widget={widget} pluginManager={pluginManager} />
        <Box sx={{ flexGrow: 1 }} />
        <IconButton color="inherit" onClick={onClose} data-testid="modal-close">
          <CloseIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  )
})

export default ModalWidgetAppBar
