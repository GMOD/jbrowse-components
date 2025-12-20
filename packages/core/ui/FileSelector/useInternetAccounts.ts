import { useLocalStorage } from '../../util'
import { isAppRootModel } from '../../util/types'

import type { AbstractRootModel } from '../../util/types'

const NUM_SHOWN = 2

export default function useInternetAccounts(rootModel?: AbstractRootModel) {
  const [recentlyUsed, setRecentlyUsed] = useLocalStorage(
    'fileSelector-recentlyUsedInternetAccounts',
    [] as string[],
  )

  const accounts = isAppRootModel(rootModel)
    ? rootModel.internetAccounts.filter(
        f => f.type !== 'HTTPBasicInternetAccount',
      )
    : []

  const accountMap = Object.fromEntries(
    accounts.map(a => [a.internetAccountId, a]),
  )
  const sortedIds = [...new Set(accounts.map(s => s.internetAccountId))].sort(
    (a, b) => recentlyUsed.indexOf(a) - recentlyUsed.indexOf(b),
  )

  return {
    accountMap,
    shownAccountIds: sortedIds.slice(0, NUM_SHOWN),
    hiddenAccountIds: sortedIds.slice(NUM_SHOWN),
    recentlyUsed,
    setRecentlyUsed,
  }
}
