import { getConf, setConf } from '@jbrowse/core/configuration'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { persistTrackConfigNow } from '@jbrowse/core/util/mstUtils'
import {
  colorEncodingOf,
  colorFieldOf,
  colorSnapshotOf,
  ordinalRange,
} from '@jbrowse/display-kit/colorConfigSchema'
import {
  colorPaintOf,
  hidesUnlabelled,
  opacitySnapshotOf,
  withHideUnlabelled,
} from '@jbrowse/synteny-core'

import { laneLayersPx } from './laneLayers.ts'
import { geneLabelRowPx } from './laneStack.ts'
import { paintedRibbonColor } from './ribbonColorConfigSchema.ts'

import type { MultiWaySyntenyDisplayConfigModel } from './configSchema.ts'
import type { GeneColorSettings } from './geneColor.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type {
  LodMode,
  RibbonInterpolation,
  SyntenyColorPaint,
  SyntenyOpacitySnapshot,
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
      return ribbonColorFieldOf(self)
    },
    /** #getter */
    get ribbonColorDomain(): string[] {
      return getConf(self, ['ribbons', 'encoding', 'color', 'scale', 'domain'])
    },
    /**
     * #getter
     * The colors a ribbon column's labels take in domain order: `scale.range`,
     * else `scale.scheme` sampled once per domain value
     */
    get ribbonColorRange(): readonly string[] {
      return ordinalRange(this.ribbonPaint)
    },
    /** #getter */
    get ribbonPaint(): SyntenyColorPaint {
      return colorPaintOf(self.configuration.ribbons.encoding.color)
    },
    /**
     * #getter
     * `ribbons.encoding.opacity` as its snapshot holds it
     */
    get ribbonOpacity(): SyntenyOpacitySnapshot {
      return opacitySnapshotOf(self.configuration.ribbons.encoding.opacity)
    },
    /**
     * #getter
     * `ribbons.filter`, the entries a ribbon must all pass to draw
     */
    get ribbonFilter(): FieldPredicate[] {
      return predicatesOf(self.configuration.ribbons.filter)
    },
    /**
     * #getter
     * whether `ribbons.filter` drops the ribbons with no value for the field
     * they paint by, the "Hide unlabelled rows" box
     */
    get hideUnlabelled(): boolean {
      return hidesUnlabelled(this.ribbonFilter, this.ribbonColorField)
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
      return getConf(self, ['axis', 'show'])
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
      return getConf(self, ['labels', 'lanes', 'placement']) === 'overlay'
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
        utrColor: self.configuration.utrs.encoding.color.value,
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

/** the field `ribbons.encoding.color` paints by */
export function ribbonColorFieldOf(self: ConfigSlotSelf) {
  return paintedRibbonColor(
    colorSnapshotOf(self.configuration.ribbons.encoding.color),
  ).field
}

/**
 * Takes out the "Hide unlabelled rows" entry of `field` once the ribbons no
 * longer paint by it, since the box shows only the painted field's. A ribbon
 * color writer calls it with the field it painted before its write.
 */
export function releaseHideUnlabelled(
  self: ConfigSlotSelf,
  field: string | undefined,
) {
  const filter = predicatesOf(self.configuration.ribbons.filter)
  if (field !== ribbonColorFieldOf(self) && hidesUnlabelled(filter, field)) {
    setConf(
      self,
      ['ribbons', 'filter'],
      withHideUnlabelled(filter, field!, false),
    )
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
      const field = ribbonColorFieldOf(self)
      if (field !== undefined) {
        setConf(
          self,
          ['ribbons', 'filter'],
          withHideUnlabelled(
            predicatesOf(self.configuration.ribbons.filter),
            field,
            flag,
          ),
        )
      }
    },

    /** #action */
    setInterpolate(interpolate: RibbonInterpolation) {
      setConf(self, ['ribbons', 'mark', 'interpolate'], interpolate)
    },
    /** #action */
    setShowLaneTicks(flag: boolean) {
      setConf(self, ['axis', 'show'], flag)
    },
    /** #action */
    setInlineLaneNames(flag: boolean) {
      setConf(
        self,
        ['labels', 'lanes', 'placement'],
        flag ? 'overlay' : 'above',
      )
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
