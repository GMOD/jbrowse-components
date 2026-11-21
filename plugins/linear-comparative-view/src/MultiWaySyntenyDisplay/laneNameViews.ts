import { getConf } from '@jbrowse/core/configuration'
import { declaredAnchorColorOf } from '@jbrowse/synteny-core'

import { laneColorOf, laneLabelOf } from './laneSelection.ts'
import { againstAnchorName } from './sourceShape.ts'

import type { ConfigSlotSelf } from './configSlotViews.ts'
import type { LaneAssemblies, LaneRowsField } from './copyLane.ts'
import type { DeclaredLane } from '@jbrowse/synteny-core'

/**
 * What the lane names and colors are keyed off: the source's declared lanes
 * and header, the `rows` config, and how a lane keys
 */
export interface LaneNameKeyHost extends ConfigSlotSelf {
  declaredLanes: DeclaredLane[]
  adapterHeader: unknown
  anchorAssemblyName: string
  laneKey: (lane: string) => string
}

export function laneNameKeyViews(self: LaneNameKeyHost) {
  return {
    /**
     * #getter
     * keyed by `laneKey`
     */
    get declaredLaneLabels() {
      const out = new Map<string, string>()
      for (const { name, label } of self.declaredLanes) {
        if (label !== undefined) {
          out.set(self.laneKey(name), label)
        }
      }
      return out
    },
    /**
     * #getter
     * `rows.labels`, keyed by `laneKey`
     */
    get rowLabels() {
      const labels = getConf(self, ['rows', 'labels'])
      return new Map(
        Object.entries(labels).map(([name, label]) => [
          self.laneKey(name),
          label,
        ]),
      )
    },
    /**
     * #getter
     * the colors the source declares, the anchor's `anchorColor` among
     * them, keyed by `laneKey`
     */
    get declaredLaneColors() {
      const out = new Map<string, string>()
      for (const { name, color } of self.declaredLanes) {
        if (color !== undefined) {
          out.set(self.laneKey(name), color)
        }
      }
      const anchorColor = declaredAnchorColorOf(self.adapterHeader)
      if (anchorColor !== undefined) {
        out.set(self.laneKey(self.anchorAssemblyName), anchorColor)
      }
      return out
    },
    /**
     * #getter
     * `rows.colors`, keyed by `laneKey`
     */
    get rowColors() {
      const colors = getConf(self, ['rows', 'colors'])
      return new Map(
        Object.entries(colors).map(([name, color]) => [
          self.laneKey(name),
          color,
        ]),
      )
    },
  }
}

type LaneNameKeys = ReturnType<typeof laneNameKeyViews>

/**
 * What a lane's name and color read: the keyed names and colors, and how the
 * session spells and names the lane's genome
 */
export interface LaneNameHost extends LaneNameKeyHost, LaneNameKeys {
  laneAssemblies: LaneAssemblies
}

export function laneNameViews(self: LaneNameHost) {
  return {
    /** #method */
    laneLabel(lane: string) {
      const assemblies = self.laneAssemblies
      return laneLabelOf(lane, {
        written: self.rowLabels,
        heldName: name =>
          assemblies.has(name) ? assemblies.getDisplayName(name) : undefined,
        declared: self.declaredLaneLabels,
        keyOf: self.laneKey,
        shownRefName: (assemblyName, refName) =>
          (assemblies.has(assemblyName) &&
            assemblies.get(assemblyName)?.getCanonicalRefName2(refName)) ||
          refName,
      })
    },
    /**
     * #method
     * the color a lane's label bar draws, undefined for none
     */
    laneColor(assemblyName: string) {
      return laneColorOf(assemblyName, {
        pinned: self.rowColors,
        declared: self.declaredLaneColors,
        keyOf: self.laneKey,
      })
    },
  }
}

type LaneNames = ReturnType<typeof laneNameViews>

/** What the anchor's name beside the lanes reads */
export interface AgainstAnchorHost extends Pick<LaneNames, 'laneLabel'> {
  anchorAssemblyName: string
  rowsVsAnchor: boolean
  laneField: LaneRowsField
}

export function againstAnchorViews(self: AgainstAnchorHost) {
  return {
    /**
     * #getter
     * the anchor's name in a lane's `vs` badge and the legend where the
     * lanes read against it: its label beside copy lanes, which name their
     * genome's label, else its assembly name
     */
    get againstAnchor(): string | undefined {
      return againstAnchorName(
        self.rowsVsAnchor,
        self.laneField,
        self.anchorAssemblyName,
        lane => self.laneLabel(lane),
      )
    },
  }
}
