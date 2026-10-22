import { workflowForm } from '@jbrowse/core/util'

import { BULK_WORKFLOW } from '../AddTrackWidget/workflowNames.ts'

import type { AddTrackWorkflowModel } from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'

export type InputMode = 'remote' | 'local'

export interface BulkInputState {
  mode: InputMode
  text: string
  localLocations: FileLocation[]
  /** names typed over the automatic ones, by row id */
  customNames: Record<string, string>
  stripExtensions: boolean
}

const initialBulkInput: BulkInputState = {
  mode: 'remote',
  text: '',
  localLocations: [],
  customNames: {},
  stripExtensions: false,
}

/**
 * What the bulk workflow has collected so far. `update` takes a patch because
 * the form edits several fields together: removing a row rewrites the input
 * *and* forgets that row's rename.
 */
export function bulkInput(model: AddTrackWorkflowModel) {
  return workflowForm(model, BULK_WORKFLOW, initialBulkInput)
}
