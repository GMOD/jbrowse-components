import TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType'
import { SearchType } from '../data_adapters/BaseAdapter'

export interface BaseResultArgs {
  label: string

  renderingComponent?: JSX.Element

  matchedAttribute?: string

  matchedObject?: object

  textSearchAdapter?: TextSearchAdapterType

  relevance?: SearchType

  locString?: string

  refName?: string

  trackId?: string

  score?: number
}
export default class BaseResult {
  label: string

  renderingComponent?: JSX.Element

  matchedAttribute?: string

  matchedObject?: object

  textSearchAdapter?: TextSearchAdapterType

  relevance?: SearchType

  trackId?: string

  score: number
  constructor(args: BaseResultArgs) {
    this.label = args.label
    this.renderingComponent = args.renderingComponent
    this.matchedAttribute = args.matchedAttribute
    this.matchedObject = args.matchedObject
    this.textSearchAdapter = args.textSearchAdapter
    this.relevance = args.relevance
    this.trackId = args.trackId
    this.score = args.score || 1
  }

  getLabel() {
    return this.label
  }

  getLocation() {
    return this.label
  }

  getRenderingComponent() {
    return this.renderingComponent
  }

  getTrackId() {
    return this.trackId
  }

  getScore() {
    return this.score
  }
  updateScore(newScore: number) {
    this.score = newScore
    return this.score
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
