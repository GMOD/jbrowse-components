/* eslint-disable @typescript-eslint/no-explicit-any */
const bedFeatureNames = 'seq_id start end name score strand'.split(' ')

export class BEDParser {
  private featureCallback: Function

  private endCallback: Function

  private commentCallback: Function

  private errorCallback: Function

  private headerCallback: Function

  private store: any

  private eof: boolean

  public header: { [key: string]: any }

  constructor(args: any) {
    this.featureCallback = args.featureCallback || (() => {})
    this.endCallback = args.endCallback || (() => {})
    this.commentCallback = args.commentCallback || (() => {})
    this.headerCallback = args.headerCallback || (() => {})
    this.errorCallback = args.errorCallback || console.error
    this.store = args.store
    // if this is true, the parser ignores the
    // rest of the lines in the file.  currently
    // set when the file switches over to FASTA
    this.eof = false
    this.header = {}
  }

  /**
   * Parse the bytes that contain the BED header, storing the parsed
   * data in this.header.
   */
  parseHeader(lines: string[]) {
    // parse the header lines
    const headData: { [key: string]: any } = {}
    let line
    for (let i = 0; i < lines.length; i++) {
      line = lines[i]
      // only interested in meta and header lines
      if (
        line[0] === '#' ||
        line.startsWith('browser') ||
        line.startsWith('track')
      ) {
        /// some custom header, pass to parser
        const { key, value } = this.headerCallback(line) || {}
        this.header[key] = value
      }

      // parse meta line using the parseHeader configuration callback function
    }

    return headData
  }

  finish() {
    this.endCallback()
  }

  addLine(line: string) {
    let match
    if (this.eof) {
      // do nothing
    } else if (/^\s*[^#\s>]/.test(line)) {
      // < feature line, most common case
      line = line.replace(/\r?\n?$/g, '')
      const f = this.parseFeature(line)
      this.featureCallback(this.returnItem([f]))
    }
    // directive or comment
    else if ((match = /^\s*(#+)(.*)/.exec(line))) {
      let contents = match[2]
      contents = contents.replace(/\s*/, '')
      this.returnItem({ comment: contents })
    } else if (/^\s*$/.test(line)) {
      // blank line, do nothing
    } else {
      // it's a parse error
      line = line.replace(/\r?\n?$/g, '')
      throw new Error(`BED parse error.  Cannot parse '${line}'.`)
    }
  }

  unescape(s: string) {
    if (s === null) return null

    return s.replace(/%([0-9A-Fa-f]{2})/g, (match, seq) => {
      return String.fromCharCode(parseInt(seq, 16))
    })
  }

  parseFeature(line: string) {
    const f = line.split('\t').map(a => (a === '.' ? null : a))

    // unescape only the ref and source columns
    if (!f[0]) {
      throw new Error('Unrecognized column 0 refName')
    }
    f[0] = this.unescape(f[0])

    const parsed: { [key: string]: any } = {}
    for (let i = 0; i < bedFeatureNames.length; i++) {
      if (f[i]) {
        parsed[bedFeatureNames[i]] = f[i] === '.' ? null : f[i]
      }
    }
    if (parsed.start !== null) parsed.start = parseInt(parsed.start, 10)
    if (parsed.end !== null) parsed.end = parseInt(parsed.end, 10)
    if (parsed.score != null) parsed.score = parseFloat(parsed.score)
    if (parsed.strand === '+') parsed.strand = 1

    return parsed
  }

  returnItem(i: any) {
    if (i[0]) this.featureCallback(i)
    else if (i.comment) this.commentCallback(i, this.store)
  }
}
