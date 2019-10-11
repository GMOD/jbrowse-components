declare module '@librpc/web' {
  interface ConstructorArgs {
    workers: Worker[]
  }

  export class Client {
    constructor(args: ConstructorArgs)

    workers: Worker[]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call(functionName: string, args?: any, options?: Record<string, any>): any
  }
}
