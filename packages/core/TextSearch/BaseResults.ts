import type React from 'react'
import type { SearchType } from '../data_adapters/BaseAdapter'
import type TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType'

export interface BaseResultArgs {
  label: string

  displayString?: string

  renderingComponent?: React.ReactElement

  matchedAttribute?: string

  matchedObject?: object

  textSearchAdapter?: TextSearchAdapterType

  relevance?: SearchType

  locString?: string

  refName?: string

  trackId?: string

  score?: number

  results?: BaseResult[]
}

export default class BaseResult {
  label: string

  renderingComponent?: React.ReactElement

  displayString?: string

  matchedAttribute?: string

  matchedObject?: object

  textSearchAdapter?: TextSearchAdapterType

  relevance?: SearchType

  trackId?: string

  score: number

  locString?: string

  results?: BaseResult[]
  constructor(args: BaseResultArgs) {
    this.label = args.label
    this.locString = args.locString
    this.renderingComponent = args.renderingComponent
    this.displayString = args.displayString
    this.matchedAttribute = args.matchedAttribute
    this.matchedObject = args.matchedObject
    this.textSearchAdapter = args.textSearchAdapter
    this.relevance = args.relevance
    this.trackId = args.trackId
    this.score = args.score || 1
    this.results = args.results || []
  }

  getLabel() {
    return this.label
  }

  getDisplayString() {
    return this.displayString || this.label
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

  getId() {
    return `${this.getLabel()}-${this.getLocation()}-${this.getTrackId()}`
  }

  hasLocation() {
    return !!this.locString
  }

  getLocation() {
    return this.locString
  }

  getComboResults() {
    return this.results
  }
}

export class RefSequenceResult extends BaseResult {
  refName: string

  constructor(args: BaseResultArgs) {
    super(args)
    this.refName = args.refName ?? ''
  }

  getLocation() {
    return this.refName
  }
}
