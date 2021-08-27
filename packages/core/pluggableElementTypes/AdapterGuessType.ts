import PluggableElementBase from './PluggableElementBase'

export default class AdapterGuessType extends PluggableElementBase {
  name: string

  fetchConfig: Function

  regexGuess: RegExp | undefined

  trackGuess: string | undefined

  constructor(stuff: {
    name: string
    fetchConfig: Function
    regexGuess?: RegExp
    trackGuess?: string
  }) {
    super(stuff)
    this.name = stuff.name
    this.fetchConfig = stuff.fetchConfig
    this.regexGuess = stuff.regexGuess
    this.trackGuess = stuff.trackGuess
  }
}
