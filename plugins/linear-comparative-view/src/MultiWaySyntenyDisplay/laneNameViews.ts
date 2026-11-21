import { getConf, setConf } from '@jbrowse/core/configuration'
import { getSession, persistTrackConfigNow } from '@jbrowse/core/util'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import { bandInk, declaredAnchorColorOf } from '@jbrowse/synteny-core'

import { laneColorOf, laneLabelOf } from './laneSelection.ts'
import { againstAnchorName } from './sourceShape.ts'

import type { ConfigSlotSelf } from './configSlotViews.ts'
import type { LaneRowsField } from './copyLane.ts'
import type { DeclaredLane } from '@jbrowse/synteny-core'

/**
 * What the lane names and colors read off their host: the source's declared
 * lanes and header, the `rows` config, how the session spells and holds a
 * lane, and whether the lanes read against the anchor
 */
export interface LaneNameHost extends ConfigSlotSelf {
  declaredLanes: DeclaredLane[]
  adapterHeader: unknown
  anchorAssemblyName: string
  laneKey: (lane: string) => string
  holdsAssembly: (lane: string) => boolean
  rowsVsAnchor: boolean
  laneField: LaneRowsField
}

export function laneNameViews(self: LaneNameHost) {
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
    /** #method */
    laneLabel(lane: string) {
      const { assemblyManager } = getSession(self)
      return laneLabelOf(lane, {
        written: this.rowLabels,
        heldName: name =>
          self.holdsAssembly(name)
            ? assemblyManager.getDisplayName(name)
            : undefined,
        declared: this.declaredLaneLabels,
        keyOf: self.laneKey,
        shownRefName: (assemblyName, refName) =>
          (self.holdsAssembly(assemblyName) &&
            assemblyManager.get(assemblyName)?.getCanonicalRefName2(refName)) ||
          refName,
      })
    },
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
        lane => this.laneLabel(lane),
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
    /**
     * #method
     * the color a lane's label bar draws, undefined for none
     */
    laneColor(assemblyName: string) {
      return laneColorOf(assemblyName, {
        pinned: this.rowColors,
        declared: this.declaredLaneColors,
        keyOf: self.laneKey,
      })
    },
  }
}

export type LaneColorHost = ConfigSlotSelf & Pick<LaneNameHost, 'laneKey'>

export function laneColorActions(self: LaneColorHost) {
  return {
    /**
     * #action
     * pins `rows.colors` for the lane, replacing an entry under any other
     * spelling of it; undefined drops the pin, so the source's color shows
     */
    setLaneColor(assemblyName: string, color: string | undefined) {
      const key = self.laneKey(assemblyName)
      const kept = Object.entries(getConf(self, ['rows', 'colors'])).filter(
        ([name]) => self.laneKey(name) !== key,
      )
      setConf(
        self,
        ['rows', 'colors'],
        Object.fromEntries(
          color === undefined ? kept : [...kept, [assemblyName, color]],
        ),
      )
      persistTrackConfigNow(self)
    },
  }
}

export type LaneColorDialogHost = LaneColorHost &
  Pick<
    ReturnType<typeof laneNameViews>,
    'laneLabel' | 'laneColor' | 'rowColors'
  > &
  ReturnType<typeof laneColorActions>

export function laneColorDialogActions(self: LaneColorDialogHost) {
  return {
    /** #action */
    openLaneColorDialog(assemblyName: string) {
      getSession(self).queueDialog(handleClose => [
        SolidColorDialog,
        {
          label: `${self.laneLabel(assemblyName)} lane color`,
          color: self.laneColor(assemblyName) ?? bandInk().text,
          written: self.rowColors.get(self.laneKey(assemblyName)),
          onChange: (color: string) => {
            self.setLaneColor(assemblyName, color)
          },
          onReset: () => {
            self.setLaneColor(assemblyName, undefined)
          },
          handleClose,
        },
      ])
    },
  }
}
