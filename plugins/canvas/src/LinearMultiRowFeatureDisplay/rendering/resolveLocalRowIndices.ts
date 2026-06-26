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
