import Trix from '@gmod/trix'
import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { LocStringResult } from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

export default class TrixTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter {
  indexingAttributes?: string[]
  trixJs: Trix
  tracksNames?: string[]

  constructor(config: AnyConfigurationModel) {
    super(config)
    const ixFilePath = readConfObject(config, 'ixFilePath')
    const ixxFilePath = readConfObject(config, 'ixxFilePath')

    if (!ixFilePath) {
      throw new Error('must provide out.ix')
    }
    if (!ixxFilePath) {
      throw new Error('must provide out.ixx')
    }
    this.trixJs = new Trix(
      openLocation(ixxFilePath),
      openLocation(ixFilePath),
      200,
    )
  }

  /*
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...prefix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs) {
    const results = await this.trixJs.search(args.queryString)
    const formatted = results.map(entry => {
      const [term, data] = entry.split(',')
      const result = JSON.parse(data.replace(/\|/g, ',')) as string[]
      const [loc, trackId, Name, ID, ...rest] = result.map(record =>
        decodeURIComponent(record),
      )

      // gff3 fields are uri encoded so double decode
      const fields = rest.map(elt => decodeURIComponent(elt))
      const allAttributes = [Name, ID, ...fields]

      const labelFieldIdx = allAttributes.findIndex(elt => !!elt)
      const contextIdx = allAttributes.findIndex(
        elt => elt.toLowerCase().indexOf(term) !== -1,
      )

      const recordIdentifier = Name || ID || ''
      if (labelFieldIdx !== -1 && contextIdx !== -1) {
        const labelField = allAttributes[labelFieldIdx]
        const contextField = allAttributes[contextIdx]
        let context
        if (contextIdx !== labelFieldIdx) {
          const w = 15
          context = contextField
          if (contextField.length > 40) {
            const tidx = contextField.toLowerCase().indexOf(term.toLowerCase())
            // console.log('term', term)
            // console.log('contextField', contextField)
            // console.log('tidx', tidx)
            context =
              '...' +
              contextField
                .slice(Math.max(0, tidx - w), tidx + term.length + w)
                .trim() +
              '...'
          }
        }

        let shortenedLabelField = ''
        if (labelField.length > 40) {
          const w = 16
          const tidx = labelField.toLowerCase().indexOf(term.toLowerCase())
          shortenedLabelField =
            labelField
              .slice(Math.max(0, tidx - w), tidx + term.length + w)
              .trim() + '...'
        }
        const displayString =
          !context || labelField.toLowerCase() === context.toLowerCase()
            ? labelField.length > 40
              ? shortenedLabelField
              : labelField
            : `${labelField} (${context})`

        return new LocStringResult({
          locString: loc,
          label: labelField || recordIdentifier,
          displayString,
          matchedObject: result.map(record => decodeURIComponent(record)),
          trackId,
        })
      }
      // const labelField = fields[labelFieldIdx]
      // const contextField = fields[contextIdx]

      // let context
      // if (contextIdx !== labelFieldIdx) {
      //   const w = 15
      //   context = contextField
      //   if (contextField.length > 40) {
      //     const tidx = contextField.indexOf(term)
      //     context =
      //       '...' +
      //       contextField
      //         .slice(Math.max(0, tidx - w), tidx + term.length + w)
      //         .trim() +
      //       '...'
      //   }
      // }

      // const displayString =
      //   !context || labelField.toLowerCase() === context.toLowerCase()
      //     ? labelField.length > 40
      //       ? labelField.slice(0, 40) + '...'
      //       : labelField
      //     : `${labelField} (${context})`

      return new LocStringResult({
        locString: loc,
        label: recordIdentifier,
        matchedObject: result.map(record => decodeURIComponent(record)),
        trackId,
      })
    })

    // console.log(formatted)
    if (args.searchType === 'exact') {
      return formatted.filter(
        res => res.getLabel().toLowerCase() === args.queryString.toLowerCase(),
      )
    }
    return formatted
  }

  freeResources() {}
}
