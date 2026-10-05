import { ANNOTATION_TYPES } from './annotationOverlay.ts'

import type { Annotation, AnnotationAnchor } from './annotationOverlay.ts'

const ANCHOR_KEYS = new Set(
  Object.keys({
    selector: 0,
    text: 0,
    graphNode: 0,
    hLoc: 0,
    vLoc: 0,
    view: 0,
    trackId: 0,
    loc: 0,
    fracY: 0,
    alignX: 0,
    alignY: 0,
    dx: 0,
    dy: 0,
    fracX: 0,
  } satisfies Record<keyof AnnotationAnchor, 0>),
)

function unknownAnchorKeys(a: Annotation) {
  return [a.anchor, a.fromAnchor].flatMap(anchor =>
    Object.keys(anchor ?? {}).filter(k => !ANCHOR_KEYS.has(k)),
  )
}

const isNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n)

function missing(a: Annotation) {
  const placed = !!a.anchor || (isNumber(a.x) && isNumber(a.y))
  switch (a.type) {
    case 'arrow': {
      const head = !!a.anchor || isNumber(a.to?.x)
      const tail = !!a.fromAnchor || isNumber(a.from?.x)
      return head && tail ? undefined : 'an arrow needs a head and a tail'
    }
    case 'box':
      return !!a.anchor || (placed && isNumber(a.width) && isNumber(a.height))
        ? undefined
        : 'a box needs an anchor or x, y, width and height'
    case 'circle':
      return placed ? undefined : 'a circle needs an anchor or x and y'
    case 'text':
      return a.text && placed
        ? undefined
        : 'a text needs text and an anchor or x and y'
    case 'legend':
      return a.entries?.length && placed
        ? undefined
        : 'a legend needs entries and an anchor or x and y'
    case 'trapezoid':
      return a.anchor && a.fromAnchor
        ? undefined
        : 'a trapezoid needs both anchor and fromAnchor'
    default:
      return `type "${a.type as string}" is not one of ${ANNOTATION_TYPES.join(', ')}`
  }
}

/**
 * Throw for each callout the overlay would draw nothing for, or draw at the
 * page origin, so a spec fails before a browser launches rather than shipping a
 * figure with the callout missing.
 */
export function assertValidAnnotations(annotations: Annotation[]) {
  const problems = (annotations as (Annotation | null)[]).flatMap((a, i) => {
    const unknown = a ? unknownAnchorKeys(a) : []
    const why =
      unknown.length > 0
        ? `anchor key(s) ${unknown.join(', ')} not recognized; the keys are ${[...ANCHOR_KEYS].join(', ')}`
        : a
          ? missing(a)
          : 'a callout must be an object'
    return why ? [`annotation ${i}: ${why}`] : []
  })
  if (problems.length > 0) {
    throw new Error(`invalid annotations: ${problems.join('; ')}`)
  }
}
