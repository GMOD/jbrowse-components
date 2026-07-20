// Resolve each region-local partition value to its global display-row index
// (undefined = a row not currently shown), so the per-feature lookup in the hot
// loop is an array index rather than a string-keyed Map.get. Shared by the GPU
// encode (multiRowInstanceBuffer) and the Canvas2D draw (drawMultiRowBlocks) so
// the two render paths can't drift.
export function resolveLocalRowIndices(
  partitionValues: string[],
  rowIndexByValue: ReadonlyMap<string, number>,
): (number | undefined)[] {
  return partitionValues.map(v => rowIndexByValue.get(v))
}

// Whether a feature's baked per-feature color is a toggled-off legend category,
// so it should be dropped from both render paths and the hit-test. Shared by the
// GPU encode, the Canvas2D draw, and the hit-test so they can't drift on the
// hide axis. The test only applies to rows painting the per-feature color: a row
// with a per-row override (dialog / sampleColorMap / palette) paints the
// override color, which the legend never lists (see buildColorLegend's
// `rowColorsByIndex[row] === undefined` scoping), so a baked color that happens
// to match a hidden category must not hide it.
export function isFeatureColorHidden(
  rowIndex: number,
  bakedColor: number,
  hiddenColors: ReadonlySet<number> | undefined,
  rowColorsByIndex: readonly (number | undefined)[] | undefined,
): boolean {
  return (
    rowColorsByIndex?.[rowIndex] === undefined &&
    (hiddenColors?.has(bakedColor) ?? false)
  )
}
