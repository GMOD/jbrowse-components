import { useEffect } from 'react'

import { setDeviceLostHandler } from '@jbrowse/core/gpu/getGpuDevice'

import GpuDeviceLostDialog from './GpuDeviceLostDialog.tsx'

import type { AbstractSessionModel } from '@jbrowse/core/util/types'

export function useGpuDeviceLost(session: AbstractSessionModel) {
  useEffect(() => {
    setDeviceLostHandler(recover => {
      session.queueDialog(onClose => [
        GpuDeviceLostDialog,
        { onRecover: recover, onClose },
      ])
    })
    return () => {
      setDeviceLostHandler(() => {})
    }
  }, [session])
}
