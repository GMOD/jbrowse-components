export default class BaseResult {
  type: string

  value: string

  constructor(args: unknown = {}) {
    this.value = args.value
    this.type = 'baseResult'
  }

  getValue() {
    return this.value
  }
}

/**
 * Future types of results
 * e.g: reference sequence results, track results,
 * feature results
 */
export class LocationResult extends BaseResult {
  constructor(args: unknown = {}) {
    super(args)
    this.location = args.location
    this.type = 'locationResult'
  }
}

export class RefSequenceResult extends BaseResult {
  constructor(args: unknown = {}) {
    super(args)
    this.refName = args.refName
    this.type = 'referenceSequenceResult'
  }
}
