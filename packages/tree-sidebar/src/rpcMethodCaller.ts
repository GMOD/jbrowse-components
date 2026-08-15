import type {
  RpcCallArgs,
  RpcMethodName,
  RpcReturn,
} from '@jbrowse/core/rpc/RpcRegistry'

// Narrow structural slice of RpcManager: just `call`, typed straight off the
// RpcRegistry entry for method `M` (so it can't drift from the real RPC method).
// Kept separate from the real RpcManager class — which has private members — so
// a plain mock object can stand in for it in tests without an unsafe cast. Every
// `run*Clustering` helper types its `rpcManager` param as one of these.
//
// `RpcCallArgs`, not a local `Omit<RpcArgs<M>, 'sessionId'>`. That expression was
// written out here as well as in `RpcManager`, and a structural slice that
// restates the shape it is a slice OF is a copy: when the handles became part of
// every call this was the one that did not follow, so the three clustering
// helpers could no longer pass a stop token to the RPC they exist to drive.
export interface RpcMethodCaller<M extends RpcMethodName> {
  call: (
    sessionId: string,
    functionName: M,
    args: RpcCallArgs<M>,
  ) => Promise<RpcReturn<M>>
}
