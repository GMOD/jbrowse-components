import { mutate } from '@jbrowse/core/util/useFetch'

import { invokeIpc } from '../ipc.ts'

export const LIST_SESSIONS_KEY = ['listSessions']

// A session that failed to open is a recent-session entry the user can prune,
// so its error toast offers that rather than leaving a dead row behind
export function removeRecentAction(path: string) {
  return {
    label: 'Remove from recent sessions',
    onClick: () => {
      invokeIpc('removeRecentSession', path)
        .then(() => {
          mutate(LIST_SESSIONS_KEY)
        })
        .catch(console.error)
    },
  }
}
