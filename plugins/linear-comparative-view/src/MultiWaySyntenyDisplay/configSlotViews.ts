import { getConf, setConf } from '@jbrowse/core/configuration'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { persistTrackConfigNow } from '@jbrowse/core/util/mstUtils'
import {
  colorEncodingOf,
  colorFieldOf,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { colorPaintOf } from '@jbrowse/synteny-core'

import { laneLayersPx } from './laneLayers.ts'
import { geneLabelRowPx } from './laneStack.ts'
import { paintedRibbonColor } from './ribbonColorConfigSchema.ts'

import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { GeneColorSettings } from './geneColor.ts'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type {
  LodMode,
  RibbonInterpolation,
  SyntenyColorPaint,
} from '@jbrowse/synteny-core'

export interface ConfigSlotSelf extends IStateTreeNode {
  configuration: Instance<MultiWaySyntenyDisplayConfigModel>
}

export function configSlotViews(self: ConfigSlotSelf) {
  return {
    /** #getter */
    get resolution(): LodMode {
      return getConf(self, ['data', 'resolution'])
    },
    /** #getter */
    get ribbonColor(): string {
      return paintedRibbonColor(
        colorSnapshotOf(self.configuration.ribbons.encoding.color),
      ).value
    },
    /**
     * #getter
     * `rows.kept` as a choice: undefined while it names no lane
     */
    get laneChoice(): readonly string[] | undefined {
      const kept: readonly string[] = getConf(self, ['rows', 'kept'])
      return kept.length ? kept : undefined
    },
    /** #getter */
    get ribbonColorField(): string | undefined {
      return paintedRibbonColor(
        colorSnapshotOf(self.configuration.ribbons.encoding.color),
      ).field
    },
    /** #getter */
    get ribbonColorDomain(): string[] {
      return getConf(self, ['ribbons', 'encoding', 'color', 'scale', 'domain'])
    },
    /** #getter */
    get ribbonPaint(): SyntenyColorPaint {
      return colorPaintOf(self.configuration.ribbons.encoding.color)
    },
    /** #getter */
    get hideUnlabelled(): boolean {
      return getConf(self, 'hideUnlabelled')
    },
    /**
     * #getter
     * The curve every ribbon side takes, `ribbons.mark.interpolate`.
     */
    get interpolate(): RibbonInterpolation {
      return getConf(self, ['ribbons', 'mark', 'interpolate'])
    },
    /** #getter */
    get showLaneTicks(): boolean {
      return getConf(self, 'showLaneTicks')
    },
    /** #getter */
    get splitStrands(): boolean {
      return getConf(self, 'splitStrands')
    },
    /** #getter */
    get showGeneLabels(): boolean {
      return getConf(self, ['labels', 'name', 'show'])
    },
    /**
     * #getter
     * `labels.name.field`: a field or a jexl expression, empty for no name
     */
    get geneTextField(): string {
      return getConf(self, ['labels', 'name', 'field'])
    },
    /** #getter */
    get inlineLaneNames(): boolean {
      return getConf(self, 'inlineLaneNames')
    },
    /** #getter */
    get geneLabelPx() {
      return geneLabelRowPx(getConf(self, ['labels', 'name', 'show']))
    },
    /** #getter */
    get laneLayerHeights(): number[] {
      return self.configuration.laneLayers.map(layer => layer.height)
    },
    /** #getter */
    get layerPx() {
      return laneLayersPx(this.laneLayerHeights)
    },
    /** #getter */
    get geneColorSettings(): GeneColorSettings {
      return {
        color: colorSnapshotOf(self.configuration.encoding.color),
        utrColor: self.configuration.utrColor,
      }
    },
    /** #getter */
    get geneColorEncoding() {
      return colorEncodingOf(this.geneColorSettings.color)
    },
    /**
     * #getter
     * undefined while `encoding.color.value` paints
     */
    get geneColorField(): string | undefined {
      return colorFieldOf(this.geneColorEncoding)?.field
    },
    /**
     * #getter
     * the constant `encoding.color.value` holds, undefined for none or a
     * `jexl:` one
     */
    get geneSolidColor(): string | undefined {
      const raw = this.geneColorSettings.color.value
      return raw !== undefined && !isJexl(raw) ? raw : undefined
    },
  }
}

export function configSlotActions(self: ConfigSlotSelf) {
  return {
    /**
     * #action
     * takes the whole pinned order, empty meaning densest-first; merge a
     * partial one with `mergeDomain` first
     */
    setDomain(domain: string[]) {
      setConf(self, ['rows', 'sort'], domain)
      persistTrackConfigNow(self)
    },
    /** #action */
    setRibbonColorDomain(domain: string[]) {
      setConf(self, ['ribbons', 'encoding', 'color', 'scale', 'domain'], domain)
    },
    /** #action */
    setHideUnlabelled(flag: boolean) {
      setConf(self, 'hideUnlabelled', flag)
    },
    /** #action */
    setInterpolate(interpolate: RibbonInterpolation) {
      setConf(self, ['ribbons', 'mark', 'interpolate'], interpolate)
    },
    /** #action */
    setShowLaneTicks(flag: boolean) {
      setConf(self, 'showLaneTicks', flag)
    },
    /** #action */
    setSplitStrands(flag: boolean) {
      setConf(self, 'splitStrands', flag)
    },
    /** #action */
    setInlineLaneNames(flag: boolean) {
      setConf(self, 'inlineLaneNames', flag)
    },
    /** #action */
    setShowGeneLabels(flag: boolean) {
      setConf(self, ['labels', 'name', 'show'], flag)
    },
    /** #action */
    setGeneTextField(field: string) {
      setConf(self, ['labels', 'name', 'field'], field)
    },
    /** #action */
    setResolution(mode: LodMode) {
      setConf(self, ['data', 'resolution'], mode)
    },
  }
}
