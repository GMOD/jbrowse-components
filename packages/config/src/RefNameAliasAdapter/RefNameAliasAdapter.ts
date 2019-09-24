import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Observable } from 'rxjs'
import { GenericFilehandle } from 'generic-filehandle'

interface Alias {
  refName: string
  aliases: string[]
}

export default class RefNameAliasAdapter extends BaseAdapter {
  public static capabilities = ['getRefNameAliases']

  private location: GenericFilehandle

  private promise: Promise<Alias[]>

  constructor(config: { location: IFileLocation }) {
    super()
    this.location = openLocation(config.location)
    this.promise = this.downloadResults()
  }

  private async downloadResults(): Promise<Alias[]> {
    const results = (await this.location.readFile('utf8')) as string
    return results.split('\n').map((row: string) => {
      const [refName, ...aliases] = results.split('\t')
      return { refName, aliases }
    })
  }

  getRefNameAliases(): Promise<Alias[]> {
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
