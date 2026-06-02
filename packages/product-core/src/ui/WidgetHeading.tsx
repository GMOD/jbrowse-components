import { Typography } from '@mui/material'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Widget } from '@jbrowse/core/util'

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

export default WidgetHeading
