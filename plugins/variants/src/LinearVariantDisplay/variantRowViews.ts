import { getConf } from '@jbrowse/core/configuration'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import {
  expandPhasedRows,
  finerHaplotypeRows,
  haplotypeRowParent,
} from '../shared/getSources.ts'

import type { VariantRowsField } from '../shared/constants.ts'
import type { ProcessedSource } from '../shared/types.ts'
import type { LinearVariantDisplayConfigModel } from './configSchema.ts'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { RowBanding, RowParent } from '@jbrowse/tree-sidebar/arrangeRows'

/** What {@link variantRowConfigViews} reads: the display's config. */
export interface VariantRowConfigHost {
  configuration: Instance<LinearVariantDisplayConfigModel>
}

/**
 * The variant display's row settings as its config writes them, which the
 * display and a static export install alike.
 */
export function variantRowConfigViews(self: VariantRowConfigHost) {
  return {
    /**
     * #getter
     */
    get rowsField(): VariantRowsField {
      return getConf(self, ['rows', 'field'])
    },
    /**
     * #getter
     * The `facet` object as written: the sample-metadata attribute whose
     * values band the rows, and the band order; undefined leaves the
     * existing order alone.
     */
    get facet(): FacetSetting | undefined {
      return facetSettingOf({
        field: getConf(self, ['facet', 'field']),
        sort: getConf(self, ['facet', 'sort']),
      })
    },
  }
}

/** What {@link variantRowHookViews} reads: the row settings and the ploidies. */
export interface VariantRowHookHost {
  rowsField: VariantRowsField
  facet: FacetSetting | undefined
  samplePloidy: Readonly<Record<string, number>> | undefined
  rowSort: string[]
  rowFocus: readonly string[] | undefined
  discoveredRows: ProcessedSource[]
}

/**
 * The `TreeSidebarMixin` hooks a variant display answers for its sample and
 * haplotype rows, which the display and a static export install over the same
 * row views.
 */
export function variantRowHookViews(self: VariantRowHookHost) {
  const finer = stableIdentityComputed(() =>
    finerHaplotypeRows({
      rows: self.discoveredRows,
      ploidy: self.samplePloidy,
      domain: [...self.rowSort, ...(self.rowFocus ?? [])],
    }),
  )
  return {
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: never, since the cells paint by genotype
     * and a row's color shows only on its label bar.
     */
    get rowColorPaintsMarks(): boolean {
      return false
    },
    /**
     * #method
     * `TreeSidebarMixin`'s hook: a haplotype row refines its sample, read
     * off the row's own `sampleName` and `HP`, so an order, a label, a
     * tint or a focus written against a sample reaches each of its
     * haplotypes, a label as `Mother HP1`; a haploid sample's one row
     * takes the sample's label alone.
     */
    rowParent(row: ProcessedSource): RowParent | undefined {
      return haplotypeRowParent(row)
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the `facet` bands the rows by a samplesTsv
     * attribute.
     */
    get rowBanding(): RowBanding | undefined {
      return self.facet
    },
    /**
     * #method
     * `TreeSidebarMixin`'s hook: phased mode draws a row per haplotype,
     * once `samplePloidy` lands or the order names them.
     */
    expandRows(rows: ProcessedSource[]): ProcessedSource[] {
      return self.rowsField === 'haplotype'
        ? expandPhasedRows({
            rows,
            ploidy: self.samplePloidy,
            domain: self.rowSort,
          })
        : rows
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the haplotype rows phased mode draws,
     * or would, so an order or a focus naming a haplotype reaches a
     * sample row standing for it: in sample mode, a sample ranking at
     * its first haplotype entry, and in phased mode before the ploidy
     * lands. The same array while a write names no new haplotype, so a
     * focus or a reorder re-arranges nothing for it.
     */
    get finerRows(): ProcessedSource[] {
      return finer.get()
    },
  }
}
