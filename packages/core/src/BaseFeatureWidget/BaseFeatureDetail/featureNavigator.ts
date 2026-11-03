import { assembleLocString, getSession } from '../../util/index.ts'
import { panelAssemblyName } from '../SequenceFeatureDetails/panelAssemblyName.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { FeatureDetailsModel } from '../types.tsx'

interface LocStringView {
  assemblyNames?: string[]
  navToLocString: (
    locString: string,
    assemblyName?: string,
    grow?: number,
  ) => Promise<unknown>
}

function isLocStringView(view: unknown): view is LocStringView {
  return (
    typeof view === 'object' &&
    view !== null &&
    'navToLocString' in view &&
    typeof view.navToLocString === 'function'
  )
}

/**
 * Moves the widget's view onto a feature, with a little room either side, or
 * undefined when the view cannot be moved to a locus.
 */
export function featureNavigator(model: FeatureDetailsModel) {
  const { view } = model
  return isLocStringView(view)
    ? (feature: SimpleFeatureSerialized) => {
        const session = getSession(model)
        view
          .navToLocString(
            assembleLocString(feature),
            panelAssemblyName({
              feature,
              viewAssemblyNames: view.assemblyNames,
              assemblyManager: session.assemblyManager,
            }),
            0.1,
          )
          .catch((error: unknown) => {
            session.notifyError(`${error}`, error)
          })
      }
    : undefined
}
