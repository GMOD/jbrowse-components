import PluggableElementBase from './PluggableElementBase'

export default class AdapterGuessType extends PluggableElementBase {
  name: string

  fetchConfig: Function

  // should regexGuess be a function instead? i.e. if i have a gdc adapter it could be a fn that requests the
  // file metadata and chooses the adapter from that bc you cant be predictive about uris or files that end in .txt

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
