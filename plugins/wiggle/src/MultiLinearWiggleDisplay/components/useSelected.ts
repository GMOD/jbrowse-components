import { useCallback, useState } from 'react'
import uniq from 'lodash/uniq'
import difference from 'lodash/difference'

export const useSelected = <P>(initialState: Array<P>) => {
  const [selected, setSelected] = useState(initialState)

  const add = useCallback(
    (items: Array<P>) => {
      setSelected(oldList => uniq([...oldList, ...items]))
    },
    [setSelected],
  )

  const remove = useCallback(
    (items: Array<P>) => {
      setSelected(oldList => difference(oldList, items))
    },
    [setSelected],
  )

  const change = useCallback(
    (addOrRemove: boolean, items: Array<P>) => {
      if (addOrRemove) {
        add(items)
      } else {
        remove(items)
      }
    },
    [add, remove],
  )

  const clear = useCallback(() => setSelected([]), [setSelected])

  return { selected, add, remove, clear, change }
}
