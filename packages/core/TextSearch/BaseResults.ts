export default class BaseResult {

  value: string

  constructor(args: unknown = {}) {
    this.value = args.value
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
  }
}

export class RefSequenceResult extends BaseResult {
  constructor(args: unknown = {}) {
    super(args)
    this.refName = args.refName
  }
}
