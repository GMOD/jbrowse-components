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
    get showAllLetters(): boolean {
      return getConf(self, ['alignments', 'showAllLetters'])
    },
    /**
     * #getter
     */
    get showAsUpperCase(): boolean {
      return getConf(self, ['alignments', 'showAsUpperCase'])
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
      return getConf(self, ['coverage', 'showInterbaseIndicators'])
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
      return getConf(self, ['color', 'field'])
    },
    /**
     * #getter
     * The `color` object as written, with the key's labels and title.
     */
    get colorSetting(): ColorSetting & { value: undefined } {
      const { color } = self.configuration
      return {
        ...colorSnapshotOf(color),
        value: undefined,
        scale: undefined,
      }
    },
    /**
     * #getter
     * The `color` object as it paints, through its field's preset: one
     * scale per field, so `scale` is never written.
     */
    get colorEncoding(): FieldColorEncoding {
      return colorEncodingOf(this.colorSetting, MAF_FIELD_PRESETS)!
    },
    /**
     * #getter
     * The key's heading: the written `title`, else the field's own.
     */
    get colorKeyTitle(): string {
      return withPreset(this.colorSetting, MAF_FIELD_PRESETS).title ?? ''
    },
    /**
     * #getter
     * The identity ramp's packed color at each hundredth, the default
     * ramp unless `color` is identity. One array per ramp, so a color
     * edit that leaves the ramp alone re-encodes nothing.
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
     * The named ramp identity paints along, the preset's where `color`
     * writes none or is not identity, and none while a written `range`
     * paints instead.
     */
    get colorScheme(): ColorSchemeName | undefined {
      const color = this.colorEncoding
      return color.field !== 'identity' || color.scale !== 'linear'
        ? MAF_FIELD_PRESETS.identity.scheme
        : color.range?.length
          ? undefined
          : (color.scheme ?? MAF_FIELD_PRESETS.identity.scheme)
    },
    /**
     * #getter
     * Each source chromosome rank's packed color, `color.range`'s while
     * `color` is chromosome. One array per range, as `identityColors`.
     */
    get sourceChromColors(): readonly number[] {
      const color = this.colorEncoding
      return sourceChromRankColors(
        color.field === 'chromosome' && color.scale === 'categorical'
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
    get rowIdentityAutoZoom(): boolean {
      return getConf(self, 'rowIdentityAutoZoom')
    },
    /**
     * #getter
     */
    get showAnnotations(): boolean {
      return getConf(self, ['alignments', 'showAnnotations'])
    },
    /**
     * #getter
     */
    get showInversions(): boolean {
      return getConf(self, ['alignments', 'showInversions'])
    },
    /**
     * #getter
     */
    get showReferenceRow(): boolean {
      return getConf(self, 'showReferenceRow')
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
     */
    setShowAllLetters(f: boolean) {
      setConf(self, ['alignments', 'showAllLetters'], f)
    },
    /**
     * #action
     * Paint identity along a named ramp, clearing a written `range`, which
     * would win over it.
     */
    setColorScheme(scheme: ColorSchemeName) {
      setConf(
        self,
        'color',
        colorForScheme(
          getSnapshot(self.configuration.color),
          scheme,
          MAF_FIELD_PRESETS.identity.scheme,
        ),
      )
    },
    /**
     * #action
     */
    setShowAsUpperCase(arg: boolean) {
      setConf(self, ['alignments', 'showAsUpperCase'], arg)
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
      setConf(self, ['coverage', 'showInterbaseIndicators'], arg)
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
    setRowIdentityAutoZoom(arg: boolean) {
      setConf(self, 'rowIdentityAutoZoom', arg)
    },
    /**
     * #action
     */
    setShowAnnotations(arg: boolean) {
      setConf(self, ['alignments', 'showAnnotations'], arg)
    },
    /**
     * #action
     */
    setShowInversions(arg: boolean) {
      setConf(self, ['alignments', 'showInversions'], arg)
    },
    /**
     * #action
     */
    setShowReferenceRow(arg: boolean) {
      setConf(self, 'showReferenceRow', arg)
    },
  }
}
