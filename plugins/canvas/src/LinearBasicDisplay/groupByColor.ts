// A track still on its default color, or already colored by this field,
// colors by the grouping too; a hand-picked color stays.
export function colorsWithGrouping(
  color: string | undefined,
  colorField: string,
  field: string | undefined,
) {
  return (
    (color === undefined && colorField === '') ||
    (colorField !== '' && colorField === field)
  )
}
