import type { GetCellDataArgs } from '../VariantRPC/types.ts'
import type { CellHueRead } from '../shared/cellHue.ts'
import type { RecordFieldReads } from '../shared/recordFields.ts'
import type { Trio } from '../shared/trios.ts'
import type { TransmissionEntry } from '@jbrowse/core/assemblyManager'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

/** What {@link variantRpcPropsViews} reads: every setting the worker is sent. */
export interface VariantRpcPropsHost extends Pick<
  GetCellDataArgs,
  'sampleFilter' | 'siteFilter' | 'filters' | 'rowsField'
> {
  variantLayout: GetCellDataArgs['layout']
  cellHueRead: CellHueRead
  recordFieldReads: RecordFieldReads
  atGenomicPositions: boolean
  showReference: boolean
  trios: Trio[]
  mendelianFilter: FieldPredicate[]
  transmissionEntries: TransmissionEntry[]
}

/**
 * The settings a `MultiSampleVariantGetCellData` fetch sends, which the
 * display and the tables' hosts all install, so a table fetches what the
 * display fetches.
 */
export function variantRpcPropsViews(self: VariantRpcPropsHost) {
  return {
    /**
     * #method
     * Only what the worker reads, and nothing fetch-derived; a change
     * refetches. `showReference` is one at genomic positions only: columns
     * draw every reference cell. `transmissionEntries`, the assembly's
     * `transmission`, keys the fetch only while a trio is sent; it is
     * resolved per region where the regions are known and sent as
     * `transmission`.
     */
    rpcProps() {
      return {
        layout: self.variantLayout,
        sampleFilter: self.sampleFilter,
        siteFilter: self.siteFilter,
        filters: self.filters,
        rowsField: self.rowsField,
        color: self.cellHueRead,
        recordFields: self.recordFieldReads,
        showReference: !self.atGenomicPositions || self.showReference,
        trios: self.trios,
        mendelianFilter: self.mendelianFilter,
        ...(self.trios.length > 0
          ? { transmissionEntries: self.transmissionEntries }
          : {}),
      }
    },
  }
}
