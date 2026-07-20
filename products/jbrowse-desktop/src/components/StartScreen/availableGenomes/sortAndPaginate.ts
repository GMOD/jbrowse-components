import type { Entry, GenomeColumn } from './getColumnDefinitions.tsx'
import type { Sorting } from './useGenomesTableState.ts'

// numeric:true so columns containing numbers (e.g. taxonomy IDs, accessions)
// order naturally (2 before 10) rather than lexically (10 before 2)
function defaultSort(a: Entry, b: Entry, col: GenomeColumn) {
  return col.sortFn
    ? col.sortFn(a, b)
    : (col.value?.(a) ?? '').localeCompare(col.value?.(b) ?? '', undefined, {
        numeric: true,
      })
}

export function sortAndPaginate({
  data,
  columns,
  sorting,
  pageIndex,
  pageSize,
}: {
  data: Entry[]
  columns: GenomeColumn[]
  sorting?: Sorting
  pageIndex: number
  pageSize: number
}) {
  const sortingCol = sorting
    ? columns.find(c => c.id === sorting.id)
    : undefined
  const dir = sorting?.desc ? -1 : 1
  const sortedData = sortingCol
    ? [...data].sort((a, b) => dir * defaultSort(a, b, sortingCol))
    : data

  // Clamp the page index during derivation so shrinking the result set (e.g.
  // removing favorites, resetting the favorites list) can never strand us on an
  // empty page, independent of whether a handler remembered to reset it.
  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const pageRows = sortedData.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  )
  return { pageRows, currentPage, totalRows: sortedData.length }
}
