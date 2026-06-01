import { useLocalStorage } from '../../util/index.ts'
import { isAppRootModel } from '../../util/types/index.ts'

import type { AbstractRootModel } from '../../util/types/index.ts'

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
  // recentlyUsed is ordered most-recent-first; accounts absent from it rank
  // last (indexOf returns -1, which would otherwise sort them ahead of index 0)
  const rank = (id: string) => {
    const idx = recentlyUsed.indexOf(id)
    return idx === -1 ? Number.POSITIVE_INFINITY : idx
  }
  const sortedIds = [...new Set(accounts.map(s => s.internetAccountId))].sort(
    (a, b) => rank(a) - rank(b),
  )

  return {
    accountMap,
    shownAccountIds: sortedIds.slice(0, NUM_SHOWN),
    hiddenAccountIds: sortedIds.slice(NUM_SHOWN),
    recentlyUsed,
    setRecentlyUsed,
  }
}
