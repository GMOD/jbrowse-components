import { getConf, setConf } from '@jbrowse/core/configuration'
import { withPreset } from '@jbrowse/core/util/colorScale'
import {
  colorEncodingOf,
  colorForScheme,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { identityLut } from '../LinearMafRenderer/identity.ts'
import { sourceChromRankColors } from './components/drawSourceChrom.ts'
import { MAF_FIELD_PRESETS } from './mafColorConfigSchema.ts'

import type { LinearMafDisplayConfigModel } from './configSchema.ts'
import type { ConservationUnit } from './conservationUnits.ts'
import type { MafColorField, MafYField } from './rowRenderings.ts'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type {
  ColorSetting,
  FieldColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

export interface ConfigSlotSelf extends IStateTreeNode {
  configuration: Instance<LinearMafDisplayConfigModel>
}

export function configSlotViews(self: ConfigSlotSelf) {
  return {
    /**
     * #getter
     */
    get rowProportion(): number {
      return getConf(self, ['alignments', 'rowProportion'])
    },
    /**
     * #getter
     */
    get showCoverage(): boolean {
      return getConf(self, ['coverage', 'show'])
    },
    /**
     * #getter
     */
    get showAlignments(): boolean {
      return getConf(self, ['alignments', 'show'])
    },
    /**
     * #getter
     */
    get coverageHeight(): number {
      return getConf(self, ['coverage', 'height'])
    },
    /**
     * #getter
     */
    get coverageMinAlleleFraction(): number {
      return getConf(self, ['coverage', 'minAlleleFraction'])
    },
    /**
     * #getter
     */
    get showInterbaseIndicators(): boolean {
      return getConf(self, ['coverage', 'interbase', 'show'])
    },
    /**
     * #getter
     */
    get showConservation(): boolean {
      return getConf(self, ['conservation', 'show'])
    },
    /**
     * #getter
     */
    get conservationHeight(): number {
      return getConf(self, ['conservation', 'height'])
    },
    /**
     * #getter
     */
    get conservationUnit(): ConservationUnit {
      return getConf(self, ['conservation', 'unit'])
    },
    /**
     * #getter
     */
    get colorField(): MafColorField {
      return getConf(self, ['encoding', 'color', 'field'])
    },
    /**
     * #getter
     * `encoding.color` as written, with the key's names and title.
     */
    get colorSetting(): ColorSetting & { value: undefined } {
      const setting = colorSnapshotOf(self.configuration.encoding.color)
      return {
        ...setting,
        value: undefined,
        scale: { ...setting.scale, type: undefined },
      }
    },
    /**
     * #getter
     * `encoding.color` as it paints, through its field's preset: one
     * scale per field, so `scale.type` is never written.
     */
    get colorEncoding(): FieldColorEncoding {
      return colorEncodingOf(this.colorSetting, MAF_FIELD_PRESETS)!
    },
    /**
     * #getter
     * The key's heading: the written `legend.title`, else the field's own.
     */
    get colorKeyTitle(): string {
      return withPreset(this.colorSetting, MAF_FIELD_PRESETS).legend.title ?? ''
    },
    /**
     * #getter
     * The identity ramp's packed color at each hundredth, the default
     * ramp unless `encoding.color` is identity. One array per ramp, so a
     * color edit that leaves the ramp alone re-encodes nothing.
     */
    get identityColors(): Uint32Array {
      const color = this.colorEncoding
      return identityLut(
        color.field === 'identity' && color.scale === 'linear'
          ? color
          : undefined,
      )
    },
    /**
     * #getter
     * The named ramp identity paints along, the preset's where
     * `encoding.color` writes none or is not identity, and none while a
     * written `scale.range` paints instead.
     */
    get colorScheme(): ColorSchemeName | undefined {
      const color = this.colorEncoding
      return color.field !== 'identity' || color.scale !== 'linear'
        ? MAF_FIELD_PRESETS.identity.scale.scheme
        : color.range?.length
          ? undefined
          : (color.scheme ?? MAF_FIELD_PRESETS.identity.scale.scheme)
    },
    /**
     * #getter
     * Each source chromosome rank's packed color, the written
     * `encoding.color.scale.range`'s while `encoding.color` is chromosome.
     * One array per range, as `identityColors`.
     */
    get sourceChromColors(): readonly number[] {
      const color = this.colorEncoding
      return sourceChromRankColors(
        color.field === 'chromosome' && color.scale === 'ordinal'
          ? color.range
          : undefined,
      )
    },
    /**
     * #getter
     */
    get yField(): MafYField | undefined {
      return getConf(self, 'y')
    },
    /**
     * #getter
     */
    get showFrames(): boolean {
      return getConf(self, ['alignments', 'frames', 'show'])
    },
    /**
     * #getter
     */
    get showInversions(): boolean {
      return getConf(self, ['alignments', 'inversions', 'show'])
    },
    /**
     * #getter
     */
    get showReferenceRow(): boolean {
      return getConf(self, ['alignments', 'reference', 'show'])
    },
  }
}

export function configSlotActions(self: ConfigSlotSelf) {
  return {
    /**
     * #action
     */
    setRowProportion(n: number) {
      setConf(self, ['alignments', 'rowProportion'], n)
    },
    /**
     * #action
     * Paint identity along a named ramp, clearing a written `scale.range`,
     * which would win over it.
     */
    setColorScheme(scheme: ColorSchemeName) {
      setConf(
        self,
        ['encoding', 'color'],
        colorForScheme(
          getSnapshot<ColorSlots>(self.configuration.encoding.color),
          scheme,
          MAF_FIELD_PRESETS.identity.scale.scheme,
        ),
      )
    },
    /**
     * #action
     */
    setShowCoverage(arg: boolean) {
      setConf(self, ['coverage', 'show'], arg)
    },
    /**
     * #action
     */
    setCoverageMinAlleleFraction(fraction: number) {
      setConf(self, ['coverage', 'minAlleleFraction'], fraction)
    },
    /**
     * #action
     */
    setShowInterbaseIndicators(arg: boolean) {
      setConf(self, ['coverage', 'interbase', 'show'], arg)
    },
    /**
     * #action
     */
    setShowAlignments(arg: boolean) {
      setConf(self, ['alignments', 'show'], arg)
    },
    /**
     * #action
     */
    setShowConservation(arg: boolean) {
      setConf(self, ['conservation', 'show'], arg)
    },
    /**
     * #action
     */
    setConservationUnit(arg: ConservationUnit) {
      setConf(self, ['conservation', 'unit'], arg)
    },
    /**
     * #action
     */
    setYField(field: MafYField | undefined) {
      setConf(self, 'y', field)
    },
    /**
     * #action
     */
    setShowFrames(arg: boolean) {
      setConf(self, ['alignments', 'frames', 'show'], arg)
    },
    /**
     * #action
     */
    setShowInversions(arg: boolean) {
      setConf(self, ['alignments', 'inversions', 'show'], arg)
    },
    /**
     * #action
     */
    setShowReferenceRow(arg: boolean) {
      setConf(self, ['alignments', 'reference', 'show'], arg)
    },
  }
}
