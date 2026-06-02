import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  SessionWithFocusedViewAndDrawerWidgets,
  Widget,
} from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  formControl: {
    margin: 0,
  },

  drawerSelect: {
    margin: 0,
    color: theme.palette.secondary.contrastText,
  },

  dropDownIcon: {
    color: theme.palette.secondary.contrastText,
  },
}))

function WidgetHeading({
  widget,
  pluginManager,
}: {
  widget: Widget
  pluginManager: PluginManager
}) {
  const { HeadingComponent, heading } = pluginManager.getWidgetType(widget.type)
  return HeadingComponent ? (
    <HeadingComponent model={widget} />
  ) : (
    <Typography variant="h6" color="inherit">
      {heading}
    </Typography>
  )
}

const DrawerWidgetSelector = observer(function DrawerWidgetSelector({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { visibleWidget, activeWidgets } = session
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  return (
    <FormControl className={classes.formControl}>
      <Select
        value={visibleWidget?.id}
        data-testid="widget-drawer-selects"
        className={classes.drawerSelect}
        classes={{ icon: classes.dropDownIcon }}
        renderValue={widgetId => {
          const widget = session.activeWidgets.get(widgetId)
          return widget ? (
            <WidgetHeading widget={widget} pluginManager={pluginManager} />
          ) : (
            <Typography variant="h6" color="inherit">
              Unknown widget
            </Typography>
          )
        }}
        onChange={e => {
          const w = session.activeWidgets.get(e.target.value)
          if (w) {
            session.showWidget(w)
          } else {
            session.notify(`Widget not found ${e.target.value}`, 'warning')
          }
        }}
      >
        {[...activeWidgets.values()].map(widget => (
          <MenuItem
            data-testid={`widget-drawer-selects-item-${widget.type}`}
            key={widget.id}
            value={widget.id}
          >
            <WidgetHeading widget={widget} pluginManager={pluginManager} />
            <IconButton
              data-testid={`${widget.type}-drawer-delete`}
              color="inherit"
              aria-label="Delete"
              onClick={() => {
                session.hideWidget(widget)
              }}
            >
              <DeleteIcon />
            </IconButton>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default DrawerWidgetSelector
