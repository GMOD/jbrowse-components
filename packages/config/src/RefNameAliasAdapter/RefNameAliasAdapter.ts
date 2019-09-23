import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Observable } from 'rxjs'

/**
 * Adapter that just returns the features defined in its `features` configuration
 * key, like:
 *   "features": [ { "refName": "ctgA", "start":1, "end":20 }, ... ]
 */
interface Alias {
  refName: string
  aliases: string[]
}

export default class RefNameAliasAdapter extends BaseAdapter {
  public static capabilities = ['getRefNameAliases']

  private location: any

  private promise: Promise<Alias[]>

  constructor(config: { location: IFileLocation }) {
    super()
    console.log(config.location)
    this.location = openLocation(config.location)
    this.promise = (async () => {
      const results = await this.location.readFile('utf8')
      return results.split('\n').map((row: string) => {
        const [refName, ...aliases] = results.split('\t')
        return { refName, aliases }
      })
    })()
  }

  async getRefNameAliases(): Promise<Alias[]> {
    const res = await this.promise
    console.log('here', res)
    return this.promise
  }

  async getRefNames(): Promise<string[]> {
    const res = await this.promise
    return res.map((a: Alias) => a.refName)
  }

  getFeatures(): Observable<Feature> {
    return new Observable<Feature>()
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}
}
