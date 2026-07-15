import type { HoverHighlight } from './stateModelFactory.ts'

/**
 * Genomic position for a display column, or `undefined` for inserted columns
 * (the worker's `-1` sentinel) and out-of-range indices. Single source for the
 * sentinel semantics shared by the tooltip and the hover highlight.
 */
export function genomePosAt(colToGenomePos: number[], col: number | undefined) {
  const pos = col === undefined ? undefined : colToGenomePos[col]
  return pos !== undefined && pos >= 0 ? pos : undefined
}

/** Build the cross-display hover highlight for a hovered column, or
 *  `undefined` when the column has no reference base. */
export function colToHighlight(
  col: number | undefined,
  colToGenomePos: number[],
  region: { refName: string; assemblyName: string } | undefined,
): HoverHighlight | undefined {
  const pos = genomePosAt(colToGenomePos, col)
  return pos !== undefined && region
    ? {
        refName: region.refName,
        start: pos,
        end: pos + 1,
        assemblyName: region.assemblyName,
      }
    : undefined
}
