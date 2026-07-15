/**
 * Static augmented interval tree: returns the values whose interval overlaps a
 * query interval.
 *
 * Replaces a vendored red-black implementation. Every JBrowse caller builds the
 * tree fully (many `insert`s) and then only queries it (`search`) — never
 * interleaving inserts with searches and never deleting — so the self-balancing
 * machinery (rotations, color fixups, parent pointers, nil sentinels) was
 * unnecessary. Intervals are collected on `insert`; a balanced tree is built
 * lazily on the first `search` via recursive median split, giving O(n log n)
 * build and O(log n + k) query.
 *
 * Originally vendored from @flatten-js/interval-tree (MIT, Alex Bol).
 */

interface RawInterval<V> {
  low: number
  high: number
  value: V
}

interface IntervalNode<V> extends RawInterval<V> {
  // max `high` across this node's subtree, used to prune the left descent
  maxHigh: number
  left: IntervalNode<V> | undefined
  right: IntervalNode<V> | undefined
}

export class IntervalTree<V> {
  private intervals: RawInterval<V>[] = []
  private root: IntervalNode<V> | undefined
  private built = false

  insert(key: [number, number], value: V) {
    const [a, b] = key
    // normalize reversed intervals so low <= high
    this.intervals.push({ low: Math.min(a, b), high: Math.max(a, b), value })
    this.built = false
  }

  search(interval: [number, number]): V[] {
    if (!this.built) {
      // stable sort keeps insertion order among equal intervals, so the
      // in-order query output matches the old red-black in-order traversal
      const sorted = [...this.intervals].sort(
        (x, y) => x.low - y.low || x.high - y.high,
      )
      this.root = buildBalanced(sorted, 0, sorted.length - 1)
      this.built = true
    }
    const [a, b] = interval
    const out: V[] = []
    query(this.root, Math.min(a, b), Math.max(a, b), out)
    return out
  }
}

function buildBalanced<V>(
  items: RawInterval<V>[],
  start: number,
  end: number,
): IntervalNode<V> | undefined {
  if (start > end) {
    return undefined
  }
  const mid = Math.floor((start + end) / 2)
  const item = items[mid]!
  const left = buildBalanced(items, start, mid - 1)
  const right = buildBalanced(items, mid + 1, end)
  return {
    ...item,
    left,
    right,
    maxHigh: Math.max(
      item.high,
      left?.maxHigh ?? -Infinity,
      right?.maxHigh ?? -Infinity,
    ),
  }
}

// in-order overlap collection: left before self before right keeps results
// sorted by (low, high), matching what the old red-black tree returned
function query<V>(
  node: IntervalNode<V> | undefined,
  low: number,
  high: number,
  out: V[],
) {
  // no interval in this subtree reaches `low`
  if (!node || node.maxHigh < low) {
    return
  }
  query(node.left, low, high, out)
  if (node.low <= high && node.high >= low) {
    out.push(node.value)
  }
  // right subtree lows are all >= node.low (input is sorted by low); if
  // node.low is already past `high`, nothing on the right can overlap
  if (node.low <= high) {
    query(node.right, low, high, out)
  }
}
