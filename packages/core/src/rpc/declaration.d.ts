declare module 'librpc-web-mod' {
  interface ConstructorArgs {
    workers: Worker[]
  }

  export class Client {
    constructor(args: ConstructorArgs)

    workers: Worker[]

    on(channel: string, listener: (message: string) => void)

    off(channel: string, listener: (message: string) => void)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call(functionName: string, args?: any, options?: Record<string, any>): any
  }
}
