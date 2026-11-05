import { getConf } from '@jbrowse/core/configuration'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { colorSnapshotOf } from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import { cellColorEncodingOf } from '../shared/cellHue.ts'
import {
  expandPhasedRows,
  finerHaplotypeRows,
  haplotypeRowParent,
  resolveSampleName,
} from '../shared/getSources.ts'

import type { VariantRowsField } from '../shared/constants.ts'
import type { ProcessedSource, Source } from '../shared/types.ts'
import type { LinearVariantDisplayConfigModel } from './configSchema.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
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

/** What {@link variantGenotypesShowViews} reads: the config and the samples. */
export interface VariantGenotypesShowHost extends VariantRowConfigHost {
  adapterSamples: Source[] | undefined
}

/** Whether a variant display reads genotypes, `genotypes.show` resolved. */
export function variantGenotypesShowViews(self: VariantGenotypesShowHost) {
  return {
    /**
     * #getter
     * Whether `genotypes.show` is written, by config or by the menu.
     */
    get genotypesShowWritten(): boolean {
      return getConf(self, ['genotypes', 'show']) !== undefined
    },
    /**
     * #getter
     * What an unset `genotypes.show` resolves to: every VCF but a
     * one-sample one draws its rows.
     */
    get genotypesShowDefault(): boolean {
      return self.adapterSamples?.length !== 1
    },
    /**
     * #getter
     * `genotypes.show`: whether the display reads genotypes and draws a
     * row per sample. Unset, `genotypesShowDefault`.
     */
    get showGenotypes(): boolean {
      return getConf(self, ['genotypes', 'show']) ?? this.genotypesShowDefault
    },
  }
}

/** The cell coloring a variant display's config writes. */
export function variantColorSettingViews(self: VariantRowConfigHost) {
  return {
    /**
     * #getter
     * `encoding.color` as written, `value` raw: a `jexl:` callback is the
     * worker's to evaluate per variant.
     */
    get colorSetting(): ColorSetting {
      return colorSnapshotOf(self.configuration.encoding.color)
    },
    /**
     * #getter
     * What the alt cells' hue paints: undefined for the genotype colors,
     * a CSS color or `jexl:` callback, or a field through its ordinal or
     * threshold scale (`shared/cellHue.ts`).
     */
    get colorEncoding() {
      return cellColorEncodingOf(this.colorSetting)
    },
  }
}

/** What {@link variantGenotypeRowViews} reads: the samples and their toggle. */
export interface VariantGenotypeRowHost extends VariantGenotypesShowHost {
  hostHeight: number | undefined
  genotypesShowWritten: boolean
  showGenotypes: boolean
}

/**
 * Whether a variant display draws its genotype rows, or the records band
 * alone, and where its variants sit.
 */
export function variantGenotypeRowViews(self: VariantGenotypeRowHost) {
  return {
    // #region sameBlockThis
    /**
     * #getter
     * Whether a circular view's ring hosts the display (`hostHeight`).
     * The ring samples one canvas of its strip, the records band's.
     */
    get inRing(): boolean {
      return self.hostHeight !== undefined
    },
    /**
     * #getter
     * Whether the records band is the display, every record the filter
     * admits, sized by `heightMode` and lettered as a feature track: a VCF
     * with no samples, a one-sample call set whose row nobody asked for,
     * or a ring, which draws one canvas and so the records alone.
     */
    get recordsOnly(): boolean {
      const sampleCount = self.adapterSamples?.length
      return (
        sampleCount === 0 ||
        (sampleCount === 1 && !self.genotypesShowWritten) ||
        this.inRing
      )
    },
    /**
     * #getter
     * Whether genotype rows draw: `genotypes.show`, on a VCF with samples.
     * Hidden, the rows take no height and the records band is the track.
     */
    get drawsGenotypeRows(): boolean {
      return self.showGenotypes && !this.recordsOnly
    },
    // #endregion
    /**
     * #getter
     * Whether each variant draws at its genomic span, or as one of a row
     * of equal-width columns tied to its position by a connector line:
     * the `variantLayout` slot while genotype rows draw. Columns lay out
     * rows, so with none (no samples, or `genotypes.show` off) the
     * records band draws at genomic positions, and the slot's columns
     * come back with the rows.
     */
    get variantLayout(): 'genomic' | 'columns' {
      return this.drawsGenotypeRows ? getConf(self, 'variantLayout') : 'genomic'
    },
    /**
     * #getter
     */
    get atGenomicPositions(): boolean {
      return this.variantLayout === 'genomic'
    },
  }
}

/** What {@link variantDrawnRowViews} reads: the samples and whether rows draw. */
export interface VariantDrawnRowHost extends VariantGenotypesShowHost {
  drawsGenotypeRows: boolean
}

/**
 * The `TreeSidebarMixin` hooks that gate a variant display's rows on
 * `drawsGenotypeRows`, which the display and a static export install alike.
 */
export function variantDrawnRowViews(self: VariantDrawnRowHost) {
  return {
    /**
     * #getter
     * `rows.kept` while genotype rows draw; with none no focus applies,
     * so no "Showing N of M rows" chip takes a line over the records band.
     * The focus comes back with the rows. Overrides
     * `TreeSidebarMixin.rowFocus`.
     */
    get rowFocus(): readonly string[] | undefined {
      const kept = getConf(self, ['rows', 'kept'])
      return self.drawsGenotypeRows && kept.length ? kept : undefined
    },
    /**
     * #getter
     * `rows.filter` while genotype rows draw, as `rowFocus` reads
     * `rows.kept`. Overrides `TreeSidebarMixin.rowFilter`.
     */
    get rowFilter(): readonly FieldPredicate[] {
      return self.drawsGenotypeRows
        ? predicatesOf(self.configuration.rows.filter)
        : []
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the adapter's samples as rows, each
     * answering to its sample name, a samplesTsv `color` column the row's
     * own color. Empty while no row draws.
     */
    get discoveredRows(): ProcessedSource[] {
      const samples = self.drawsGenotypeRows ? self.adapterSamples : undefined
      return (samples ?? []).map(source => ({
        ...source,
        sampleName: resolveSampleName(source),
      }))
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
