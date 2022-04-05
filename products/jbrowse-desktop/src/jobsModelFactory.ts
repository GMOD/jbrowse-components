import { types, Instance } from 'mobx-state-tree'
import { observable } from 'mobx'
import PluginManager from '@jbrowse/core/PluginManager'

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
export default function jobsModelFactory(pluginMnager: PluginManager) {
  return types
    .model('JobsModel2', {})
    .volatile(() => ({
      indexingStatus: 0 as number,
      running: false,
      indexingQueue: observable.array([] as TrackTextIndexing[]),
      finishedJobs: observable.array([] as TrackTextIndexing[]),
    }))
    .actions(self => ({
      setRunning(running: boolean) {
        self.running = running
        console.log('Running', running)
      },
      setIndexingStatus(arg: string) {
        const progress = arg ? +arg : 0
        self.indexingStatus = progress
      },
      addFinishedJob(entry: TrackTextIndexing) {
        self.finishedJobs.push(entry)
      },
      queueIndexingJob(props: TrackTextIndexing) {
        self.indexingQueue.push(props)
      },
      dequeueIndexingJob() {
        const entry = self.indexingQueue.splice(0, 1)[0]
        return entry
      },
    }))
}

export type JobsStateModel2 = Instance<ReturnType<typeof jobsModelFactory>>
