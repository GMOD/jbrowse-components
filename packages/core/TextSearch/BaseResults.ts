import TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType'
import { searchType } from '../data_adapters/BaseAdapter'

export interface BaseResultArgs {
  rendering: string

  renderingComponent?: JSX.Element
  matchedAttribute?: string

  matchedObject?: object

  textSearchAdapter?: TextSearchAdapterType

  relevance?: searchType

  locString?: string

  refName?: string

  trackName?: string
}
export default class BaseResult {
  rendering: string

  renderingComponent?: JSX.Element

  matchedAttribute?: string

  matchedObject?: object

  textSearchAdapter?: TextSearchAdapterType

  relevance?: searchType

  trackName?: string

  constructor(args: BaseResultArgs) {
    this.rendering = args.rendering
    this.renderingComponent = args.renderingComponent
    this.matchedAttribute = args.matchedAttribute
    this.matchedObject = args.matchedObject
    this.textSearchAdapter = args.textSearchAdapter
    this.relevance = args.relevance
    this.trackName = args.trackName
  }

  getRendering() {
    return this.rendering
  }

  getLocation() {
    return this.rendering
  }

  getRenderingComponent() {
    return this.renderingComponent
  }

  getTrackName() {
    return this.trackName
  }
}

/**
 * Future types of results
 * e.g: reference sequence results, track results,
 * feature results
 */
export class LocStringResult extends BaseResult {
  locString: string

  constructor(args: BaseResultArgs) {
    super(args)
    if (!args.locString) {
      throw new Error('must provide locString')
    }
    this.locString = args.locString ?? ''
  }

  getLocation() {
    return this.locString
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

  getLocation() {
    return this.refName
  }
}
