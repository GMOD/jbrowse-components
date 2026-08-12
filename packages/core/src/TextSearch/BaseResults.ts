export interface BaseResultArgs {
  label: string
  displayString?: string
  locString?: string
  refName?: string
  trackId?: string
  results?: BaseResult[]
  /**
   * Whether this hit matched the query exactly, as the adapter judges it —
   * which is not something a caller can recompute. Trix calls a hit exact when
   * *any* indexed attribute equals the query, so searching a feature's ID
   * matches exactly even though neither the label nor the display string is
   * the query. Set it and a single unrestricted search answers both "what
   * matches?" and "what matches precisely?"; leave it unset and an adapter's
   * results simply never win the exact-first pass.
   */
  exact?: boolean
}

export default class BaseResult {
  label: string
  displayString?: string
  trackId?: string
  locString?: string
  results?: BaseResult[]
  exact?: boolean

  constructor(args: BaseResultArgs) {
    this.label = args.label
    this.locString = args.locString
    this.displayString = args.displayString
    this.trackId = args.trackId
    this.results = args.results
    this.exact = args.exact
  }

  getLabel() {
    return this.label
  }

  getDisplayString() {
    return this.displayString || this.label
  }

  getTrackId() {
    return this.trackId
  }

  getId() {
    return `${this.label}-${this.locString}-${this.trackId}`
  }

  isExact() {
    return !!this.exact
  }

  hasLocation() {
    return !!this.locString
  }

  getLocation() {
    return this.locString
  }
}

export class RefSequenceResult extends BaseResult {
  constructor(args: BaseResultArgs) {
    super({ ...args, locString: args.refName ?? args.locString })
  }
}
