import {
  getSession,
  groupBy,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

import type { AddTrackModel, IndexingAttr } from '../model.ts'
import type { AdapterType } from '@jbrowse/core/pluggableElementTypes'

export const defaultIndexingConf: IndexingAttr = {
  attributes: ['Name', 'ID', 'symbol'],
  exclude: ['CDS', 'exon'],
}

export function categorizeAdapters(adaptersList: AdapterType[]) {
  return groupBy(
    adaptersList,
    adapter => adapter.adapterMetadata?.category ?? 'Default',
  )
}

/**
 * The adapters that declare they also read this file (`adapterMetadata.alsoReads`)
 * and are not the one already chosen.
 *
 * The extension guess is first-match-wins and stays that way, so a file whose
 * extension two adapters can both read resolves to whichever guesser ran first,
 * and the other is reachable only by knowing its name and finding it in a
 * dropdown of every adapter JBrowse has. That is how an all-vs-all `.paf` gets
 * added as a pairwise one: it loads, it draws, and it attributes one genome's
 * contigs to another. This is what the form needs to say so instead.
 *
 * Empty for the ordinary file, which is most of them — only a handful of
 * adapters declare a pattern at all.
 */
export function alternativeAdapters({
  adaptersList,
  fileName,
  chosenAdapterType,
}: {
  adaptersList: AdapterType[]
  fileName: string | undefined
  chosenAdapterType: string | undefined
}) {
  return fileName
    ? adaptersList.filter(
        adapter =>
          adapter.name !== chosenAdapterType &&
          adapter.adapterMetadata?.alsoReads?.test(fileName),
      )
    : []
}

/**
 * Whether the target track list currently displays any of the track's
 * assemblies, i.e. the track can be shown here after adding it. Shared by the
 * single-track and paste-JSON submit paths so both decide "show vs. warn" the
 * same way.
 */
export function containerDisplaysAssembly(
  container: { assemblyNames?: readonly string[] } | undefined,
  assemblyNames: readonly (string | undefined)[] | undefined,
) {
  return !!container?.assemblyNames?.some(a => assemblyNames?.includes(a))
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
