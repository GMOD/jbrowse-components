import PluggableElementBase from './PluggableElementBase'

export default class AdapterGuessType extends PluggableElementBase {
  name: string

  fetchConfig: Function

  regexGuess: RegExp | undefined

  constructor(stuff: {
    name: string
    regexGuess?: RegExp
    fetchConfig: Function
  }) {
    super(stuff)
    this.name = stuff.name
    this.regexGuess = stuff.regexGuess
    this.fetchConfig = stuff.fetchConfig
  }
}
