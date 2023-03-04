export interface RenderProps {
  rendererType: any // eslint-disable-line @typescript-eslint/no-explicit-any
  renderArgs: { [key: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  renderProps: { [key: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  displayError: unknown
  rpcManager: { call: Function }
  cannotBeRenderedReason: string
}

export interface ErrorProps {
  displayError: string
}

export function getDisplayStr(totalBytes: number) {
  let displayBp
  if (Math.floor(totalBytes / 1000000) > 0) {
    displayBp = `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Math.floor(totalBytes / 1000) > 0) {
    displayBp = `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    displayBp = `${Math.floor(totalBytes)} bytes`
  }
  return displayBp
}
