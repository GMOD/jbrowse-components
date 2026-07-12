---
id: jobslistmodel
title: JobsListModel
sidebar_label: Widget -> JobsListModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`jobs-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/jobs-management/src/JobsListWidget/model.ts).

## Overview

## Members

| Member                                                   | Kind       | Defined by    | Description |
| -------------------------------------------------------- | ---------- | ------------- | ----------- |
| [id](#property-id)                                       | Properties | JobsListModel |             |
| [type](#property-type)                                   | Properties | JobsListModel |             |
| [jobs](#property-jobs)                                   | Properties | JobsListModel |             |
| [finished](#property-finished)                           | Properties | JobsListModel |             |
| [queued](#property-queued)                               | Properties | JobsListModel |             |
| [aborted](#property-aborted)                             | Properties | JobsListModel |             |
| [addJob](#action-addjob)                                 | Actions    | JobsListModel |             |
| [removeJob](#action-removejob)                           | Actions    | JobsListModel |             |
| [addFinishedJob](#action-addfinishedjob)                 | Actions    | JobsListModel |             |
| [addQueuedJob](#action-addqueuedjob)                     | Actions    | JobsListModel |             |
| [addAbortedJob](#action-addabortedjob)                   | Actions    | JobsListModel |             |
| [removeQueuedJob](#action-removequeuedjob)               | Actions    | JobsListModel |             |
| [clearFinished](#action-clearfinished)                   | Actions    | JobsListModel |             |
| [clearAborted](#action-clearaborted)                     | Actions    | JobsListModel |             |
| [updateJobStatusMessage](#action-updatejobstatusmessage) | Actions    | JobsListModel |             |
| [updateJobProgressPct](#action-updatejobprogresspct)     | Actions    | JobsListModel |             |

<details>
<summary>JobsListModel - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<'JobsListWidget'>
// code
type: types.literal('JobsListWidget')
```

#### property: jobs

```ts
// type signature
type jobs = IArrayType<
  IModelType<
    { name: ISimpleType<string> },
    {
      cancelCallback(): void
      statusMessage: string | undefined
      progressPct: number
    } & {
      setCancelCallback(cancelCallback: () => void): void
      setStatusMessage(message?: string | undefined): void
      setProgressPct(pct: number): void
    },
    _NotCustomized,
    _NotCustomized
  >
>
// code
jobs: types.array(Job)
```

#### property: finished

```ts
// type signature
type finished = IArrayType<
  IModelType<
    { name: ISimpleType<string> },
    {
      cancelCallback(): void
      statusMessage: string | undefined
      progressPct: number
    } & {
      setCancelCallback(cancelCallback: () => void): void
      setStatusMessage(message?: string | undefined): void
      setProgressPct(pct: number): void
    },
    _NotCustomized,
    _NotCustomized
  >
>
// code
finished: types.array(Job)
```

#### property: queued

```ts
// type signature
type queued = IArrayType<
  IModelType<
    { name: ISimpleType<string> },
    {
      cancelCallback(): void
      statusMessage: string | undefined
      progressPct: number
    } & {
      setCancelCallback(cancelCallback: () => void): void
      setStatusMessage(message?: string | undefined): void
      setProgressPct(pct: number): void
    },
    _NotCustomized,
    _NotCustomized
  >
>
// code
queued: types.array(Job)
```

#### property: aborted

```ts
// type signature
type aborted = IArrayType<
  IModelType<
    { name: ISimpleType<string> },
    {
      cancelCallback(): void
      statusMessage: string | undefined
      progressPct: number
    } & {
      setCancelCallback(cancelCallback: () => void): void
      setStatusMessage(message?: string | undefined): void
      setProgressPct(pct: number): void
    },
    _NotCustomized,
    _NotCustomized
  >
>
// code
aborted: types.array(Job)
```

</details>

<details>
<summary>JobsListModel - Actions</summary>

#### action: addJob

```ts
type addJob = (job: JobInput) => ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string | undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>
```

#### action: removeJob

```ts
type removeJob = (jobName: string) => (ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string | undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>) | undefined
```

#### action: addFinishedJob

```ts
type addFinishedJob = (job: JobInput) => ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string | undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>
```

#### action: addQueuedJob

```ts
type addQueuedJob = (job: JobInput) => ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string | undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>
```

#### action: addAbortedJob

```ts
type addAbortedJob = (job: JobInput) => ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string | undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>
```

#### action: removeQueuedJob

```ts
type removeQueuedJob = (jobName: string) => (ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string | undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>) | undefined
```

#### action: clearFinished

```ts
type clearFinished = () => void
```

#### action: clearAborted

```ts
type clearAborted = () => void
```

#### action: updateJobStatusMessage

```ts
type updateJobStatusMessage = (
  jobName: string,
  message?: string | undefined,
) => void
```

#### action: updateJobProgressPct

```ts
type updateJobProgressPct = (jobName: string, pct: number) => void
```

</details>
