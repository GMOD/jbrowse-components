import PluggableElementBase from './PluggableElementBase'

export default class TextSearchAdapterType extends PluggableElementBase {
  constructor(stuff: {
    name: string
    regexGuess?: RegExp // should this be a function instead? i.e. if i have a gdc adapter it could be a fn that requests the
    // file metadata and chooses the adapter from that bc you cant be predictive about uris or files that end in .txt
    fetchConfig: Function // how do i force this to be able to accept one mandatory param and two optional? i.e. filename, index, indexname
  }) {
    super(stuff)
    this.name = stuff.name
    this.regexGuess = stuff.regexGuess
    this.fetchConfig = stuff.fetchConfig
  }
}
