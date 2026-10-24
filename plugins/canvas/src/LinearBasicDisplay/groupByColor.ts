// A track still on its default color, or already colored by this field,
// colors by the grouping too; a hand-picked color stays.
export function colorsWithGrouping(
  color: string | undefined,
  colorField: string | undefined,
  field: string | undefined,
) {
  return (
    (color === undefined && colorField === undefined) ||
    (colorField !== undefined && colorField === field)
  )
}
