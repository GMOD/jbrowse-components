import { createDisplayTestEnvironment as createKitEnvironment } from '@jbrowse/display-kit/conformance/displayTestEnvironment'

import type { DisplayTestEnvironmentOptions as KitOptions } from '@jbrowse/display-kit/conformance/displayTestEnvironment'

export interface DisplayTestEnvironmentOptions extends Omit<
  KitOptions,
  'rpcCall'
> {
  /**
   * The body `mockRpcCall` is a `jest.fn()` over. Bare by default, which never
   * settles for any method, the default the kit's `rpcCall` asks for.
   */
  rpcCall?: KitOptions['rpcCall']
}

/**
 * The kit's harness with jest supplying the mock: `mockRpcCall` is typed as a
 * bare `jest.Mock`, never narrowed to `rpcCall`'s signature, since callers
 * `mockImplementation` it with the arg shapes their own display expects.
 *
 * Pending rather than rejected by default because the stub arrives AFTER
 * `createDisplay` in most suites, and the fetch that runs in between must not
 * decide anything.
 */
export function createDisplayTestEnvironment<T>({
  rpcCall = () => new Promise(() => {}),
  ...options
}: DisplayTestEnvironmentOptions) {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md), and silencing it would swallow every violation
  // report the jest gate exists to catch.
  console.warn = jest.fn()
  const mockRpcCall: jest.Mock = jest.fn(rpcCall)
  const { createDisplay, pluginManager, trackConfig } = createKitEnvironment<T>(
    { ...options, rpcCall: mockRpcCall },
  )
  return {
    createDisplay: (...args: Parameters<typeof createDisplay>) => ({
      ...createDisplay(...args),
      mockRpcCall,
    }),
    mockRpcCall,
    pluginManager,
    trackConfig,
  }
}
