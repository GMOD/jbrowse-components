import TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType'
import { searchType } from '../data_adapters/BaseAdapter'

export interface BaseResultArgs {
  rendering: string

  matchedAttribute?: string

  matchedObject?: object

  textSearchAdapter?: TextSearchAdapterType

  relevance?: searchType

  location?: string

  refName?: string
}
export default class BaseResult {
  rendering: string // todo add | react component here

  matchedAttribute?: string

  matchedObject?: object

  textSearchAdapter?: TextSearchAdapterType

  relevance?: searchType

  constructor(args: BaseResultArgs) {
    this.rendering = args.rendering
    this.matchedAttribute = args.matchedAttribute
    this.matchedObject = args.matchedObject
    this.textSearchAdapter = args.textSearchAdapter
    this.relevance = args.relevance
  }

  getRendering() {
    return this.rendering
  }
}

/**
 * Future types of results
 * e.g: reference sequence results, track results,
 * feature results
 */
export class LocationResult extends BaseResult {
  location: string

  constructor(args: BaseResultArgs) {
    super(args)
    if (!args.location) {
      throw new Error('must provide location locstring')
    }
    this.location = args.location ?? ''
  }

  getLocation() {
    return this.location
  }
}

export class RefSequenceResult extends BaseResult {
  refName: string

  constructor(args: BaseResultArgs) {
    super(args)
    if (!args.refName) {
      throw new Error('must provide refName')
    }
    this.refName = args.refName ?? ''
  }

  getRefName() {
    return this.refName
  }
}
