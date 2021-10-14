import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
 
// just make sure to add your extra dependencies to plugins/linear-genome-view/package.json
import { runBinaryBigsiQuery } from './query_bigsi'
 
export class BigsiQueryRPC extends RpcMethodType {
  name = 'BigsiQueryRPC'
 
  async deserializeArguments(args: any) {
    const l = await super.deserializeArguments(args)
    return {
      ...l,
      filters: args.filters
        ? new SerializableFilterChain({
            filters: args.filters,
          })
        : undefined,
    }
  }
 
  async execute(
    args: {
      querySequence: string
      sessionId: string
    },
  ) {
    const deserializedArgs = await this.deserializeArguments(args)
    const { querySequence, sessionId } = deserializedArgs
    const results = await runBinaryBigsiQuery(querySequence)
    return results
  }
}
