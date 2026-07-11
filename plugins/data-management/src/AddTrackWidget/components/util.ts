import {
  getSession,
  groupBy,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

import type { AddTrackModel, IndexingAttr } from '../model.ts'
import type { AdapterType } from '@jbrowse/core/pluggableElementTypes'

export const defaultIndexingConf: IndexingAttr = {
  attributes: ['Name', 'ID'],
  exclude: ['CDS', 'exon'],
}

export function categorizeAdapters(adaptersList: AdapterType[]) {
  return groupBy(
    adaptersList,
    adapter => adapter.adapterMetadata?.category ?? 'Default',
  )
}

/**
 * Whether the view currently displays any of the track's assemblies, i.e. the
 * track can be shown here after adding it. Shared by the single-track and
 * paste-JSON submit paths so both decide "show vs. warn" the same way.
 */
export function viewDisplaysAssembly(
  view: { assemblyNames?: readonly string[] } | undefined,
  assemblyNames: readonly (string | undefined)[] | undefined,
) {
  return !!view?.assemblyNames?.some(a => assemblyNames?.includes(a))
}

/**
 * Reset the form and dismiss the widget after a successful add. Shared by the
 * single-track and paste-JSON submit paths.
 */
export function finishAddTrack(model: AddTrackModel) {
  const session = getSession(model)
  model.clearData()
  if (isSessionModelWithWidgets(session)) {
    session.hideWidget(model)
  }
}
