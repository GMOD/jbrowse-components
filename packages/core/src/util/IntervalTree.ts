/**
 * Vendored from @flatten-js/interval-tree
 * https://github.com/nickolanack/flatten-interval-tree
 * License: MIT
 * Created by Alex Bol on 3/31/2017.
 */

// Constants
const RB_TREE_COLOR_RED = 1
const RB_TREE_COLOR_BLACK = 0
type NodeColor = typeof RB_TREE_COLOR_RED | typeof RB_TREE_COLOR_BLACK

// Types
type Comparable = number | bigint | string | Date | [number, number]
type IntervalInput = IntervalBase | [number, number]

// Abstract base for intervals
abstract class IntervalBase {
  low: Comparable
  high: Comparable

  constructor(low: Comparable, high: Comparable) {
    this.low = low
    this.high = high
  }

  abstract clone(): IntervalBase

  get max(): IntervalBase {
    return this.clone()
  }

  less_than(other_interval: IntervalBase): boolean {
    return (
      (this.low as number) < (other_interval.low as number) ||
      ((this.low as number) === (other_interval.low as number) &&
        (this.high as number) < (other_interval.high as number))
    )
  }

  equal_to(other_interval: IntervalBase): boolean {
    return (
      (this.low as number) === (other_interval.low as number) &&
      (this.high as number) === (other_interval.high as number)
    )
  }

  intersect(other_interval: IntervalBase): boolean {
    return !this.not_intersect(other_interval)
  }

  not_intersect(other_interval: IntervalBase): boolean {
    return (
      (this.high as number) < (other_interval.low as number) ||
      (other_interval.high as number) < (this.low as number)
    )
  }

  merge(other_interval: IntervalBase): IntervalBase {
    const low =
      this.low === undefined
        ? other_interval.low
        : (this.low as number) < (other_interval.low as number)
          ? this.low
          : other_interval.low
    const high =
      this.high === undefined
        ? other_interval.high
        : (this.high as number) > (other_interval.high as number)
          ? this.high
          : other_interval.high
    const cloned = this.clone()
    cloned.low = low
    cloned.high = high
    return cloned
  }

  output(): [Comparable, Comparable] {
    return [this.low, this.high]
  }

  comparable_less_than(val1: Comparable, val2: Comparable): boolean {
    return (val1 as number) < (val2 as number)
  }
}

// 1D numeric interval (default)
class Interval extends IntervalBase {
  clone(): Interval {
    return new Interval(this.low, this.high)
  }
}

// Node class
class Node<V = unknown> {
  left: Node<V> | null
  right: Node<V> | null
  parent: Node<V> | null
  color: NodeColor
  item: { key?: IntervalBase; values: V[] }
  max: IntervalBase | undefined

  constructor(
    key?: IntervalInput,
    value?: V,
    left: Node<V> | null = null,
    right: Node<V> | null = null,
    parent: Node<V> | null = null,
    color: NodeColor = RB_TREE_COLOR_BLACK,
  ) {
    this.left = left
    this.right = right
    this.parent = parent
    this.color = color
    this.item = { key: undefined, values: [] }

    if (value !== undefined) {
      this.item.values.push(value)
    }

    if (key !== undefined) {
      if (Array.isArray(key)) {
        const [rawLow, rawHigh] = key
        if (!Number.isNaN(rawLow) && !Number.isNaN(rawHigh)) {
          let low = rawLow
          let high = rawHigh
          if (low > high) {
            ;[low, high] = [high, low]
          }
          this.item.key = new Interval(low, high)
        }
      } else {
        this.item.key = key
      }
    }

    this.max = this.item.key ? this.item.key.max : undefined
  }

  private requireKey(): IntervalBase {
    if (!this.item.key) {
      throw new Error('Node key is undefined')
    }
    return this.item.key
  }

  less_than(other_node: Node<V>): boolean {
    const a = this.requireKey()
    const b = other_node.requireKey()
    return a.less_than(b)
  }

  equal_to(other_node: Node<V>): boolean {
    const a = this.requireKey()
    const b = other_node.requireKey()
    return a.equal_to(b)
  }

  intersect(other_node: Node<V>): boolean {
    const a = this.requireKey()
    const b = other_node.requireKey()
    return a.intersect(b)
  }

  copy_data(other_node: Node<V>): void {
    this.item.key = other_node.item.key
    this.item.values = other_node.item.values.slice()
  }

  update_max(): void {
    this.max = this.item.key ? this.item.key.max : undefined
    if (this.right && this.right.max) {
      this.max = this.max ? this.max.merge(this.right.max) : this.right.max
    }
    if (this.left && this.left.max) {
      this.max = this.max ? this.max.merge(this.left.max) : this.left.max
    }
  }

  not_intersect_left_subtree(search_node: Node<V>): boolean {
    if (!this.left) {
      return true
    }
    const high = this.left.max ? this.left.max.high : this.left.item.key!.high
    const selfKey = this.requireKey()
    const searchKey = search_node.requireKey()
    return selfKey.comparable_less_than(high, searchKey.low)
  }

  not_intersect_right_subtree(search_node: Node<V>): boolean {
    if (!this.right) {
      return true
    }
    const low = this.right.max ? this.right.max.low : this.right.item.key!.low
    const selfKey = this.requireKey()
    const searchKey = search_node.requireKey()
    return selfKey.comparable_less_than(searchKey.high, low)
  }
}

// IntervalTree class
export class IntervalTree<V = unknown> {
  root: Node<V> | null
  nil_node: Node<V>

  constructor() {
    this.root = null
    this.nil_node = new Node<V>()
  }

  get size(): number {
    let count = 0
    this.tree_walk(this.root, node => (count += node.item.values.length))
    return count
  }

  get values(): V[] {
    const res: V[] = []
    this.tree_walk(this.root, node => {
      for (const v of node.item.values) {
        res.push(v)
      }
    })
    return res
  }

  isEmpty(): boolean {
    return this.root == null || this.root === this.nil_node
  }

  clear(): void {
    this.root = null
  }

  insert(key: IntervalInput, value: V = key as V): Node<V> | undefined {
    if (key === undefined) {
      return
    }
    const existing = this.tree_search(this.root, new Node<V>(key))
    if (existing) {
      existing.item.values.push(value)
      return existing
    }
    const insert_node = new Node<V>(
      key,
      value,
      this.nil_node,
      this.nil_node,
      null,
      RB_TREE_COLOR_RED,
    )
    this.tree_insert(insert_node)
    this.recalc_max(insert_node)
    return insert_node
  }

  search(interval: IntervalInput): V[] {
    const search_node = new Node<V>(interval)
    const resp_nodes: Node<V>[] = []
    this.tree_search_interval(this.root, search_node, resp_nodes)
    const res: V[] = []
    for (const node of resp_nodes) {
      for (const v of node.item.values) {
        res.push(v)
      }
    }
    return res
  }

  intersect_any(interval: IntervalInput): boolean {
    const search_node = new Node<V>(interval)
    return this.tree_find_any_interval(this.root, search_node)
  }

  forEach(visitor: (key: IntervalBase, value: V) => void): void {
    this.tree_walk(this.root, node => {
      for (const v of node.item.values) {
        visitor(node.item.key!, v)
      }
    })
  }

  private recalc_max(node: Node<V>): void {
    let node_current = node
    while (node_current.parent != null) {
      node_current.parent.update_max()
      node_current = node_current.parent
    }
  }

  private tree_insert(insert_node: Node<V>): void {
    let current_node: Node<V> | null = this.root
    let parent_node: Node<V> | null = null

    if (this.root == null || this.root === this.nil_node) {
      this.root = insert_node
    } else {
      while (current_node !== this.nil_node) {
        parent_node = current_node!
        if (insert_node.less_than(current_node!)) {
          current_node = current_node!.left
        } else {
          current_node = current_node!.right
        }
      }
      insert_node.parent = parent_node
      if (insert_node.less_than(parent_node!)) {
        parent_node!.left = insert_node
      } else {
        parent_node!.right = insert_node
      }
    }
    this.insert_fixup(insert_node)
  }

  private insert_fixup(insert_node: Node<V>): void {
    let current_node: Node<V>
    let uncle_node: Node<V>

    current_node = insert_node
    while (
      current_node !== this.root &&
      current_node.parent!.color === RB_TREE_COLOR_RED
    ) {
      if (current_node.parent === current_node.parent!.parent!.left) {
        uncle_node = current_node.parent!.parent!.right!
        if (uncle_node.color === RB_TREE_COLOR_RED) {
          current_node.parent!.color = RB_TREE_COLOR_BLACK
          uncle_node.color = RB_TREE_COLOR_BLACK
          current_node.parent!.parent!.color = RB_TREE_COLOR_RED
          current_node = current_node.parent!.parent!
        } else {
          if (current_node === current_node.parent!.right) {
            current_node = current_node.parent!
            this.rotate_left(current_node)
          }
          current_node.parent!.color = RB_TREE_COLOR_BLACK
          current_node.parent!.parent!.color = RB_TREE_COLOR_RED
          this.rotate_right(current_node.parent!.parent!)
        }
      } else {
        uncle_node = current_node.parent!.parent!.left!
        if (uncle_node.color === RB_TREE_COLOR_RED) {
          current_node.parent!.color = RB_TREE_COLOR_BLACK
          uncle_node.color = RB_TREE_COLOR_BLACK
          current_node.parent!.parent!.color = RB_TREE_COLOR_RED
          current_node = current_node.parent!.parent!
        } else {
          if (current_node === current_node.parent!.left) {
            current_node = current_node.parent!
            this.rotate_right(current_node)
          }
          current_node.parent!.color = RB_TREE_COLOR_BLACK
          current_node.parent!.parent!.color = RB_TREE_COLOR_RED
          this.rotate_left(current_node.parent!.parent!)
        }
      }
    }
    this.root!.color = RB_TREE_COLOR_BLACK
  }

  private tree_search(
    node: Node<V> | null,
    search_node: Node<V>,
  ): Node<V> | undefined {
    if (node == null || node === this.nil_node) {
      return undefined
    }
    if (search_node.equal_to(node)) {
      return node
    }
    if (search_node.less_than(node)) {
      return this.tree_search(node.left, search_node)
    } else {
      return this.tree_search(node.right, search_node)
    }
  }

  private tree_search_interval(
    node: Node<V> | null,
    search_node: Node<V>,
    res: Node<V>[],
  ): void {
    if (node != null && node !== this.nil_node) {
      if (
        node.left !== this.nil_node &&
        !node.not_intersect_left_subtree(search_node)
      ) {
        this.tree_search_interval(node.left, search_node, res)
      }
      if (node.intersect(search_node)) {
        res.push(node)
      }
      if (
        node.right !== this.nil_node &&
        !node.not_intersect_right_subtree(search_node)
      ) {
        this.tree_search_interval(node.right, search_node, res)
      }
    }
  }

  private tree_find_any_interval(
    node: Node<V> | null,
    search_node: Node<V>,
  ): boolean {
    let found = false
    if (node != null && node !== this.nil_node) {
      if (
        node.left !== this.nil_node &&
        !node.not_intersect_left_subtree(search_node)
      ) {
        found = this.tree_find_any_interval(node.left, search_node)
      }
      if (!found) {
        found = node.intersect(search_node)
      }
      if (
        !found &&
        node.right !== this.nil_node &&
        !node.not_intersect_right_subtree(search_node)
      ) {
        found = this.tree_find_any_interval(node.right, search_node)
      }
    }
    return found
  }

  private rotate_left(x: Node<V>): void {
    const y = x.right!
    x.right = y.left
    if (y.left !== this.nil_node) {
      y.left!.parent = x
    }
    y.parent = x.parent
    if (x === this.root) {
      this.root = y
    } else {
      if (x === x.parent!.left) {
        x.parent!.left = y
      } else {
        x.parent!.right = y
      }
    }
    y.left = x
    x.parent = y
    if (x !== null && x !== this.nil_node) {
      x.update_max()
    }
    if (y != null && y !== this.nil_node) {
      y.update_max()
    }
  }

  private rotate_right(y: Node<V>): void {
    const x = y.left!
    y.left = x.right
    if (x.right !== this.nil_node) {
      x.right!.parent = y
    }
    x.parent = y.parent
    if (y === this.root) {
      this.root = x
    } else {
      if (y === y.parent!.left) {
        y.parent!.left = x
      } else {
        y.parent!.right = x
      }
    }
    x.right = y
    y.parent = x
    if (y !== null && y !== this.nil_node) {
      y.update_max()
    }
    if (x != null && x !== this.nil_node) {
      x.update_max()
    }
  }

  private tree_walk(
    node: Node<V> | null,
    action: (node: Node<V>) => void,
  ): void {
    if (node != null && node !== this.nil_node) {
      this.tree_walk(node.left, action)
      action(node)
      this.tree_walk(node.right, action)
    }
  }
}
