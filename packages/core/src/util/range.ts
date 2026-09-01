/**
 * fast low-level intersection of 2 coordinate ranges. assumes interbase coordinates.
 *
 * assumes `left <= right` for both ranges
 *
 * @returns array of [left, right], or [] if the ranges do not intersect. the choice of [] is because it allows destructuring array assignment without check for undefined return
 */
export function intersection2(
  left1: number,
  right1: number,
  left2: number,
  right2: number,
): [number, number] | [] {
  // this code is verbose because "if" statements are faster than Math.min and Math.max
  if (right1 > left2 && left1 < right2 && right2 - left2 && right1 - left1) {
    if (left1 > left2) {
      if (right1 < right2) {
        // 1     |-------|
        //     |------------|
        return [left1, right1]
      }
      // 2         |----|
      //      |------|
      return [left1, right2]
    }
    if (right1 < right2) {
      // 3  |-----|
      //       |------|
      return [left2, right1]
    }
    // 4     |------------|
    //         |-------|
    return [left2, right2]
  }
  return []
}

/**
 * Return whether 2 interbase coordinate ranges intersect.
 *
 * @param left1 -
 * @param right1 -
 * @param left2 -
 * @param right2 -
 *
 * @returns true if the two ranges intersect
 */
export function doesIntersect2(
  left1: number,
  right1: number,
  left2: number,
  right2: number,
) {
  return right1 > left2 && left1 < right2
}

/**
 * Compute the expanded fetch range a tabix adapter must "redispatch" to when
 * features found in a query extend past the requested window. Returns the union
 * of the query with the bounds of every line `expands` admits, or `undefined`
 * when nothing extends past the query (no redispatch needed).
 *
 * **A predicate, not a set of types**, because the useful question is not what a
 * record is called. The bound exists to reach a record's *children*, so what
 * disqualifies a record is having none — and in GFF3 that is answerable exactly,
 * from whether the record carries an `ID` for a `Parent` to reference. A type
 * blocklist can only ever approximate it, and it is the caller's format that
 * knows how: this file reads no column but the coordinates.
 *
 * Feature coordinates arrive interbase, matching the query: @gmod/tabix applies
 * the index's coordinate offset before invoking the line callback, so a GFF/GTF
 * line's 1-based start is already decremented by the time it gets here.
 *
 * Seeding the accumulator with the query bounds is what makes the result a
 * union rather than just the feature bounds. A redispatch narrower than the
 * original window would drop an excluded line that the first fetch found inside
 * the query but that falls outside the expanded range.
 */
export function calculateRedispatchRange<
  T extends { start: number; end: number },
>(
  features: T[],
  expands: (feature: T) => boolean,
  queryStart: number,
  queryEnd: number,
): { start: number; end: number } | undefined {
  let minStart = queryStart
  let maxEnd = queryEnd
  for (const feature of features) {
    if (expands(feature)) {
      if (feature.start < minStart) {
        minStart = feature.start
      }
      if (feature.end > maxEnd) {
        maxEnd = feature.end
      }
    }
  }
  return minStart < queryStart || maxEnd > queryEnd
    ? { start: minStart, end: maxEnd }
    : undefined
}
