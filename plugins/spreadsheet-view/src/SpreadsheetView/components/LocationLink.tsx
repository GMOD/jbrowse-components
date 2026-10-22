import { ActionLink } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getParent } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import { locationLinkClick } from '../util.ts'

/**
 * A row's locus or its mate's, opening it in the sheet's linear view. The
 * reader sees grouped coordinates; `locString` is the raw form, which the
 * numberGrouping preference does not change.
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
  const view = getParent<{ id: string; drilldownTrackIds: string[] }>(model)
  const { assemblyName } = model
  return (
    <ActionLink
      onClick={() =>
        locationLinkClick({
          spreadsheetViewId: view.id,
          session,
          locString,
          assemblyName: assemblyName!,
          trackIds: view.drilldownTrackIds,
        })
      }
    >
      {children}
    </ActionLink>
  )
})

export default LocationLink
