export interface RecordKey {
  readonly name: string
  readonly arrayIndex: boolean
  block: number
  slot: number
}

const ARRAY_INDEX_REGEX = /^(?:0|[1-9]\d*)$/

/**
 * A block's entries by name, in the order a JS record keyed by that name
 * lists them: a name written twice keeps its first place and takes its last
 * value, and array-index names (`7`) come first, ascending. The MAF readers
 * that skip the `MafFeature` file their rows here, so they hand a sink the
 * rows in the order its `alignments` and `empties` would.
 */
export class RecordSlots {
  count = 0

  private keys = new Map<string, RecordKey>()
  private block = 0
  private arrayIndexed = false
  private slots: RecordKey[] = []
  private identity: number[] = []

  key(name: string) {
    let key = this.keys.get(name)
    if (!key) {
      key = {
        name,
        arrayIndex: ARRAY_INDEX_REGEX.test(name) && Number(name) < 4294967295,
        block: -1,
        slot: 0,
      }
      this.keys.set(name, key)
    }
    return key
  }

  startBlock() {
    this.block++
    this.count = 0
    this.arrayIndexed = false
  }

  /** The slot `key` writes this block: its first place, or a new last one. */
  slot(key: RecordKey) {
    if (key.block !== this.block) {
      key.block = this.block
      key.slot = this.count++
      this.slots[key.slot] = key
      if (key.arrayIndex) {
        this.arrayIndexed = true
      }
    }
    return key.slot
  }

  /** Whether `key` already has a slot this block. */
  holds(key: RecordKey) {
    return key.block === this.block
  }

  /** The slot `name` holds this block, or -1. */
  slotOf(name: string | undefined) {
    const key = name ? this.keys.get(name) : undefined
    return key?.block === this.block ? key.slot : -1
  }

  nameAt(slot: number) {
    return this.slots[slot]!.name
  }

  /** This block's slots in record order, the first `count` entries. */
  order(): readonly number[] {
    const { count, identity } = this
    while (identity.length < count) {
      identity.push(identity.length)
    }
    if (!this.arrayIndexed) {
      return identity
    }
    const slots = identity.slice(0, count)
    const indexed = slots
      .filter(s => this.slots[s]!.arrayIndex)
      .sort((a, b) => Number(this.nameAt(a)) - Number(this.nameAt(b)))
    return [...indexed, ...slots.filter(s => !this.slots[s]!.arrayIndex)]
  }
}
