import {
  addDisposer,
  getParent,
  types,
  Instance,
  getSnapshot,
} from 'mobx-state-tree'
import { autorun, observable, toJS } from 'mobx'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  createTextSearchConf,
  findTrackConfigsToIndex,
} from '@jbrowse/text-indexing'

interface Track {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
interface TrackTextIndexing {
  attributes: string[]
  exclude: string[]
  assemblies: string[]
  tracks: string[] // trackIds
  indexType: string
}

type jobType = 'indexing' | 'test'
export interface JobsEntry {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any
  cancelCallback?: () => void
  progressPct?: number
  statusMessage?: string
  jobType?: jobType
}
export default function jobsModelFactory(pluginManager: PluginManager) {
  return types
    .model('JobsManager', {})
    .volatile(() => ({
      status: 0,
      running: false,
      statusMessage: '',
      abort: false,
      jobsQueue: observable.array([] as JobsEntry[]),
      finishedJobs: observable.array([] as JobsEntry[]),
    }))
    .views(self => ({
      get rpcManager() {
        return getParent(self).jbrowse.rpcManager
      },
      get tracks() {
        return getParent(self).jbrowse.tracks
      },
      get sessionPath() {
        return getParent(self).sessionPath
      },
      get session() {
        return getParent(self).session
      },
      get aggregateTextSearchAdapters() {
        return getParent(self).jbrowse.aggregateTextSearchAdapters
      },
      get location() {
        return getParent(self).sessionPath.substring(
          0,
          getParent(self).sessionPath.lastIndexOf('/'),
        )
      },
    }))
    .actions(self => ({
      setRunning(running: boolean) {
        self.running = running
      },
      setStatus(arg: string) {
        const progress = +arg
        if (isNaN(progress)) {
          this.setStatusMessage(arg)
        } else {
          self.status = progress
        }
      },
      setStatusMessage(arg: string) {
        self.statusMessage = arg
      },
      setAbort(abort: boolean) {
        self.abort = abort
      },
      addFinishedJob(entry: JobsEntry) {
        self.finishedJobs.push(entry)
      },
      queueJob(props: JobsEntry) {
        self.jobsQueue.push(props)
      },
      dequeueJob() {
        const entry = self.jobsQueue.splice(0, 1)[0]
        return entry
      },
      clear() {
        this.setRunning(false)
        this.setStatus('')
        this.setStatusMessage('')
        this.setAbort(false)
      },
      async runIndexingJob(entry: JobsEntry) {
        const {
          tracks: trackIds,
          exclude,
          attributes,
          assemblies,
          indexType,
        } = toJS(entry.params as TrackTextIndexing)
        const rpcManager = self.rpcManager
        const trackConfigs = findTrackConfigsToIndex(self.tracks, trackIds).map(
          conf => {
            return JSON.parse(JSON.stringify(getSnapshot(conf)))
          },
        )
        try {
          this.setRunning(true)
          const controller = new AbortController()
          const result = rpcManager.call(
            'indexTracksSessionId',
            'TextIndexRpcMethod',
            {
              tracks: trackConfigs,
              attributes,
              exclude,
              assemblies,
              indexType,
              outLocation: self.sessionPath,
              sessionId: 'indexTracksSessionId',
              statusCallback: (message: string) => {
                this.setStatus(message)
              },
              signal: controller.signal,
              timeout: 1000 * 60 * 60 * 1000, // 1000 hours, avoid user ever running into this
            },
          )
          await result
          if (indexType === 'perTrack') {
            // should update the single track conf
            trackIds.forEach(trackId => {
              this.addTrackTextSearchConf(
                trackId,
                assemblies,
                attributes,
                exclude,
              )
              self.session?.notify(
                `Succesfully indexed track with trackId: ${trackId} `,
                'success',
              )
            })
          } else {
            assemblies.forEach(assemblyName => {
              const indexedTrackIds = trackConfigs
                .filter(track =>
                  assemblyName
                    ? track.assemblyNames.includes(assemblyName)
                    : true,
                )
                .map(trackConf => trackConf.trackId)
              this.addAggregateTextSearchConf(indexedTrackIds, assemblyName)
              self.session?.notify(
                `Succesfully indexed assembly: ${assemblyName} `,
                'success',
              )
            })
          }
          // remove from the queue and add to finished/completed jobs
          const current = this.dequeueJob()
          current && this.addFinishedJob(current)
        } catch (e) {
          self.session?.notify(
            `An error occurred while indexing: ${e}`,
            'error',
            {
              name: 'Retry',
              onClick: () => {
                this.queueJob(entry)
              },
            },
          )
          // remove job from queue but since it was not successful
          // do not add to finished list
          this.dequeueJob()
        }
        // clear
        this.clear()
        return
      },
      async runJob() {
        if (self.jobsQueue.length) {
          const firstIndexingJob = self.jobsQueue[0] as JobsEntry
          // TODO: decide how to run that type of job
          // For now only running indexing jobs
          await this.runIndexingJob(firstIndexingJob)
        }
        return
      },
      addTrackTextSearchConf(
        trackId: string,
        assemblies: string[],
        attributes: string[],
        exclude: string[],
      ) {
        const currentTrackIdx = (self.session?.tracks as Track[]).findIndex(
          t => trackId === t.trackId,
        )
        // name of index
        const id = trackId + '-index'
        const adapterConf = createTextSearchConf(
          id,
          [trackId],
          assemblies,
          self.location,
        )
        self.session?.tracks[currentTrackIdx].textSearching.setSubschema(
          'textSearchAdapter',
          adapterConf,
        )
        self.session?.tracks[
          currentTrackIdx
        ].textSearching.indexingAttributes.set(attributes)
        self.session?.tracks[
          currentTrackIdx
        ].textSearching.indexingFeatureTypesToExclude.set(exclude)
      },
      addAggregateTextSearchConf(trackIds: string[], asm: string) {
        // name of index
        const id = asm + '-index'
        const foundIdx = self.aggregateTextSearchAdapters.findIndex(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (x: any) => x.textSearchAdapterId === id,
        )
        const trixConf = createTextSearchConf(
          id,
          trackIds,
          [asm],
          self.location,
        )
        if (foundIdx === -1) {
          self.aggregateTextSearchAdapters.push(trixConf)
        } else {
          self.aggregateTextSearchAdapters[foundIdx] = trixConf
        }
      },
      afterCreate() {
        addDisposer(
          self,
          autorun(
            async () => {
              if (self.jobsQueue?.length > 0 && self.running === false) {
                await this.runJob()
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }))
}

export type JobsStateModel = Instance<ReturnType<typeof jobsModelFactory>>
