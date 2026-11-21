import { getConf, setConf } from '@jbrowse/core/configuration'
import { getSession, persistTrackConfigNow } from '@jbrowse/core/util'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import { bandInk } from '@jbrowse/synteny-core'

import type { ConfigSlotSelf } from './configSlotViews.ts'
import type { LaneNameHost, laneNameViews } from './laneNameViews.ts'

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
  Pick<LaneNameHost, 'rowColors'> &
  Pick<ReturnType<typeof laneNameViews>, 'laneLabel' | 'laneColor'> &
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
