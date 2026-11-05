import { assembleLocString, getSession } from '../../util/index.ts'
import { isSameAssemblyName } from '../../util/tracks.ts'
import { panelAssemblyName } from '../SequenceFeatureDetails/panelAssemblyName.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { FeatureDetailsModel } from '../types.tsx'

interface NavigableView {
  assemblyNames: string[]
  navTo: (
    location: {
      refName: string
      start: number
      end: number
      assemblyName?: string
    },
    grow?: number,
  ) => void
  navToLocString: (
    locString: string,
    assemblyName?: string,
    grow?: number,
  ) => Promise<unknown>
}

function isNavigableView(view: unknown): view is NavigableView {
  return (
    typeof view === 'object' &&
    view !== null &&
    'assemblyNames' in view &&
    Array.isArray(view.assemblyNames) &&
    'navTo' in view &&
    typeof view.navTo === 'function' &&
    'navToLocString' in view &&
    typeof view.navToLocString === 'function'
  )
}

const GROW = 0.1

/**
 * A span back on its sequence, `length` long: a feature crossing a circular
 * origin is written with its end past the length, and the view navigates to
 * the part before the origin, or to the part past it shifted back when the
 * span lies wholly there.
 */
function onSequence(start: number, end: number, length: number | undefined) {
  return length === undefined || end <= length
    ? { start, end }
    : start >= length
      ? { start: start - length, end: end - length }
      : { start, end: length }
}

/**
 * For a feature, what moves the widget's view onto it with a little room
 * either side, or undefined when the view cannot: it navigates by no locus, or
 * the feature sits on an assembly the view does not show, as a synteny mate on
 * the other genome does.
 *
 * `navTo` first, keeping the view's region list (several regions, collapsed
 * introns, a reversed region), and `navToLocString` only for a feature outside
 * every displayed region, which replaces the list with its contig: the order
 * `moveMatchingPanel` takes for the same reason.
 */
export function featureNavigator(model: FeatureDetailsModel) {
  const { view } = model
  return isNavigableView(view)
    ? (feature: SimpleFeatureSerialized) => {
        const session = getSession(model)
        const { assemblyManager } = session
        const assemblyName = panelAssemblyName({
          feature,
          viewAssemblyNames: view.assemblyNames,
          assemblyManager,
        })
        const inView = view.assemblyNames.some(name =>
          isSameAssemblyName(name, assemblyName, assemblyManager),
        )
        return inView
          ? () => {
              const { refName } = feature
              const assembly = assemblyName
                ? assemblyManager.get(assemblyName)
                : undefined
              const { start, end } = onSequence(
                feature.start,
                feature.end,
                assembly?.getRegionForRefName(
                  assembly.getCanonicalRefName2(refName),
                )?.end,
              )
              try {
                view.navTo({ refName, start, end, assemblyName }, GROW)
              } catch {
                view
                  .navToLocString(
                    assembleLocString({ refName, start, end }),
                    assemblyName,
                    GROW,
                  )
                  .catch((error: unknown) => {
                    session.notifyError(`${error}`, error)
                  })
              }
            }
          : undefined
      }
    : undefined
}

/**
 * What moves the view onto a 1-based span of a feature's own sequence, a
 * `transl_except` codon say, from the feature's locator.
 */
export function spanLocator(
  locate:
    | ((feature: SimpleFeatureSerialized) => (() => void) | undefined)
    | undefined,
  feature: SimpleFeatureSerialized,
) {
  return locate
    ? ({ start, end }: { start: number; end: number }) =>
        locate({
          ...feature,
          uniqueId: `${feature.uniqueId}-span`,
          start: start - 1,
          end,
        })
    : undefined
}
