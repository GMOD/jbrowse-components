import { BaseRefNameAliasAdapter, Alias } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { GenericFilehandle } from 'generic-filehandle'

export default class RefNameAliasAdapter extends BaseRefNameAliasAdapter {
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
    return results
      .trim()
      .split('\n')
      .map((row: string) => {
        const [refName, ...aliases] = row.split('\t')
        return { refName, aliases }
      })
  }

  getRefNameAliases(): Promise<Alias[]> {
    return this.promise
  }
}
