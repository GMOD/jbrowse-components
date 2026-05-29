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
IArrayType<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [undefined]>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
jobs: types.array(Job)
```

#### property: finished

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [undefined]>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
finished: types.array(Job)
```

#### property: queued

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [undefined]>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
queued: types.array(Job)
```

#### property: aborted

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [undefined]>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
aborted: types.array(Job)
```

### JobsListModel - Actions

#### action: addJob

```js
// type signature
addJob: (job: NewJob) => ModelInstanceTypeProps<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [...]>; }> & { ...; } & { ...; } & IStateTreeNode<...>
```

#### action: removeJob

```js
// type signature
removeJob: (jobName: string) => (ModelInstanceTypeProps<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [...]>; }> & { ...; } & { ...; } & IStateTreeNode<...>) | undefined
```

#### action: addFinishedJob

```js
// type signature
addFinishedJob: (job: ModelCreationType<ExtractCFromProps<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [undefined]>; }>>) => ModelInstanceTypeProps<...> & ... 2 more ... & IStateTreeNode<...>
```

#### action: addQueuedJob

```js
// type signature
addQueuedJob: (job: ModelCreationType<ExtractCFromProps<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [undefined]>; }>>) => ModelInstanceTypeProps<...> & ... 2 more ... & IStateTreeNode<...>
```

#### action: addAbortedJob

```js
// type signature
addAbortedJob: (job: ModelCreationType<ExtractCFromProps<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [undefined]>; }>>) => ModelInstanceTypeProps<...> & ... 2 more ... & IStateTreeNode<...>
```

#### action: removeQueuedJob

```js
// type signature
removeQueuedJob: (jobName: string) => (ModelInstanceTypeProps<{ name: ISimpleType<string>; statusMessage: IMaybe<ISimpleType<string>>; progressPct: IOptionalIType<ISimpleType<number>, [...]>; }> & { ...; } & { ...; } & IStateTreeNode<...>) | undefined
```

#### action: clearFinished

```js
// type signature
clearFinished: () => void
```

#### action: clearAborted

```js
// type signature
clearAborted: () => void
```

#### action: updateJobStatusMessage

```js
// type signature
updateJobStatusMessage: (jobName: string, message?: string | undefined) => void
```

#### action: updateJobProgressPct

```js
// type signature
updateJobProgressPct: (jobName: string, pct: number) => void
```
