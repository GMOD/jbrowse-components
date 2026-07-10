import type {
  RpcArgs,
  RpcMethodName,
  RpcReturn,
} from '@jbrowse/core/rpc/RpcRegistry'

// Narrow structural slice of RpcManager: just `call`, typed straight off the
// RpcRegistry entry for method `M` (so it can't drift from the real RPC method).
// Kept separate from the real RpcManager class — which has private members — so
// a plain mock object can stand in for it in tests without an unsafe cast. Every
// `run*Clustering` helper types its `rpcManager` param as one of these.
export interface RpcMethodCaller<M extends RpcMethodName> {
  call: (
    sessionId: string,
    functionName: M,
    args: Omit<RpcArgs<M>, 'sessionId'>,
  ) => Promise<RpcReturn<M>>
}
