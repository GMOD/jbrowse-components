import { isStateTreeNode, isAlive } from 'mobx-state-tree'
import { objectFromEntries } from '../util'
import { serializeAbortSignal } from './remoteAbortSignals'

declare global {
  interface Window {
    electronBetterIpc: {
      ipcRenderer?: import('electron-better-ipc-extra').RendererProcessIpc
    }
    electron?: import('electron').AllElectron
  }
}
const { electronBetterIpc = {}, electron } = window

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isClonable(thing: any): boolean {
  if (typeof thing === 'function') return false
  if (thing instanceof Error) return false
  return true
}

const WORKER_MAX_PING_TIME = 30 * 1000 // 30 secs

// watches the given worker object, returns a promise that will be rejected if
// the worker times out
function watchWorker(
  rpcWorkerHandle: import('electron').BrowserWindow,
  pingTime: number,
  ipcRenderer: import('electron-better-ipc-extra').RendererProcessIpc,
): Promise<void> {
  return new Promise((resolve, reject): void => {
    let pingIsOK = true
    const watcherInterval = setInterval(() => {
      if (!pingIsOK) {
        clearInterval(watcherInterval)
        reject(
          new Error(
            `worker look longer than ${pingTime} ms to respond. terminated.`,
          ),
        )
      } else {
        pingIsOK = false
        ipcRenderer.callRenderer(rpcWorkerHandle, 'ping').then(() => {
          pingIsOK = true
        })
      }
    }, pingTime)
  })
}

export default class ElectronRpcDriver {
  private electronRemote: import('electron').Remote

  private lastWorkerAssignment = -1

  private workerAssignments = new Map() // stateGroupName -> worker number

  private workerCount = 0

  private workerCreationChannel: string

  private workerPool?: import('electron').BrowserWindow[]

  private ipcRenderer: import('electron-better-ipc-extra').RendererProcessIpc

  constructor({ workerCreationChannel }: { workerCreationChannel: string }) {
    if (!electron)
      throw new Error(
        'Cannot use ElectronRpcDriver without electron available globally',
      )
    this.electronRemote = electron.remote
    const { ipcRenderer } = electronBetterIpc
    if (!ipcRenderer)
      throw new Error(
        'Cannot use ElectronRpcDriver without ipcRenderer from electron-better-ipc-extra',
      )
    this.ipcRenderer = ipcRenderer
    this.workerCreationChannel = workerCreationChannel
  }

  // filter the given object and just remove any non-clonable things from it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterArgs(thing: any, pluginManager: any, stateGroupName: string): any {
    if (Array.isArray(thing)) {
      return thing
        .filter(isClonable)
        .map(t => this.filterArgs(t, pluginManager, stateGroupName))
    }
    if (typeof thing === 'object') {
      // AbortSignals are specially handled
      if (thing instanceof AbortSignal) {
        return serializeAbortSignal(
          thing,
          this.call.bind(this, pluginManager, stateGroupName),
        )
      }

      if (isStateTreeNode(thing) && !isAlive(thing))
        throw new Error('dead state tree node passed to RPC call')
      const newobj = objectFromEntries(
        Object.entries(thing)
          .filter(e => isClonable(e[1]))
          .map(([k, v]) => [
            k,
            this.filterArgs(v, pluginManager, stateGroupName),
          ]),
      )
      return newobj
    }
    return thing
  }

  createWorkerPool(): import('electron').BrowserWindow[] {
    const hardwareConcurrency =
      typeof window !== 'undefined' ? window.navigator.hardwareConcurrency : 2
    const workerCount = this.workerCount || Math.max(1, hardwareConcurrency - 2)

    const makeWorker = (): import('electron').BrowserWindow => {
      const windowWorkerId = this.ipcRenderer.sendSync('createWindowWorker')
      return this.electronRemote.BrowserWindow.fromId(windowWorkerId)
    }

    const workerHandles: import('electron').BrowserWindow[] = new Array(
      workerCount,
    )
    for (let i = 0; i < workerCount; i += 1) {
      workerHandles[i] = makeWorker()
    }

    const watchAndReplaceWorker = (
      rpcWorkerHandle: import('electron').BrowserWindow,
      workerIndex: number,
    ): void => {
      watchWorker(
        rpcWorkerHandle,
        WORKER_MAX_PING_TIME,
        this.ipcRenderer,
      ).catch(() => {
        console.warn(
          `worker ${workerIndex +
            1} did not respond within ${WORKER_MAX_PING_TIME} ms, terminating and replacing.`,
        )
        rpcWorkerHandle.destroy()
        workerHandles[workerIndex] = makeWorker()
        watchAndReplaceWorker(workerHandles[workerIndex], workerIndex)
      })
    }

    // for each worker, make a ping timer that will kill it and start a new one if it does not
    // respond to a ping within a certain time
    workerHandles.forEach(watchAndReplaceWorker)

    return workerHandles
  }

  getWorkerPool(): import('electron').BrowserWindow[] {
    if (!this.workerPool) {
      this.workerPool = this.createWorkerPool()
    }
    return this.workerPool
  }

  getWorker(stateGroupName: string): import('electron').BrowserWindow {
    const workers = this.getWorkerPool()
    if (!this.workerAssignments.has(stateGroupName)) {
      const workerAssignment = (this.lastWorkerAssignment + 1) % workers.length
      this.workerAssignments.set(stateGroupName, workerAssignment)
      this.lastWorkerAssignment = workerAssignment
    }

    const workerNumber = this.workerAssignments.get(stateGroupName)
    // console.log(stateGroupName, workerNumber)
    const worker = workers[workerNumber]
    if (!worker) {
      throw new Error('no web workers registered for RPC')
    }
    return worker
  }

  call(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pluginManager: any,
    stateGroupName: string,
    functionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[],
    options = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    if (stateGroupName === undefined) {
      throw new TypeError('stateGroupName is required')
    }
    const worker = this.getWorker(stateGroupName)
    const filteredArgs = this.filterArgs(args, pluginManager, stateGroupName)
    return this.ipcRenderer.callRenderer(
      worker,
      'call',
      functionName,
      filteredArgs,
      {
        timeout: 5 * 60 * 1000, // 5 minutes
        ...options,
      },
    )
  }
}
