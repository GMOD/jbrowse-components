---
id: jobslistmodel
title: JobsListModel
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

## Docs

### JobsListModel - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"JobsListWidget">
// code
type: types.literal('JobsListWidget')
```

#### property: jobs

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: ISimpleType<number>; }, { cancelCallback(): void; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
jobs: types.array(Job)
```

#### property: finished

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: ISimpleType<number>; }, { cancelCallback(): void; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
finished: types.array(Job)
```

#### property: queued

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: ISimpleType<number>; }, { cancelCallback(): void; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
queued: types.array(Job)
```

#### property: aborted

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: ISimpleType<number>; }, { cancelCallback(): void; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
aborted: types.array(Job)
```

### JobsListModel - Actions

#### action: addJob

```js
// type signature
addJob: (job: NewJob) => { name: string; statusMessage: string; progressPct: number; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string): void; setProgressPct(pct: number): void; } & IStateTreeNode<...>
```

#### action: removeJob

```js
// type signature
removeJob: (jobName: string) => { name: string; statusMessage: string; progressPct: number; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string): void; setProgressPct(pct: number): void; } & IStateTreeNode<...>
```

#### action: addFinishedJob

```js
// type signature
addFinishedJob: (job: NewJob) => { name: string; statusMessage: string; progressPct: number; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string): void; setProgressPct(pct: number): void; } & IStateTreeNode<...>
```

#### action: addQueuedJob

```js
// type signature
addQueuedJob: (job: NewJob) => { name: string; statusMessage: string; progressPct: number; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string): void; setProgressPct(pct: number): void; } & IStateTreeNode<...>
```

#### action: addAbortedJob

```js
// type signature
addAbortedJob: (job: NewJob) => { name: string; statusMessage: string; progressPct: number; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string): void; setProgressPct(pct: number): void; } & IStateTreeNode<...>
```

#### action: removeQueuedJob

```js
// type signature
removeQueuedJob: (jobName: string) => { name: string; statusMessage: string; progressPct: number; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setStatusMessage(message?: string): void; setProgressPct(pct: number): void; } & IStateTreeNode<...>
```

#### action: updateJobStatusMessage

```js
// type signature
updateJobStatusMessage: (jobName: string, message?: string) => void
```

#### action: updateJobProgressPct

```js
// type signature
updateJobProgressPct: (jobName: string, pct: number) => void
```
