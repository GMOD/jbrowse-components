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
import { isAbortException, isSessionModelWithWidgets } from '@jbrowse/core/util'

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

interface JobsEntry {
  name: string
  cancelCallback?: () => void
  progressPct?: number
  statusMessage?: string
}
export interface TextJobsEntry extends JobsEntry {
  name: string
  indexingParams: TrackTextIndexing
  cancelCallback?: () => void
  progressPct?: number
  statusMessage?: string
}

export default function jobsModelFactory(pluginManager: PluginManager) {
  return types
    .model('JobsManager', {})
    .volatile(() => ({
      running: false,
      statusMessage: '',
      progressPct: 0,
      jobName: '',
      controller: new AbortController(),
      jobsQueue: observable.array([] as TextJobsEntry[]),
      finishedJobs: observable.array([] as TextJobsEntry[]),
    }))
    .views(self => ({
      get rpcManager() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).jbrowse.rpcManager
      },
      get tracks() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).jbrowse.tracks
      },
      get sessionPath() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).sessionPath
      },
      get session() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).session
      },
      get aggregateTextSearchAdapters() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).jbrowse.aggregateTextSearchAdapters
      },
      get location() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const path = getParent<any>(self).sessionPath
        return path.slice(0, Math.max(0, path.lastIndexOf('/')))
      },
    }))
    .actions(self => ({
      getJobStatusWidget() {
        const { session } = self
        const { widgets } = session
        let jobStatusWidget = widgets.get('JobsList')
        if (!jobStatusWidget) {
          jobStatusWidget = session.addWidget('JobsListWidget', 'JobsList')
        }
        return jobStatusWidget
      },
    }))
    .actions(self => ({
      setRunning(running: boolean) {
        self.running = running
      },
      setJobName(name: string) {
        self.jobName = name
      },
      setProgressPct(arg: string) {
        const progress = +arg
        if (Number.isNaN(progress)) {
          this.setStatusMessage(arg)
        } else {
          progress === 100 && this.setStatusMessage('Generating ixIxx files.')
          self.progressPct = progress
        }
        this.setWidgetStatus()
      },
      setWidgetStatus() {
        const jobStatusWidget = self.getJobStatusWidget()
        jobStatusWidget.updateJobStatusMessage(self.jobName, self.statusMessage)
        jobStatusWidget.updateJobProgressPct(self.jobName, self.progressPct)
      },
      setStatusMessage(arg: string) {
        self.statusMessage = arg
      },
      abortJob() {
        self.controller.abort()
      },
      addFinishedJob(entry: TextJobsEntry) {
        self.finishedJobs.push(entry)
      },
      queueJob(props: TextJobsEntry) {
        const { session } = self
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          session.showWidget(jobStatusWidget)
          const { name, statusMessage, progressPct, cancelCallback } = props
          jobStatusWidget.addQueuedJob({
            name,
            statusMessage: statusMessage || '',
            progressPct: progressPct || 0,
            cancelCallback,
          })
        }
        self.jobsQueue.push(props)
      },
      dequeueJob() {
        const { session } = self
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          jobStatusWidget.removeJob(self.jobName)
        }
        const entry = self.jobsQueue.splice(0, 1)[0]
        return entry
      },
      clear() {
        this.setRunning(false)
        this.setStatusMessage('')
        this.setJobName('')
        self.progressPct = 0
        self.controller = new AbortController()
      },
      async runIndexingJob(entry: TextJobsEntry) {
        const { session } = self
        const {
          tracks: trackIds,
          exclude,
          attributes,
          assemblies,
          indexType,
        } = toJS(entry.indexingParams)
        const rpcManager = self.rpcManager
        const trackConfigs = findTrackConfigsToIndex(self.tracks, trackIds).map(
          conf => {
            return JSON.parse(JSON.stringify(getSnapshot(conf)))
          },
        )
        try {
          this.setRunning(true)
          this.setJobName(entry.name)
          const { signal } = self.controller
          await rpcManager.call('indexTracksSessionId', 'TextIndexRpcMethod', {
            tracks: trackConfigs,
            attributes,
            exclude,
            assemblies,
            indexType,
            outLocation: self.sessionPath,
            sessionId: 'indexTracksSessionId',
            statusCallback: (message: string) => {
              this.setProgressPct(message)
            },
            signal: signal,
            timeout: 1000 * 60 * 60 * 1000, // 1000 hours, avoid user ever running into this
          })
          // await result
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
                `Successfully indexed track with trackId: ${trackId} `,
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
                `Successfully indexed assembly: ${assemblyName} `,
                'success',
              )
            })
          }
          // remove from the queue and add to finished/completed jobs
          const current = this.dequeueJob()
          current && this.addFinishedJob(current)
          if (isSessionModelWithWidgets(session)) {
            const jobStatusWidget = self.getJobStatusWidget()
            session.showWidget(jobStatusWidget)
            const { name, statusMessage, progressPct, cancelCallback } = current
            jobStatusWidget.addFinishedJob({
              name,
              statusMessage: statusMessage || 'done',
              progressPct: progressPct || 100,
              cancelCallback,
            })
          }
        } catch (e) {
          if (isAbortException(e)) {
            self.session?.notify(`Cancelled job`, 'info')
          } else {
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
          }
          // remove job from queue but since it was not successful
          // do not add to finished list
          this.dequeueJob()
        }
        // clear
        this.clear()
        return
      },
      async runJob() {
        const { session } = self
        if (self.jobsQueue.length) {
          const firstIndexingJob = self.jobsQueue[0]
          if (isSessionModelWithWidgets(session)) {
            const jobStatusWidget = self.getJobStatusWidget()
            session.showWidget(jobStatusWidget)
            const { name, statusMessage, progressPct, cancelCallback } =
              firstIndexingJob
            jobStatusWidget.addJob({
              name,
              statusMessage: statusMessage || '',
              progressPct: progressPct || 0,
              cancelCallback,
            })
            jobStatusWidget.removeQueuedJob(name)
          }
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
