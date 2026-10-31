import { getConf, setConf } from '@jbrowse/core/configuration'
import { withPreset } from '@jbrowse/core/util/colorScale'
import {
  colorEncodingOf,
  colorForScheme,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { identityLut } from '../LinearMafRenderer/identity.ts'
import { refNameRankColors } from './components/refNameRanks.ts'
import { MAF_FIELD_PRESETS } from './mafColorConfigSchema.ts'

import type { LinearMafDisplayConfigModel } from './configSchema.ts'
import type { ConservationUnit } from './conservationUnits.ts'
import type { MafBasesField, MafColorField, MafYField } from './rowPlan.ts'
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
      return getConf(self, ['alignments', 'mark', 'height', 'band'])
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
    get colorField(): MafColorField | undefined {
      return getConf(self, ['encoding', 'color', 'field'])
    },
    /**
     * #getter
     * `encoding.color.value`, the constant fill, read alone so a key edit
     * re-encodes nothing.
     */
    get colorValue(): string | undefined {
      return getConf(self, ['encoding', 'color', 'value']) || undefined
    },
    /**
     * #getter
     * `encoding.color` as written, with the key's names and title.
     */
    get colorSetting(): ColorSetting & { value: string | undefined } {
      const setting = colorSnapshotOf(self.configuration.encoding.color)
      return {
        ...setting,
        field: setting.field ?? '',
        value: setting.value || undefined,
        scale: { ...setting.scale, type: undefined },
      }
    },
    /**
     * #getter
     * `encoding.color` as it paints, through its field's preset: one
     * scale per field, so `scale.type` is never written. A string is the
     * constant, and undefined the theme's.
     */
    get colorEncoding(): FieldColorEncoding | string | undefined {
      return colorEncodingOf(this.colorSetting, MAF_FIELD_PRESETS)
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
     * `encoding.color` while it paints identity along a ramp, else
     * undefined.
     */
    get identityRamp() {
      const color = this.colorEncoding
      return typeof color === 'object' &&
        color.field === 'identity' &&
        color.scale === 'linear'
        ? color
        : undefined
    },
    /**
     * #getter
     * The identity ramp's packed color at each hundredth, the default
     * ramp unless `encoding.color` is identity. One array per ramp, so a
     * color edit that leaves the ramp alone re-encodes nothing.
     */
    get identityColors(): Uint32Array {
      return identityLut(this.identityRamp)
    },
    /**
     * #getter
     * The named ramp identity paints along, the preset's where
     * `encoding.color` writes none or is not identity, and none while a
     * written `scale.range` paints instead.
     */
    get colorScheme(): ColorSchemeName | undefined {
      const ramp = this.identityRamp
      return ramp === undefined
        ? MAF_FIELD_PRESETS.identity.scale.scheme
        : ramp.range?.length
          ? undefined
          : (ramp.scheme ?? MAF_FIELD_PRESETS.identity.scale.scheme)
    },
    /**
     * #getter
     * Each source sequence rank's packed color, the written
     * `encoding.color.scale.range`'s while `encoding.color` is refNameRank.
     * One array per range, as `identityColors`.
     */
    get refNameRankPalette(): readonly number[] {
      const color = this.colorEncoding
      return refNameRankColors(
        typeof color === 'object' &&
          color.field === 'refNameRank' &&
          color.scale === 'ordinal'
          ? color.range
          : undefined,
      )
    },
    /**
     * #getter
     */
    get yField(): MafYField | undefined {
      return getConf(self, ['encoding', 'y', 'field'])
    },
    /**
     * #getter
     */
    get showMismatches(): boolean {
      return getConf(self, ['alignments', 'mismatches', 'show'])
    },
    /**
     * #getter
     * The per-position layer's field while `alignments.bases.show` is on.
     */
    get basesField(): MafBasesField | undefined {
      return getConf(self, ['alignments', 'bases', 'show'])
        ? getConf(self, ['alignments', 'bases', 'encoding', 'color', 'field'])
        : undefined
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
      setConf(self, ['alignments', 'mark', 'height', 'band'], n)
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
      setConf(self, ['encoding', 'y', 'field'], field)
    },
    /**
     * #action
     */
    setShowMismatches(arg: boolean) {
      setConf(self, ['alignments', 'mismatches', 'show'], arg)
    },
    /**
     * #action
     * Turn the per-position layer on with `field`, or off with undefined,
     * keeping the field it last painted.
     */
    setBasesField(field: MafBasesField | undefined) {
      if (field !== undefined) {
        setConf(
          self,
          ['alignments', 'bases', 'encoding', 'color', 'field'],
          field,
        )
      }
      setConf(self, ['alignments', 'bases', 'show'], field !== undefined)
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
