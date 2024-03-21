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

#### property: aborted

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; progressPct: ISimpleType<number>; statusMessage: IMaybe<ISimpleType<string>>; }, { cancelCallback(): void; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
aborted: types.array(Job)
```

#### property: finished

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; progressPct: ISimpleType<number>; statusMessage: IMaybe<ISimpleType<string>>; }, { cancelCallback(): void; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
finished: types.array(Job)
```

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: jobs

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; progressPct: ISimpleType<number>; statusMessage: IMaybe<ISimpleType<string>>; }, { cancelCallback(): void; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
jobs: types.array(Job)
```

#### property: queued

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; progressPct: ISimpleType<number>; statusMessage: IMaybe<ISimpleType<string>>; }, { cancelCallback(): void; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
queued: types.array(Job)
```

#### property: type

```js
// type signature
ISimpleType<"JobsListWidget">
// code
type: types.literal('JobsListWidget')
```

### JobsListModel - Actions

#### action: addAbortedJob

```js
// type signature
addAbortedJob: (job: NewJob) => IMSTArray<IModelType<{ name: ISimpleType<string>; progressPct: ISimpleType<number>; statusMessage: IMaybe<ISimpleType<string>>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>
```

#### action: addFinishedJob

```js
// type signature
addFinishedJob: (job: NewJob) => IMSTArray<IModelType<{ name: ISimpleType<string>; progressPct: ISimpleType<number>; statusMessage: IMaybe<ISimpleType<string>>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>
```

#### action: addJob

```js
// type signature
addJob: (job: NewJob) => { name: string; progressPct: number; statusMessage: string; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setProgressPct(pct: number): void; setStatusMessage(message?: string): void; } & IStateTreeNode<...>
```

#### action: addQueuedJob

```js
// type signature
addQueuedJob: (job: NewJob) => IMSTArray<IModelType<{ name: ISimpleType<string>; progressPct: ISimpleType<number>; statusMessage: IMaybe<ISimpleType<string>>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>
```

#### action: removeJob

```js
// type signature
removeJob: (jobName: string) => { name: string; progressPct: number; statusMessage: string; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setProgressPct(pct: number): void; setStatusMessage(message?: string): void; } & IStateTreeNode<...>
```

#### action: removeQueuedJob

```js
// type signature
removeQueuedJob: (jobName: string) => { name: string; progressPct: number; statusMessage: string; } & NonEmptyObject & { cancelCallback(): void; } & { setCancelCallback(cancelCallback: () => void): void; setProgressPct(pct: number): void; setStatusMessage(message?: string): void; } & IStateTreeNode<...>
```

#### action: updateJobProgressPct

```js
// type signature
updateJobProgressPct: (jobName: string, pct: number) => void
```

#### action: updateJobStatusMessage

```js
// type signature
updateJobStatusMessage: (jobName: string, message?: string) => void
```
