import { assembleLocString, getSession } from '@jbrowse/core/util'
import { getParent } from '@jbrowse/mobx-state-tree'
import { Link } from '@mui/material'

import { locationLinkClick } from '../util.ts'
import FeatureMenu from './FeatureMenu.tsx'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export default function LocationCell({
  model,
  feature,
}: {
  model: { assemblyName?: string }
  feature: SimpleFeatureSerialized
}) {
  const session = getSession(model)
  const spreadsheetViewId = getParent<{ id: string }>(model).id
  const { assemblyName } = model
  const locString = assembleLocString(feature)
  return (
    <>
      {assemblyName ? (
        <FeatureMenu
          session={session}
          spreadsheetViewId={spreadsheetViewId}
          assemblyName={assemblyName}
          feature={feature}
        />
      ) : null}
      <Link
        href="#"
        onClick={async event => {
          if (!assemblyName) {
            return
          }
          try {
            event.preventDefault()
            await locationLinkClick({
              spreadsheetViewId,
              session,
              locString,
              assemblyName,
            })
          } catch (e) {
            console.error(e)
            session.notifyError(`${e}`, e)
          }
        }}
      >
        {locString}
      </Link>
    </>
  )
}
