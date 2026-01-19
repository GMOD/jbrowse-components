/**
 * Vendored and simplified from @flatten-js/interval-tree
 * https://github.com/nickolanack/flatten-interval-tree
 * License: MIT
 * Created by Alex Bol on 3/31/2017.
 *
 * Simplified to only support numeric intervals and the subset of API we use:
 * - constructor, insert, search
 */

const RB_TREE_COLOR_RED = 1
const RB_TREE_COLOR_BLACK = 0
type NodeColor = typeof RB_TREE_COLOR_RED | typeof RB_TREE_COLOR_BLACK

class Interval {
  constructor(
    public low: number,
    public high: number,
  ) {}

  lessThan(other: Interval) {
    return (
      this.low < other.low || (this.low === other.low && this.high < other.high)
    )
  }

  equalTo(other: Interval) {
    return this.low === other.low && this.high === other.high
  }

  intersects(other: Interval) {
    return !(this.high < other.low || other.high < this.low)
  }

  merge(other: Interval) {
    return new Interval(
      Math.min(this.low, other.low),
      Math.max(this.high, other.high),
    )
  }
}

class Node<V> {
  left: Node<V> | null = null
  right: Node<V> | null = null
  parent: Node<V> | null = null
  color: NodeColor = RB_TREE_COLOR_BLACK
  key: Interval | undefined
  values: V[] = []
  max: Interval | undefined

  constructor(
    key?: Interval | [number, number],
    value?: V,
    left?: Node<V> | null,
    right?: Node<V> | null,
    parent?: Node<V> | null,
    color?: NodeColor,
  ) {
    if (left !== undefined) {
      this.left = left
    }
    if (right !== undefined) {
      this.right = right
    }
    if (parent !== undefined) {
      this.parent = parent
    }
    if (color !== undefined) {
      this.color = color
    }
    if (value !== undefined) {
      this.values.push(value)
    }
    if (key !== undefined) {
      if (Array.isArray(key)) {
        const [low, high] = key
        this.key =
          low <= high ? new Interval(low, high) : new Interval(high, low)
      } else {
        this.key = key
      }
      this.max = this.key
    }
  }

  lessThan(other: Node<V>) {
    return this.key!.lessThan(other.key!)
  }

  equalTo(other: Node<V>) {
    return this.key!.equalTo(other.key!)
  }

  intersects(other: Node<V>) {
    return this.key!.intersects(other.key!)
  }

  updateMax() {
    this.max = this.key
    if (this.right?.max && this.max) {
      this.max = this.max.merge(this.right.max)
    }
    if (this.left?.max && this.max) {
      this.max = this.max.merge(this.left.max)
    }
  }

  notIntersectLeftSubtree(searchNode: Node<V>) {
    if (!this.left) {
      return true
    }
    const high = this.left.max?.high ?? this.left.key!.high
    return high < searchNode.key!.low
  }

  notIntersectRightSubtree(searchNode: Node<V>) {
    if (!this.right) {
      return true
    }
    const low = this.right.max?.low ?? this.right.key!.low
    return searchNode.key!.high < low
  }
}

export class IntervalTree<V> {
  root: Node<V> | null = null
  private nilNode = new Node<V>()

  insert(key: [number, number], value: V) {
    const existing = this.treeSearch(this.root, new Node<V>(key))
    if (existing) {
      existing.values.push(value)
      return existing
    }
    const insertNode = new Node<V>(
      key,
      value,
      this.nilNode,
      this.nilNode,
      null,
      RB_TREE_COLOR_RED,
    )
    this.treeInsert(insertNode)
    this.recalcMax(insertNode)
    return insertNode
  }

  search(interval: [number, number]): V[] {
    const searchNode = new Node<V>(interval)
    const resultNodes: Node<V>[] = []
    this.treeSearchInterval(this.root, searchNode, resultNodes)
    const results: V[] = []
    for (const node of resultNodes) {
      for (const v of node.values) {
        results.push(v)
      }
    }
    return results
  }

  private recalcMax(node: Node<V>) {
    let current = node
    while (current.parent != null) {
      current.parent.updateMax()
      current = current.parent
    }
  }

  private treeInsert(insertNode: Node<V>) {
    let current: Node<V> | null = this.root
    let parent: Node<V> | null = null

    if (this.root == null || this.root === this.nilNode) {
      this.root = insertNode
    } else {
      while (current !== this.nilNode) {
        parent = current!
        current = insertNode.lessThan(current!) ? current!.left : current!.right
      }
      insertNode.parent = parent
      if (insertNode.lessThan(parent!)) {
        parent!.left = insertNode
      } else {
        parent!.right = insertNode
      }
    }
    this.insertFixup(insertNode)
  }

  private insertFixup(insertNode: Node<V>) {
    let current = insertNode
    while (
      current !== this.root &&
      current.parent!.color === RB_TREE_COLOR_RED
    ) {
      if (current.parent === current.parent!.parent!.left) {
        const uncle = current.parent!.parent!.right!
        if (uncle.color === RB_TREE_COLOR_RED) {
          current.parent!.color = RB_TREE_COLOR_BLACK
          uncle.color = RB_TREE_COLOR_BLACK
          current.parent!.parent!.color = RB_TREE_COLOR_RED
          current = current.parent!.parent!
        } else {
          if (current === current.parent!.right) {
            current = current.parent!
            this.rotateLeft(current)
          }
          current.parent!.color = RB_TREE_COLOR_BLACK
          current.parent!.parent!.color = RB_TREE_COLOR_RED
          this.rotateRight(current.parent!.parent!)
        }
      } else {
        const uncle = current.parent!.parent!.left!
        if (uncle.color === RB_TREE_COLOR_RED) {
          current.parent!.color = RB_TREE_COLOR_BLACK
          uncle.color = RB_TREE_COLOR_BLACK
          current.parent!.parent!.color = RB_TREE_COLOR_RED
          current = current.parent!.parent!
        } else {
          if (current === current.parent!.left) {
            current = current.parent!
            this.rotateRight(current)
          }
          current.parent!.color = RB_TREE_COLOR_BLACK
          current.parent!.parent!.color = RB_TREE_COLOR_RED
          this.rotateLeft(current.parent!.parent!)
        }
      }
    }
    this.root!.color = RB_TREE_COLOR_BLACK
  }

  private treeSearch(
    node: Node<V> | null,
    searchNode: Node<V>,
  ): Node<V> | undefined {
    if (node == null || node === this.nilNode) {
      return undefined
    }
    if (searchNode.equalTo(node)) {
      return node
    }
    return searchNode.lessThan(node)
      ? this.treeSearch(node.left, searchNode)
      : this.treeSearch(node.right, searchNode)
  }

  private treeSearchInterval(
    node: Node<V> | null,
    searchNode: Node<V>,
    results: Node<V>[],
  ) {
    if (node != null && node !== this.nilNode) {
      if (
        node.left !== this.nilNode &&
        !node.notIntersectLeftSubtree(searchNode)
      ) {
        this.treeSearchInterval(node.left, searchNode, results)
      }
      if (node.intersects(searchNode)) {
        results.push(node)
      }
      if (
        node.right !== this.nilNode &&
        !node.notIntersectRightSubtree(searchNode)
      ) {
        this.treeSearchInterval(node.right, searchNode, results)
      }
    }
  }

  private rotateLeft(x: Node<V>) {
    const y = x.right!
    x.right = y.left
    if (y.left !== this.nilNode) {
      y.left!.parent = x
    }
    y.parent = x.parent
    if (x === this.root) {
      this.root = y
    } else if (x === x.parent!.left) {
      x.parent!.left = y
    } else {
      x.parent!.right = y
    }
    y.left = x
    x.parent = y
    x.updateMax()
    y.updateMax()
  }

  private rotateRight(y: Node<V>) {
    const x = y.left!
    y.left = x.right
    if (x.right !== this.nilNode) {
      x.right!.parent = y
    }
    x.parent = y.parent
    if (y === this.root) {
      this.root = x
    } else if (y === y.parent!.left) {
      y.parent!.left = x
    } else {
      y.parent!.right = x
    }
    x.right = y
    y.parent = x
    y.updateMax()
    x.updateMax()
  }
}
