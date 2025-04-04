import { assembleLocString, getSession } from '@jbrowse/core/util'
import { Link } from '@mui/material'
import { getParent } from '@jbrowse/mobx-state-tree'

import { locationLinkClick } from '../util'
import FeatureMenu from './FeatureMenu'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export default function LocationCell({
  model,
  feature,
}: {
  model: { assemblyName?: string }
  feature: SimpleFeatureSerialized
}) {
  return (
    <>
      <FeatureMenu
        session={getSession(model)}
        spreadsheetViewId={getParent<any>(model).id}
        assemblyName={model.assemblyName!}
        feature={feature}
      />
      <Link
        href="#"
        onClick={async event => {
          try {
            event.preventDefault()
            await locationLinkClick({
              spreadsheetViewId: getParent<any>(model).id,
              session: getSession(model),
              locString: assembleLocString(feature),
              assemblyName: model.assemblyName!,
            })
          } catch (e) {
            console.error(e)
            getSession(model).notifyError(`${e}`, e)
          }
        }}
      >
        {assembleLocString(feature)}
      </Link>
    </>
  )
}
