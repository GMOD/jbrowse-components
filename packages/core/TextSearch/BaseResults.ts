import TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType'
import { searchType } from '../data_adapters/BaseAdapter'

export default class BaseResult {
  rendering: string

  matchedAttribute: string

  matchedObject: object

  textSearchAdapter: TextSearchAdapterType

  relevance: searchType

  constructor(args: unknown = {}) {
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

  constructor(args: unknown = {}) {
    super(args)
    this.location = args.location
  }
}

export class RefSequenceResult extends BaseResult {
  refName: string

  constructor(args: unknown = {}) {
    super(args)
    this.refName = args.refName
  }
}
