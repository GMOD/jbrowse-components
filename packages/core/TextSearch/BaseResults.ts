export default class BaseResult {
  type: string

  constructor(args: unknown = {}) {
    this.value = args.value
    this.type = 'baseResult'
  }
}

export class LocationResult extends BaseResult {
  constructor(args: unknown = {}) {
    super(args)
    this.refName = args.refName
    this.location = args.location
    this.type = 'locationResult'
  }
}
