/**
 * A numbering of keys from 0 in the order they first appear: each call gives
 * its key's number, a key not seen before taking the next.
 */
export function numberByFirstAppearance<K>() {
  const numbers = new Map<K, number>()
  return (key: K) => {
    const known = numbers.get(key)
    const number = known ?? numbers.size
    numbers.set(key, number)
    return number
  }
}
