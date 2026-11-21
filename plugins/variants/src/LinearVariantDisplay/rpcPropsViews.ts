import type { GetCellDataArgs } from '../VariantRPC/types.ts'
import type { CellHueRead } from '../shared/cellHue.ts'
import type { RecordFieldReads } from '../shared/recordFields.ts'

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
}

const NO_GENOTYPE_READS: Pick<
  GetCellDataArgs,
  'siteFilter' | 'rowsField' | 'showReference'
> = {
  siteFilter: [],
  rowsField: 'sample',
  showReference: false,
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
     * draw every reference cell. With no sample asked for the worker reads
     * no genotype, so the genotype settings are sent as constants.
     */
    rpcProps() {
      return {
        layout: self.variantLayout,
        sampleFilter: self.sampleFilter,
        filters: self.filters,
        color: self.cellHueRead,
        recordFields: self.recordFieldReads,
        ...(self.sampleFilter?.length === 0
          ? NO_GENOTYPE_READS
          : {
              siteFilter: self.siteFilter,
              rowsField: self.rowsField,
              showReference: !self.atGenomicPositions || self.showReference,
            }),
      }
    },
  }
}
