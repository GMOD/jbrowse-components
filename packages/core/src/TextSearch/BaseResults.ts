export interface BaseResultArgs {
  label: string
  displayString?: string
  locString?: string
  refName?: string
  trackId?: string
  results?: BaseResult[]
}

export default class BaseResult {
  label: string
  displayString?: string
  trackId?: string
  locString?: string
  results?: BaseResult[]

  constructor(args: BaseResultArgs) {
    this.label = args.label
    this.locString = args.locString
    this.displayString = args.displayString
    this.trackId = args.trackId
    this.results = args.results
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
