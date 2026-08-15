export { default as RpcClient } from '../rpc/RpcClient.ts'
export {
  default as RpcServer,
  rpcResult,
  rpcResultWithArrayBuffers,
} from '../rpc/RpcServer.ts'
export type { RpcResult } from '../rpc/RpcServer.ts'
// the inverse of rpcResult, for a deserializeReturn rebuilding the caller's
// value out of what the worker sent
export { isRpcResult, unwrapRpcResult } from './rpc.ts'
export {
  deserializeError,
  serializeError,
} from '../rpc/serializeError/index.ts'
