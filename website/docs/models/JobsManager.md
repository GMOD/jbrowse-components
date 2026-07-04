---
id: jobsmanager
title: JobsManager
sidebar_label: General -> JobsManager
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/indexJobsModel.ts).

## Overview

Desktop text-indexing job queue: tracks the running job with its progress and
status message, plus the list of queued indexing jobs.

<details open>
<summary>JobsManager - Volatiles</summary>

#### volatile: stopToken

stop token for the currently running RPC indexing job, used to cancel

```ts
// type signature
type stopToken = StopToken | undefined
// code
stopToken: undefined as StopToken | undefined
```

#### volatile: aborted

set when the user cancels, so the catch block reports a cancellation rather than
an error

```ts
// type signature
type aborted = false
// code
aborted: false
```

</details>

<details>
<summary>JobsManager - Volatiles (other undocumented members)</summary>

#### volatile: running

```ts
// type signature
type running = false
// code
running: false
```

#### volatile: statusMessage

```ts
// type signature
type statusMessage = string
// code
statusMessage: ''
```

#### volatile: jobName

```ts
// type signature
type jobName = string
// code
jobName: ''
```

#### volatile: jobsQueue

```ts
// type signature
type jobsQueue = IObservableArray<TextJobsEntry>
// code
jobsQueue: observable.array<TextJobsEntry>([])
```

</details>

<details>
<summary>JobsManager - Getters</summary>

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

#### getter: tracks

```ts
type tracks = Track[]
```

#### getter: session

```ts
type session = SessionWithDrawerWidgets
```

#### getter: aggregateTextSearchAdapters

```ts
type aggregateTextSearchAdapters = { textSearchAdapterId: string }[]
```

</details>

<details>
<summary>JobsManager - Methods</summary>

#### method: getJobStatusWidget

```ts
type getJobStatusWidget = () => ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<"JobsListWidget">; jobs: IArrayType<IModelType<{ name: ISimpleType<string>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>; finished: IArrayType<...>; queued: IArrayType<...>; aborted: IArrayType<...>; }>...
```

</details>

<details open>
<summary>JobsManager - Actions</summary>

#### action: abortJob

cancel the currently running indexing job; the RPC throws 'aborted', handled in
runIndexingJob's catch

```ts
type abortJob = () => void
```

</details>

<details>
<summary>JobsManager - Actions (other undocumented members)</summary>

#### action: setRunning

```ts
type setRunning = (running: boolean) => void
```

#### action: setJobName

```ts
type setJobName = (name: string) => void
```

#### action: setStopToken

```ts
type setStopToken = (token?: StopToken | undefined) => void
```

#### action: reportStatus

```ts
type reportStatus = (arg: string) => void
```

#### action: setWidgetStatus

```ts
type setWidgetStatus = () => void
```

#### action: setStatusMessage

```ts
type setStatusMessage = (arg: string) => void
```

#### action: queueJob

```ts
type queueJob = (props: TextJobsEntry) => void
```

#### action: dequeueJob

```ts
type dequeueJob = () => TextJobsEntry | undefined
```

#### action: clear

```ts
type clear = () => void
```

#### action: runIndexingJob

```ts
type runIndexingJob = (entry: TextJobsEntry) => Promise<void>
```

#### action: runJob

```ts
type runJob = () => Promise<void>
```

#### action: addTrackTextSearchConf

```ts
type addTrackTextSearchConf = ({
  trackId,
  assemblies,
  attributes,
  exclude,
  outLocation,
}: {
  trackId: string
  assemblies: string[]
  attributes: string[]
  exclude: string[]
  outLocation: string
}) => void
```

#### action: addAggregateTextSearchConf

```ts
type addAggregateTextSearchConf = ({
  trackIds,
  assemblyName,
  outLocation,
}: {
  trackIds: string[]
  assemblyName: string
  outLocation: string
}) => void
```

</details>
