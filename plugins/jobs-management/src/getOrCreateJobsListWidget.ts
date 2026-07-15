import type { JobsListModel } from './JobsListWidget/model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

/**
 * Get the singleton JobsList widget for a session, creating it if absent. The
 * widget map is untyped (`Widget`), so the result is cast to the concrete
 * model that this plugin registers.
 */
export function getOrCreateJobsListWidget(session: SessionWithWidgets) {
  const existing = session.widgets.get('JobsList')
  return (existing ??
    session.addWidget('JobsListWidget', 'JobsList')) as JobsListModel
}
