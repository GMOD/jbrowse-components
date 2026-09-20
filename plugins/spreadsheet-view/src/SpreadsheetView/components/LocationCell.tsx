import {
  assembleLocString,
  assembleLocStringRaw,
  getSession,
} from '@jbrowse/core/util'
import { getParent } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import FeatureMenu from './FeatureMenu.tsx'
import LocationLink from './LocationLink.tsx'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { FindJunctionsNear, SvEvent } from '@jbrowse/sv-core'

export default observer(function LocationCell({
  model,
  feature,
}: {
  model: {
    assemblyName?: string
    findJunctionsNear: () => FindJunctionsNear
    svEventFor: (feature: SimpleFeatureSerialized) => SvEvent | undefined
  }
  feature: SimpleFeatureSerialized
}) {
  const session = getSession(model)
  const view = getParent<{ id: string; drilldownTrackIds: string[] }>(model)
  const { assemblyName } = model
  const locString = assembleLocString(feature)
  return assemblyName ? (
    <>
      <FeatureMenu
        session={session}
        spreadsheetViewId={view.id}
        assemblyName={assemblyName}
        feature={feature}
        trackIds={view.drilldownTrackIds}
        findJunctionsNear={model.findJunctionsNear()}
        svEventFor={f => model.svEventFor(f)}
      />
      <LocationLink model={model} locString={assembleLocStringRaw(feature)}>
        {locString}
      </LocationLink>
    </>
  ) : (
    <>{locString}</>
  )
})
