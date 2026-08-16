import { ActionLink } from '@jbrowse/core/ui'
import {
  assembleLocString,
  assembleLocStringRaw,
  getSession,
} from '@jbrowse/core/util'
import { getParent } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import { locationLinkClick } from '../util.ts'
import FeatureMenu from './FeatureMenu.tsx'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export default observer(function LocationCell({
  model,
  feature,
}: {
  model: { assemblyName?: string }
  feature: SimpleFeatureSerialized
}) {
  const session = getSession(model)
  const view = getParent<{ id: string; importedTrackId?: string }>(model)
  const spreadsheetViewId = view.id
  const trackId = view.importedTrackId
  const { assemblyName } = model
  // two spellings on purpose: the link shows grouped coordinates, but what is
  // handed to locationLinkClick is parsed at the other end, and the raw form is
  // the one that does not shift under the numberGrouping preference. The row's
  // FeatureMenu navigates from the same raw string
  const locString = assembleLocString(feature)
  const rawLocString = assembleLocStringRaw(feature)
  return assemblyName ? (
    <>
      <FeatureMenu
        session={session}
        spreadsheetViewId={spreadsheetViewId}
        assemblyName={assemblyName}
        feature={feature}
        trackId={trackId}
      />
      <ActionLink
        onClick={async () => {
          try {
            await locationLinkClick({
              spreadsheetViewId,
              session,
              locString: rawLocString,
              assemblyName,
              trackId,
            })
          } catch (e) {
            console.error(e)
            session.notifyError(`${e}`, e)
          }
        }}
      >
        {locString}
      </ActionLink>
    </>
  ) : (
    <>{locString}</>
  )
})
