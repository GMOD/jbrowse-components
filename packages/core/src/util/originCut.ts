const TAIL_SUFFIX = '-origin'

/**
 * The id of the piece of a feature lying past a circular sequence's origin,
 * the feature cut there and `id` the piece before it.
 */
export function originTailId(id: string) {
  return `${id}${TAIL_SUFFIX}`
}

/** The id of the piece before the origin, when `id` names the one past it. */
export function originHeadId(id: string) {
  return id.endsWith(TAIL_SUFFIX) ? id.slice(0, -TAIL_SUFFIX.length) : undefined
}
