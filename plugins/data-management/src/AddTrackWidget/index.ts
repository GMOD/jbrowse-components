import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  AddTrackWorkflowType,
  WidgetType,
} from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import stateModelFactory from './model.ts'
import {
  BULK_WORKFLOW,
  DEFAULT_WORKFLOW,
  PASTE_JSON_WORKFLOW,
} from './workflowNames.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('AddTrackWidget', {})

// Loaded with the widget, since it is the workflow the widget opens on; a lazy
// level of its own would hold the form back by React's suspense reveal delay
export const DefaultAddTrackWorkflow = lazyWithPreload(
  () => import('./components/DefaultAddTrackWorkflow.tsx'),
)

export default function AddTrackWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'AddTrackWidget',
      heading: 'Add a track',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazyWithPreload(async () => {
        const [widget] = await Promise.all([
          import('./components/AddTrackWidget.tsx'),
          DefaultAddTrackWorkflow.preload(),
        ])
        return widget
      }),
    })
  })
  pluginManager.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: DEFAULT_WORKFLOW,
        displayName: 'Add a track from file or URL',
        category: 'general',
        ReactComponent: DefaultAddTrackWorkflow,
      }),
  )
  pluginManager.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: PASTE_JSON_WORKFLOW,
        displayName: 'Add track from pasted JSON',
        category: 'general',
        ReactComponent: lazy(
          () => import('./components/PasteConfigWorkflow.tsx'),
        ),
      }),
  )
  pluginManager.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: BULK_WORKFLOW,
        displayName: 'Add multiple tracks at once',
        category: 'general',
        ReactComponent: lazy(() => import('../BulkAddTracksWorkflow/index.ts')),
      }),
  )
}
