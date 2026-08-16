import { ActionLink } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getParent } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import { locationLinkClick } from '../util.ts'

/**
 * A locus in a cell, which opens it in the sheet's linear view.
 *
 * Two spellings on purpose: `children` is what the reader sees — grouped
 * coordinates — while `locString` is parsed at the other end, and the raw form
 * is the one that does not shift under the numberGrouping preference.
 *
 * Shared because a row has two loci worth reaching, its own and its mate's, and
 * the second one is the whole answer to "where does this translocation go".
 */
const LocationLink = observer(function LocationLink({
  model,
  locString,
  children,
}: {
  model: { assemblyName?: string }
  locString: string
  children: React.ReactNode
}) {
  const session = getSession(model)
  const view = getParent<{ id: string; importedTrackId?: string }>(model)
  const { assemblyName } = model
  return (
    <ActionLink
      onClick={async () => {
        try {
          await locationLinkClick({
            spreadsheetViewId: view.id,
            session,
            locString,
            assemblyName: assemblyName!,
            trackId: view.importedTrackId,
          })
        } catch (e) {
          console.error(e)
          session.notifyError(`${e}`, e)
        }
      }}
    >
      {children}
    </ActionLink>
  )
})

export default LocationLink
