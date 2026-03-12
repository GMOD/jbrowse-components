import { useEffect } from 'react'

import getGpuDevice, { onDeviceLost } from '@jbrowse/core/gpu/getGpuDevice'

import GpuDeviceLostDialog from './GpuDeviceLostDialog.tsx'

import type { AbstractSessionModel } from '@jbrowse/core/util/types'

export function useGpuDeviceLost(session: AbstractSessionModel) {
  useEffect(() => {
    return onDeviceLost(() => {
      session.queueDialog(onClose => [
        GpuDeviceLostDialog,
        {
          onRecover: () =>
            getGpuDevice().catch((e: unknown) => {
              console.error(e)
              session.notifyError(`${e}`, e)
            }),
          onClose,
        },
      ])
    })
  }, [session])
}
