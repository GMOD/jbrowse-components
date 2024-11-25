import React from 'react'
import { getEnv } from '@jbrowse/core/util'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import {
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

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

const DrawerWidgetSelector = observer(function ({
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
          if (!widget) {
            return (
              <Typography variant="h6" color="inherit">
                Unknown widget
              </Typography>
            )
          }
          const widgetType = pluginManager.getWidgetType(widget.type)!
          const { HeadingComponent, heading } = widgetType
          return HeadingComponent ? (
            <HeadingComponent model={widget} />
          ) : (
            <Typography variant="h6" color="inherit">
              {heading}
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
        {[...activeWidgets.values()].map(widget => {
          const widgetType = pluginManager.getWidgetType(widget.type)!
          const { HeadingComponent, heading } = widgetType
          return (
            <MenuItem
              data-testid={`widget-drawer-selects-item-${widget.type}`}
              key={widget.id}
              value={widget.id}
            >
              {HeadingComponent ? (
                <HeadingComponent model={widget} />
              ) : (
                <Typography variant="h6" color="inherit">
                  {heading}
                </Typography>
              )}
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
          )
        })}
      </Select>
    </FormControl>
  )
})

export default DrawerWidgetSelector
