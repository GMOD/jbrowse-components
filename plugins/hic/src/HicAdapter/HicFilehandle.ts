import { Buffer } from 'buffer'

import { openLocation } from '@jbrowse/core/util/io'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util'
import type { GenericFilehandle } from 'generic-filehandle2'

class HicFilehandle {
  constructor(private filehandle: GenericFilehandle) {}

  async read(position: number, length: number) {
    const buffer = await this.filehandle.read(length, position)
    return buffer
  }
}

export function openHicFilehandle(
  location: FileLocation,
  pluginManager?: PluginManager,
) {
  return new HicFilehandle(openLocation(location, pluginManager))
}
