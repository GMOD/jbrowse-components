---
id: jobslistmodel
title: JobsListModel
sidebar_label: Widget -> JobsListModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/jobs-management/src/JobsListWidget/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JobsListModel.md)

## Overview

<details open>
<summary>JobsListModel - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                           | Signature                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`id`](#property-id)             | `IOptionalIType<ISimpleType<string>, [undefined]>`                                                                                                                                                                                                                                                                                  |
| [`type`](#property-type)         | `ISimpleType<"JobsListWidget">`                                                                                                                                                                                                                                                                                                     |
| [`jobs`](#property-jobs)         | `IArrayType<IModelType<{ name: ISimpleType<string>; }, { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string \| undefined): void; setProgressPct(pct: number): void; }, _NotCustomized, _NotCustomized>>` |
| [`finished`](#property-finished) | `IArrayType<IModelType<{ name: ISimpleType<string>; }, { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string \| undefined): void; setProgressPct(pct: number): void; }, _NotCustomized, _NotCustomized>>` |
| [`queued`](#property-queued)     | `IArrayType<IModelType<{ name: ISimpleType<string>; }, { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string \| undefined): void; setProgressPct(pct: number): void; }, _NotCustomized, _NotCustomized>>` |
| [`aborted`](#property-aborted)   | `IArrayType<IModelType<{ name: ISimpleType<string>; }, { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string \| undefined): void; setProgressPct(pct: number): void; }, _NotCustomized, _NotCustomized>>` |

</details>

<details>
<summary>JobsListModel - Properties (all signatures)</summary>

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

<details open>
<summary>JobsListModel - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                     | Signature                                                                                                                                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`addJob`](#action-addjob)                                 | `(job: JobInput) => ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>`                  |
| [`removeJob`](#action-removejob)                           | `(jobName: string) => (ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>) \| undefined` |
| [`addFinishedJob`](#action-addfinishedjob)                 | `(job: JobInput) => ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>`                  |
| [`addQueuedJob`](#action-addqueuedjob)                     | `(job: JobInput) => ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>`                  |
| [`addAbortedJob`](#action-addabortedjob)                   | `(job: JobInput) => ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>`                  |
| [`removeQueuedJob`](#action-removequeuedjob)               | `(jobName: string) => (ModelInstanceTypeProps<{ name: ISimpleType<string>; }> & { cancelCallback(): void; statusMessage: string \| undefined; progressPct: number; } & { ...; } & IStateTreeNode<...>) \| undefined` |
| [`clearFinished`](#action-clearfinished)                   | `() => void`                                                                                                                                                                                                         |
| [`clearAborted`](#action-clearaborted)                     | `() => void`                                                                                                                                                                                                         |
| [`updateJobStatusMessage`](#action-updatejobstatusmessage) | `(jobName: string, message?: string \| undefined) => void`                                                                                                                                                           |
| [`updateJobProgressPct`](#action-updatejobprogresspct)     | `(jobName: string, pct: number) => void`                                                                                                                                                                             |

</details>

<details>
<summary>JobsListModel - Actions (all signatures)</summary>

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
