import { paintedColorEncoding } from '@jbrowse/display-kit/colorConfigSchema'
import { heldColorSlots } from '@jbrowse/display-kit/heldColorSlots'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import { cellHueOf, sameHueRead } from '../shared/cellHue.ts'
import { fadeCellColors } from './densityFade.ts'
import { colorKeysOf, paintCellColors } from './paintCells.ts'
import { mapPayloadRegions } from './payloadRegions.ts'
import { variantDataColorScales } from './variantLegend.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type {
  CellHue,
  CellHueRead,
  cellColorEncodingOf,
} from '../shared/cellHue.ts'
import type { VariantRowsField } from '../shared/constants.ts'
import type { KeyedVariants } from './keyedVariants.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/** What {@link cellHueInputViews} reads: the coloring and the parked field. */
export interface CellHueInputHost {
  colorSetting: ColorSetting
  colorEncoding: ReturnType<typeof cellColorEncodingOf>
  parkedColor: ColorSlots | undefined
}

/**
 * The painted `encoding.color` and what the worker reads for it, which the
 * display and a static export install alike.
 */
export function cellHueInputViews(self: CellHueInputHost) {
  const hueInput = stableIdentityComputed(() => ({
    encoding: paintedColorEncoding(self.colorEncoding),
    keptField: self.colorSetting.field || self.parkedColor?.field,
  }))
  return {
    /**
     * #getter
     * The painted `encoding.color` and the field kept beside it, which
     * `cellHue` resolves. Compared by value, so editing the key's title or
     * names repaints nothing.
     */
    get cellHueInput() {
      return hueInput.get()
    },
    /**
     * #getter
     * What the worker reads off each variant for the alt cells' hue,
     * apart from the loaded values a ramp follows.
     */
    get cellHueRead() {
      const { encoding, keptField } = hueInput.get()
      return cellHueOf(encoding, keptField).read
    },
  }
}

/** What {@link cellHueValuesReadViews} reads: the payload and the read. */
export interface CellHueValuesReadHost {
  cellData: CellDataResult | undefined
  cellHueRead: CellHueRead
}

export function cellHueValuesReadViews(self: CellHueValuesReadHost) {
  return {
    /**
     * #getter
     * Whether the held payload's color values were read for the current
     * `encoding.color`; one read for another paints as though it read
     * none.
     */
    get cellHueValuesRead() {
      return sameHueRead(self.cellData?.colorRead, self.cellHueRead)
    },
  }
}

/** What {@link cellHueViews} reads: the hue input, the payload and the rows. */
export interface CellHueHost extends CellHueValuesReadHost {
  cellHueInput: ReturnType<typeof cellHueInputViews>['cellHueInput']
  cellHueValuesRead: boolean
  rowsField: VariantRowsField
}

export function cellHueViews(self: CellHueHost) {
  return {
    /**
     * #getter
     * Where the alt cells' hue comes from: what the worker reads and how
     * the main thread paints it (`cellHueOf`), a ramp over the values
     * every fetched region read.
     */
    get cellHue() {
      const { encoding, keptField } = self.cellHueInput
      const { cellData } = self
      return cellHueOf(
        encoding,
        keptField,
        heldColorSlots(self, encoding),
        cellData && self.cellHueValuesRead
          ? Object.values(cellData.perRegionCellData).flatMap(
              d => d.colorValues,
            )
          : [],
      )
    },
    /**
     * #getter
     * How the held payload's alt cells paint (`paintCellColors`).
     */
    get cellPaintOptions() {
      return {
        phased: self.rowsField === 'haplotype',
        valuesRead: self.cellHueValuesRead,
      }
    },
  }
}

/** What {@link regionCellColorViews} reads: the payload, its hue and its fade. */
export interface RegionCellColorHost {
  cellData: CellDataResult | undefined
  cellHue: CellHue
  cellPaintOptions: { phased: boolean; valuesRead: boolean }
  regionRecordAlpha: ReadonlyMap<number, Float32Array | undefined>
}

export function regionCellColorViews(self: RegionCellColorHost) {
  return {
    /**
     * #getter
     * Each fetched region's cell colors through the current
     * `encoding.color`, faded where records share pixels. Apart from the
     * rows, so a reorder repaints nothing, and a recolor re-places nothing
     * and refetches nothing.
     */
    get regionCellColors() {
      const { cellData, cellHue, cellPaintOptions, regionRecordAlpha } = self
      return mapPayloadRegions(cellData, (data, index) =>
        fadeCellColors(
          paintCellColors(data, cellHue, cellPaintOptions),
          data.cellFeatureIndices,
          data.numCells,
          regionRecordAlpha.get(index),
        ),
      )
    },
  }
}

/** What {@link cellKeyViews} reads: the variants keyed and their hue. */
export interface CellKeyHost {
  keyedVariants: KeyedVariants
  cellHue: CellHue
  cellHueValuesRead: boolean
  showRecords: boolean
  recordsColorBySvClass: boolean
}

/** What the cells' key lists of the variants keyed. */
export function cellKeyViews(self: CellKeyHost) {
  return {
    /**
     * #getter
     * Whether a variant on screen painted a secondary-alt cell, which
     * keys the "Other alt allele" legend entry. Painted, not possible.
     */
    get hasSecondaryAlt() {
      return self.keyedVariants.hasSecondaryAlt
    },
    /**
     * #getter
     * Whether phase-set coloring painted an alt cell on screen whose
     * call names no phase set, which keys that cell's plain hue.
     */
    get hasAltWithoutPhaseSet() {
      return self.keyedVariants.hasAltWithoutPhaseSet
    },
    /**
     * #getter
     * Whether a variant on screen painted a black unphased cell (drives
     * the "Unphased" legend entry).
     */
    get hasUnphased() {
      return self.keyedVariants.hasUnphased
    },
    /**
     * #getter
     * Whether a variant on screen painted a no-call cell (drives the "No
     * call" legend entry).
     */
    get hasNoCall() {
      return self.keyedVariants.hasNoCall
    },
    /**
     * #getter
     * The cell scale's domain values painted on screen — the impact
     * tiers or SV classes the legend lists: every record's while the
     * records band paints them, which covers each alt cell's, else
     * those an alt cell was painted for.
     */
    get paintedDomain(): string[] {
      const { altColorValues, recordColorValues } = self.keyedVariants
      return self.cellHueValuesRead
        ? colorKeysOf(
            self.showRecords && !self.recordsColorBySvClass
              ? recordColorValues
              : altColorValues,
            self.cellHue,
          )
        : []
    },
  }
}

/** What {@link variantDataKeyViews} reads: the records' key and the cells'. */
export interface VariantDataKeyHost extends CellHueInputHost {
  recordsColorScales: ColorScale[]
  cellColorKeyed: boolean
  drawsGenotypeRows: boolean
  rowsField: VariantRowsField
  hasSecondaryAlt: boolean
  hasAltWithoutPhaseSet: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  paintedDomain: string[]
  cellHue: CellHue
}

/** What a variant display keys of its data, the row key apart. */
export function variantDataKeyViews(self: VariantDataKeyHost) {
  return {
    /**
     * #getter
     * The records band's SV classes and, while `cellColorKeyed`, the cell
     * coloring (`variantDataColorScales`): the display's `colorScales` less
     * the row color key.
     */
    get dataColorScales(): ColorScale[] {
      return variantDataColorScales({
        recordsColorScales: self.recordsColorScales,
        cellColorKeyed: self.cellColorKeyed,
        drawsGenotypeRows: self.drawsGenotypeRows,
        colorSetting: self.colorSetting,
        cells: () => ({
          rowsField: self.rowsField,
          hasSecondaryAlt: self.hasSecondaryAlt,
          hasAltWithoutPhaseSet: self.hasAltWithoutPhaseSet,
          hasUnphased: self.hasUnphased,
          hasNoCall: self.hasNoCall,
          paintedDomain: self.paintedDomain,
          color: self.colorEncoding,
          colorSlots: heldColorSlots(self, self.colorEncoding),
          ramp: self.cellHue.ramp,
        }),
      })
    },
  }
}
