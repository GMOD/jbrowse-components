import { lazy } from 'react'

import { InfoIcon } from '@jbrowse/core/ui/Icons'

import { DialogQueueSessionMixin } from './DialogQueue.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'

const AboutDialog = lazy(() => import('../ui/AboutDialog.tsx'))

/**
 * #stateModel TrackMenuSessionMixin
 */
export function TrackMenuSessionMixin(pluginManager: PluginManager) {
  return DialogQueueSessionMixin(pluginManager).views(self => ({
    /**
     * #method
     */
    getTrackActionMenuItems(
      config: any,
      extraTrackActions?: MenuItem[],
      effectiveConfig?: Record<string, unknown>,
      _view?: { showTrack: (id: string) => void },
    ): MenuItem[] {
      return [
        {
          label: 'About track',
          onClick: () => {
            self.queueDialog(doneCallback => [
              AboutDialog,
              {
                config: effectiveConfig ?? config,
                session: self,
                handleClose: doneCallback,
              },
            ])
          },
          icon: InfoIcon,
        },
        ...(extraTrackActions || []),
      ]
    },
  }))
}
