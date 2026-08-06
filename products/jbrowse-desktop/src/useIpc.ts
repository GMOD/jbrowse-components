import { useEffect } from 'react'

import { useEventCallback } from '@jbrowse/core/util/useEventCallback'

import { onIpc } from './ipc.ts'

import type { IpcPushChannels } from '../electron/ipc/channelTypes.ts'

/**
 * Listen to a main-process push for as long as the component is mounted,
 * checked against {@link IpcPushChannels} the way `invokeIpc` checks the other
 * direction.
 *
 * `listener` does not have to be stable: it is held through `useEventCallback`,
 * so the subscription is made once and always calls the newest one. That is the
 * point of having a hook rather than an effect at each call site — written
 * inline, the obvious version either re-subscribes on every render (an inline
 * closure is a new function each time) or pins the first render's closure by
 * declaring `[]` and reading stale state forever. Neither failure announces
 * itself.
 */
export function useIpc<K extends keyof IpcPushChannels>(
  channel: K,
  listener: (...args: IpcPushChannels[K]['args']) => void,
) {
  const stableListener = useEventCallback(listener)
  useEffect(() => onIpc(channel, stableListener), [channel, stableListener])
}
