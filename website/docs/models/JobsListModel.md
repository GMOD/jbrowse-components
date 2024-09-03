---
id: jobslistmodel
title: JobsListModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/jobs-management/src/JobsListWidget/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/jobs-management/src/JobsListWidget/model.ts)

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
addFinishedJob: (job: NewJob) => IMSTArray<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: ISimpleType<number>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>
```

#### action: addQueuedJob

```js
// type signature
addQueuedJob: (job: NewJob) => IMSTArray<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: ISimpleType<number>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>
```

#### action: addAbortedJob

```js
// type signature
addAbortedJob: (job: NewJob) => IMSTArray<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: ISimpleType<number>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>
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
