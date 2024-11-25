import { Buffer } from 'buffer'
import { openLocation } from '@jbrowse/core/util/io'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util'
import type { GenericFilehandle } from 'generic-filehandle'

// wraps generic-filehandle so the read function only takes a position and
// length
//
// in some ways, generic-filehandle wishes it was just this but it has
// to adapt to the node.js fs promises API
class HicFilehandle {
  constructor(private filehandle: GenericFilehandle) {}

  async read(position: number, length: number) {
    const { buffer } = await this.filehandle.read(
      Buffer.alloc(length),
      0,
      length,
      position,
    )
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    )
  }
}

export function openHicFilehandle(
  location: FileLocation,
  pluginManager?: PluginManager,
) {
  return new HicFilehandle(openLocation(location, pluginManager))
}
