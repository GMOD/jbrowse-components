import { WritableKeys } from 'ts-essentials';
import { IKeyValueMap, IMapDidChange, Lambda, IInterceptor, IMapWillChange, IObservableArray } from 'mobx';

/**
 * Defines what MST should do when running into reads / writes to objects that have died.
 * - `"warn"`: Print a warning (default).
 * - `"error"`: Throw an exception.
 * - "`ignore`": Do nothing.
 */
type LivelinessMode = 'warn' | 'error' | 'ignore';
/**
 * Defines what MST should do when running into reads / writes to objects that have died.
 * By default it will print a warning.
 * Use the `"error"` option to easy debugging to see where the error was thrown and when the offending read / write took place
 *
 * @param mode `"warn"`, `"error"` or `"ignore"`
 */
declare function setLivelinessChecking(mode: LivelinessMode): void;
/**
 * Returns the current liveliness checking mode.
 *
 * @returns `"warn"`, `"error"` or `"ignore"`
 */
declare function getLivelinessChecking(): LivelinessMode;
/**
 * @deprecated use LivelinessMode instead
 * @hidden
 */
type LivelynessMode = LivelinessMode;
/**
 * @deprecated use setLivelinessChecking instead
 * @hidden
 *
 * Defines what MST should do when running into reads / writes to objects that have died.
 * By default it will print a warning.
 * Use the `"error"` option to easy debugging to see where the error was thrown and when the offending read / write took place
 *
 * @param mode `"warn"`, `"error"` or `"ignore"`
 */
declare function setLivelynessChecking(mode: LivelinessMode): void;

/**
 * @hidden
 */
declare enum Hook {
    afterCreate = "afterCreate",
    afterAttach = "afterAttach",
    afterCreationFinalization = "afterCreationFinalization",
    beforeDetach = "beforeDetach",
    beforeDestroy = "beforeDestroy"
}
interface IHooks {
    [Hook.afterCreate]?: () => void;
    [Hook.afterAttach]?: () => void;
    [Hook.beforeDetach]?: () => void;
    [Hook.beforeDestroy]?: () => void;
}
type IHooksGetter<T> = (self: T) => IHooks;

/** @hidden */
type TypeOrStateTreeNodeToStateTreeNode<T extends IAnyType | IAnyStateTreeNode> = T extends IType<any, any, infer TT> ? TT & IStateTreeNode<T> : T;
/**
 * Returns the _actual_ type of the given tree node. (Or throws)
 *
 * @param object
 * @returns
 */
declare function getType(object: IAnyStateTreeNode): IAnyComplexType;
/**
 * Returns the _declared_ type of the given sub property of an object, array or map.
 * In the case of arrays and maps the property name is optional and will be ignored.
 *
 * Example:
 * ```ts
 * const Box = types.model({ x: 0, y: 0 })
 * const box = Box.create()
 *
 * console.log(getChildType(box, "x").name) // 'number'
 * ```
 *
 * @param object
 * @param propertyName
 * @returns
 */
declare function getChildType(object: IAnyStateTreeNode, propertyName?: string): IAnyType;
/**
 * Registers a function that will be invoked for each mutation that is applied to the provided model instance, or to any of its children.
 * See [patches](https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree#patches) for more details. onPatch events are emitted immediately and will not await the end of a transaction.
 * Patches can be used to deeply observe a model tree.
 *
 * @param target the model instance from which to receive patches
 * @param callback the callback that is invoked for each patch. The reversePatch is a patch that would actually undo the emitted patch
 * @returns function to remove the listener
 */
declare function onPatch(target: IAnyStateTreeNode, callback: (patch: IJsonPatch, reversePatch: IJsonPatch) => void): IDisposer;
/**
 * Registers a function that is invoked whenever a new snapshot for the given model instance is available.
 * The listener will only be fire at the end of the current MobX (trans)action.
 * See [snapshots](https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree#snapshots) for more details.
 *
 * @param target
 * @param callback
 * @returns
 */
declare function onSnapshot<S>(target: IStateTreeNode<IType<any, S, any>>, callback: (snapshot: S) => void): IDisposer;
/**
 * Applies a JSON-patch to the given model instance or bails out if the patch couldn't be applied
 * See [patches](https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree#patches) for more details.
 *
 * Can apply a single past, or an array of patches.
 *
 * @param target
 * @param patch
 * @returns
 */
declare function applyPatch(target: IAnyStateTreeNode, patch: IJsonPatch | ReadonlyArray<IJsonPatch>): void;
interface IPatchRecorder {
    patches: ReadonlyArray<IJsonPatch>;
    inversePatches: ReadonlyArray<IJsonPatch>;
    reversedInversePatches: ReadonlyArray<IJsonPatch>;
    readonly recording: boolean;
    stop(): void;
    resume(): void;
    replay(target?: IAnyStateTreeNode): void;
    undo(target?: IAnyStateTreeNode): void;
}
/**
 * Small abstraction around `onPatch` and `applyPatch`, attaches a patch listener to a tree and records all the patches.
 * Returns a recorder object with the following signature:
 *
 * Example:
 * ```ts
 * export interface IPatchRecorder {
 *      // the recorded patches
 *      patches: IJsonPatch[]
 *      // the inverse of the recorded patches
 *      inversePatches: IJsonPatch[]
 *      // true if currently recording
 *      recording: boolean
 *      // stop recording patches
 *      stop(): void
 *      // resume recording patches
 *      resume(): void
 *      // apply all the recorded patches on the given target (the original subject if omitted)
 *      replay(target?: IAnyStateTreeNode): void
 *      // reverse apply the recorded patches on the given target  (the original subject if omitted)
 *      // stops the recorder if not already stopped
 *      undo(): void
 * }
 * ```
 *
 * The optional filter function allows to skip recording certain patches.
 *
 * @param subject
 * @param filter
 * @returns
 */
declare function recordPatches(subject: IAnyStateTreeNode, filter?: (patch: IJsonPatch, inversePatch: IJsonPatch, actionContext: IActionContext | undefined) => boolean): IPatchRecorder;
/**
 * The inverse of `unprotect`.
 *
 * @param target
 */
declare function protect(target: IAnyStateTreeNode): void;
/**
 * By default it is not allowed to directly modify a model. Models can only be modified through actions.
 * However, in some cases you don't care about the advantages (like replayability, traceability, etc) this yields.
 * For example because you are building a PoC or don't have any middleware attached to your tree.
 *
 * In that case you can disable this protection by calling `unprotect` on the root of your tree.
 *
 * Example:
 * ```ts
 * const Todo = types.model({
 *     done: false
 * }).actions(self => ({
 *     toggle() {
 *         self.done = !self.done
 *     }
 * }))
 *
 * const todo = Todo.create()
 * todo.done = true // throws!
 * todo.toggle() // OK
 * unprotect(todo)
 * todo.done = false // OK
 * ```
 */
declare function unprotect(target: IAnyStateTreeNode): void;
/**
 * Returns true if the object is in protected mode, @see protect
 */
declare function isProtected(target: IAnyStateTreeNode): boolean;
/**
 * Applies a snapshot to a given model instances. Patch and snapshot listeners will be invoked as usual.
 *
 * @param target
 * @param snapshot
 * @returns
 */
declare function applySnapshot<C>(target: IStateTreeNode<IType<C, any, any>>, snapshot: C): void;
/**
 * Calculates a snapshot from the given model instance. The snapshot will always reflect the latest state but use
 * structural sharing where possible. Doesn't require MobX transactions to be completed.
 *
 * @param target
 * @param applyPostProcess If true (the default) then postProcessSnapshot gets applied.
 * @returns
 */
declare function getSnapshot<S>(target: IStateTreeNode<IType<any, S, any>>, applyPostProcess?: boolean): S;
/**
 * Given a model instance, returns `true` if the object has a parent, that is, is part of another object, map or array.
 *
 * @param target
 * @param depth How far should we look upward? 1 by default.
 * @returns
 */
declare function hasParent(target: IAnyStateTreeNode, depth?: number): boolean;
/**
 * Returns the immediate parent of this object, or throws.
 *
 * Note that the immediate parent can be either an object, map or array, and
 * doesn't necessarily refer to the parent model.
 *
 * Please note that in child nodes access to the root is only possible
 * once the `afterAttach` hook has fired.
 *
 * @param target
 * @param depth How far should we look upward? 1 by default.
 * @returns
 */
declare function getParent<IT extends IAnyStateTreeNode | IAnyComplexType>(target: IAnyStateTreeNode, depth?: number): TypeOrStateTreeNodeToStateTreeNode<IT>;
/**
 * Given a model instance, returns `true` if the object has a parent of given type, that is, is part of another object, map or array
 *
 * @param target
 * @param type
 * @returns
 */
declare function hasParentOfType(target: IAnyStateTreeNode, type: IAnyComplexType): boolean;
/**
 * Returns the target's parent of a given type, or throws.
 *
 * @param target
 * @param type
 * @returns
 */
declare function getParentOfType<IT extends IAnyComplexType>(target: IAnyStateTreeNode, type: IT): IT['Type'];
/**
 * Given an object in a model tree, returns the root object of that tree.
 *
 * Please note that in child nodes access to the root is only possible
 * once the `afterAttach` hook has fired.
 *
 * @param target
 * @returns
 */
declare function getRoot<IT extends IAnyComplexType | IAnyStateTreeNode>(target: IAnyStateTreeNode): TypeOrStateTreeNodeToStateTreeNode<IT>;
/**
 * Returns the path of the given object in the model tree
 *
 * @param target
 * @returns
 */
declare function getPath(target: IAnyStateTreeNode): string;
/**
 * Returns the path of the given object as unescaped string array.
 *
 * @param target
 * @returns
 */
declare function getPathParts(target: IAnyStateTreeNode): string[];
/**
 * Returns true if the given object is the root of a model tree.
 *
 * @param target
 * @returns
 */
declare function isRoot(target: IAnyStateTreeNode): boolean;
/**
 * Resolves a path relatively to a given object.
 * Returns undefined if no value can be found.
 *
 * @param target
 * @param path escaped json path
 * @returns
 */
declare function resolvePath(target: IAnyStateTreeNode, path: string): any;
/**
 * Resolves a model instance given a root target, the type and the identifier you are searching for.
 * Returns undefined if no value can be found.
 *
 * @param type
 * @param target
 * @param identifier
 * @returns
 */
declare function resolveIdentifier<IT extends IAnyModelType>(type: IT, target: IAnyStateTreeNode, identifier: ReferenceIdentifier): IT['Type'] | undefined;
/**
 * Returns the identifier of the target node.
 * This is the *string normalized* identifier, which might not match the type of the identifier attribute
 *
 * @param target
 * @returns
 */
declare function getIdentifier(target: IAnyStateTreeNode): string | null;
/**
 * Tests if a reference is valid (pointing to an existing node and optionally if alive) and returns such reference if the check passes,
 * else it returns undefined.
 *
 * @param getter Function to access the reference.
 * @param checkIfAlive true to also make sure the referenced node is alive (default), false to skip this check.
 * @returns
 */
declare function tryReference<N extends IAnyStateTreeNode>(getter: () => N | null | undefined, checkIfAlive?: boolean): N | undefined;
/**
 * Tests if a reference is valid (pointing to an existing node and optionally if alive) and returns if the check passes or not.
 *
 * @param getter Function to access the reference.
 * @param checkIfAlive true to also make sure the referenced node is alive (default), false to skip this check.
 * @returns
 */
declare function isValidReference<N extends IAnyStateTreeNode>(getter: () => N | null | undefined, checkIfAlive?: boolean): boolean;
/**
 * Try to resolve a given path relative to a given node.
 *
 * @param target
 * @param path
 * @returns
 */
declare function tryResolve(target: IAnyStateTreeNode, path: string): any;
/**
 * Given two state tree nodes that are part of the same tree,
 * returns the shortest jsonpath needed to navigate from the one to the other
 *
 * @param base
 * @param target
 * @returns
 */
declare function getRelativePath(base: IAnyStateTreeNode, target: IAnyStateTreeNode): string;
/**
 * Returns a deep copy of the given state tree node as new tree.
 * Shorthand for `snapshot(x) = getType(x).create(getSnapshot(x))`
 *
 * _Tip: clone will create a literal copy, including the same identifiers. To modify identifiers etc. during cloning, don't use clone but take a snapshot of the tree, modify it, and create new instance_
 *
 * @param source
 * @param keepEnvironment indicates whether the clone should inherit the same environment (`true`, the default), or not have an environment (`false`). If an object is passed in as second argument, that will act as the environment for the cloned tree.
 * @returns
 */
declare function clone<T extends IAnyStateTreeNode>(source: T, keepEnvironment?: boolean | any): T;
/**
 * Removes a model element from the state tree, and let it live on as a new state tree
 */
declare function detach<T extends IAnyStateTreeNode>(target: T): T;
/**
 * Removes a model element from the state tree, and mark it as end-of-life; the element should not be used anymore
 */
declare function destroy(target: IAnyStateTreeNode): void;
/**
 * Returns true if the given state tree node is not killed yet.
 * This means that the node is still a part of a tree, and that `destroy`
 * has not been called. If a node is not alive anymore, the only thing one can do with it
 * is requesting it's last path and snapshot
 *
 * @param target
 * @returns
 */
declare function isAlive(target: IAnyStateTreeNode): boolean;
/**
 * Use this utility to register a function that should be called whenever the
 * targeted state tree node is destroyed. This is a useful alternative to managing
 * cleanup methods yourself using the `beforeDestroy` hook.
 *
 * This methods returns the same disposer that was passed as argument.
 *
 * Example:
 * ```ts
 * const Todo = types.model({
 *   title: types.string
 * }).actions(self => ({
 *   afterCreate() {
 *     const autoSaveDisposer = reaction(
 *       () => getSnapshot(self),
 *       snapshot => sendSnapshotToServerSomehow(snapshot)
 *     )
 *     // stop sending updates to server if this
 *     // instance is destroyed
 *     addDisposer(self, autoSaveDisposer)
 *   }
 * }))
 * ```
 *
 * @param target
 * @param disposer
 * @returns The same disposer that was passed as argument
 */
declare function addDisposer(target: IAnyStateTreeNode, disposer: IDisposer): IDisposer;
/**
 * Returns the environment of the current state tree, or throws. For more info on environments,
 * see [Dependency injection](https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree#dependency-injection)
 *
 * Please note that in child nodes access to the root is only possible
 * once the `afterAttach` hook has fired
 *
 * Returns an empty environment if the tree wasn't initialized with an environment
 *
 * @param target
 * @returns
 */
declare function getEnv<T = any>(target: IAnyStateTreeNode): T;
/**
 * Returns whether the current state tree has environment or not.
 *
 * @export
 * @param {IStateTreeNode} target
 * @return {boolean}
 */
declare function hasEnv(target: IAnyStateTreeNode): boolean;
/**
 * Performs a depth first walk through a tree.
 */
declare function walk(target: IAnyStateTreeNode, processor: (item: IAnyStateTreeNode) => void): void;
interface IModelReflectionPropertiesData {
    name: string;
    properties: {
        [K: string]: IAnyType;
    };
}
/**
 * Returns a reflection of the model type properties and name for either a model type or model node.
 *
 * @param typeOrNode
 * @returns
 */
declare function getPropertyMembers(typeOrNode: IAnyModelType | IAnyStateTreeNode): IModelReflectionPropertiesData;
interface IModelReflectionData extends IModelReflectionPropertiesData {
    actions: string[];
    views: string[];
    volatile: string[];
    flowActions: string[];
}
/**
 * Returns a reflection of the model node, including name, properties, views, volatile state,
 * and actions. `flowActions` is also provided as a separate array of names for any action that
 * came from a flow generator as well.
 *
 * In the case where a model has two actions: `doSomething` and `doSomethingWithFlow`, where
 * `doSomethingWithFlow` is a flow generator, the `actions` array will contain both actions,
 * i.e. ["doSomething", "doSomethingWithFlow"], and the `flowActions` array will contain only
 * the flow action, i.e. ["doSomethingWithFlow"].
 *
 * @param target
 * @returns
 */
declare function getMembers(target: IAnyStateTreeNode): IModelReflectionData;
declare function cast<O extends string | number | boolean | null | undefined = never>(snapshotOrInstance: O): O;
declare function cast<O = never>(snapshotOrInstance: TypeOfValue<O>['CreationType'] | TypeOfValue<O>['SnapshotType'] | TypeOfValue<O>['Type']): O;
/**
 * Casts a node instance type to a snapshot type so it can be assigned to a type snapshot (e.g. to be used inside a create call).
 * Note that this is just a cast for the type system, this is, it won't actually convert an instance to a snapshot,
 * but just fool typescript into thinking so.
 *
 * Example:
 * ```ts
 * const ModelA = types.model({
 *   n: types.number
 * }).actions(self => ({
 *   setN(aNumber: number) {
 *     self.n = aNumber
 *   }
 * }))
 *
 * const ModelB = types.model({
 *   innerModel: ModelA
 * })
 *
 * const a = ModelA.create({ n: 5 });
 * // this will allow the compiler to use a model as if it were a snapshot
 * const b = ModelB.create({ innerModel: castToSnapshot(a)})
 * ```
 *
 * @param snapshotOrInstance Snapshot or instance
 * @returns The same object cast as an input (creation) snapshot
 */
declare function castToSnapshot<I>(snapshotOrInstance: I): Extract<I, IAnyStateTreeNode> extends never ? I : TypeOfValue<I>['CreationType'];
/**
 * Casts a node instance type to a reference snapshot type so it can be assigned to a reference snapshot (e.g. to be used inside a create call).
 * Note that this is just a cast for the type system, this is, it won't actually convert an instance to a reference snapshot,
 * but just fool typescript into thinking so.
 *
 * Example:
 * ```ts
 * const ModelA = types.model({
 *   id: types.identifier,
 *   n: types.number
 * }).actions(self => ({
 *   setN(aNumber: number) {
 *     self.n = aNumber
 *   }
 * }))
 *
 * const ModelB = types.model({
 *   refA: types.reference(ModelA)
 * })
 *
 * const a = ModelA.create({ id: 'someId', n: 5 });
 * // this will allow the compiler to use a model as if it were a reference snapshot
 * const b = ModelB.create({ refA: castToReferenceSnapshot(a)})
 * ```
 *
 * @param instance Instance
 * @returns The same object cast as a reference snapshot (string or number)
 */
declare function castToReferenceSnapshot<I>(instance: I): Extract<I, IAnyStateTreeNode> extends never ? I : ReferenceIdentifier;
/**
 * Returns the unique node id (not to be confused with the instance identifier) for a
 * given instance.
 * This id is a number that is unique for each instance.
 *
 * @export
 * @param target
 * @returns
 */
declare function getNodeId(target: IAnyStateTreeNode): number;

/**
 * A state tree node value.
 * @hidden
 */
type STNValue<T, IT extends IAnyType> = T extends object ? T & IStateTreeNode<IT> : T;
/** @hidden */
declare const $type: unique symbol;
type ExcludeReadonly<T> = T extends {} ? T[WritableKeys<T>] : T;
/**
 * A type, either complex or simple.
 */
interface IType<C, S, T> {
    /** @hidden */
    readonly [$type]: undefined;
    /**
     * Friendly type name.
     */
    name: string;
    /**
     * Name of the identifier attribute or null if none.
     */
    readonly identifierAttribute?: string;
    /**
     * Creates an instance for the type given an snapshot input.
     *
     * @returns An instance of that type.
     */
    create(snapshot?: C | ExcludeReadonly<T>, env?: any): this['Type'];
    /**
     * Checks if a given snapshot / instance is of the given type.
     *
     * @param thing Snapshot or instance to be checked.
     * @returns true if the value is of the current type, false otherwise.
     */
    is(thing: any): thing is C | this['Type'];
    /**
     * Run's the type's typechecker on the given value with the given validation context.
     *
     * @param thing Value to be checked, either a snapshot or an instance.
     * @param context Validation context, an array of { subpaths, subtypes } that should be validated
     * @returns The validation result, an array with the list of validation errors.
     */
    validate(thing: C | T, context: IValidationContext): IValidationResult;
    /**
     * Gets the textual representation of the type as a string.
     */
    describe(): string;
    /**
     * @deprecated use `Instance<typeof MyType>` instead.
     * @hidden
     */
    readonly Type: STNValue<T, this>;
    /**
     * @deprecated do not use.
     * @hidden
     */
    readonly TypeWithoutSTN: T;
    /**
     * @deprecated use `SnapshotOut<typeof MyType>` instead.
     * @hidden
     */
    readonly SnapshotType: S;
    /**
     * @deprecated use `SnapshotIn<typeof MyType>` instead.
     * @hidden
     */
    readonly CreationType: C;
}
/**
 * Any kind of type.
 */
interface IAnyType extends IType<any, any, any> {
}
/**
 * A simple type, this is, a type where the instance and the snapshot representation are the same.
 */
interface ISimpleType<T> extends IType<T, T, T> {
}
/** @hidden */
type Primitives = ModelPrimitive | null | undefined;
/**
 * A complex type.
 * @deprecated just for compatibility with old versions, could be deprecated on the next major version
 * @hidden
 */
interface IComplexType<C, S, T> extends IType<C, S, T & object> {
}
/**
 * Any kind of complex type.
 */
interface IAnyComplexType extends IType<any, any, object> {
}
/** @hidden */
type ExtractCSTWithSTN<IT extends {
    [$type]: undefined;
    CreationType: any;
    SnapshotType: any;
    Type: any;
}> = IT['CreationType'] | IT['SnapshotType'] | IT['Type'];
/**
 * The instance representation of a given type.
 */
type Instance<T> = T extends {
    [$type]: undefined;
    Type: any;
} ? T['Type'] : T;
/**
 * The input (creation) snapshot representation of a given type.
 */
type SnapshotIn<T> = T extends {
    [$type]: undefined;
    CreationType: any;
} ? T['CreationType'] : T extends IStateTreeNode<infer IT> ? IT['CreationType'] : T;
/**
 * The output snapshot representation of a given type.
 */
type SnapshotOut<T> = T extends {
    [$type]: undefined;
    SnapshotType: any;
} ? T['SnapshotType'] : T extends IStateTreeNode<infer IT> ? IT['SnapshotType'] : T;
/**
 * A type which is equivalent to the union of SnapshotIn and Instance types of a given typeof TYPE or typeof VARIABLE.
 * For primitives it defaults to the primitive itself.
 *
 * For example:
 * - `SnapshotOrInstance<typeof ModelA> = SnapshotIn<typeof ModelA> | Instance<typeof ModelA>`
 * - `SnapshotOrInstance<typeof self.a (where self.a is a ModelA)> = SnapshotIn<typeof ModelA> | Instance<typeof ModelA>`
 *
 * Usually you might want to use this when your model has a setter action that sets a property.
 *
 * Example:
 * ```ts
 * const ModelA = types.model({
 *   n: types.number
 * })
 *
 * const ModelB = types.model({
 *   innerModel: ModelA
 * }).actions(self => ({
 *   // this will accept as property both the snapshot and the instance, whichever is preferred
 *   setInnerModel(m: SnapshotOrInstance<typeof self.innerModel>) {
 *     self.innerModel = cast(m)
 *   }
 * }))
 * ```
 */
type SnapshotOrInstance<T> = SnapshotIn<T> | Instance<T>;
/**
 * Returns if a given value represents a type.
 *
 * @param value Value to check.
 * @returns `true` if the value is a type.
 */
declare function isType(value: any): value is IAnyType;

interface IActionTrackingMiddlewareHooks<T> {
    filter?: (call: IMiddlewareEvent) => boolean;
    onStart: (call: IMiddlewareEvent) => T;
    onResume: (call: IMiddlewareEvent, context: T) => void;
    onSuspend: (call: IMiddlewareEvent, context: T) => void;
    onSuccess: (call: IMiddlewareEvent, context: T, result: any) => void;
    onFail: (call: IMiddlewareEvent, context: T, error: any) => void;
}
/**
 * Note: Consider migrating to `createActionTrackingMiddleware2`, it is easier to use.
 *
 * Convenience utility to create action based middleware that supports async processes more easily.
 * All hooks are called for both synchronous and asynchronous actions. Except that either `onSuccess` or `onFail` is called
 *
 * The create middleware tracks the process of an action (assuming it passes the `filter`).
 * `onResume` can return any value, which will be passed as second argument to any other hook. This makes it possible to keep state during a process.
 *
 * See the `atomic` middleware for an example
 *
 * @param hooks
 * @returns
 */
declare function createActionTrackingMiddleware<T = any>(hooks: IActionTrackingMiddlewareHooks<T>): IMiddlewareHandler;

interface IActionTrackingMiddleware2Call<TEnv> extends Readonly<IActionContext> {
    env: TEnv | undefined;
    readonly parentCall?: IActionTrackingMiddleware2Call<TEnv>;
}
interface IActionTrackingMiddleware2Hooks<TEnv> {
    filter?: (call: IActionTrackingMiddleware2Call<TEnv>) => boolean;
    onStart: (call: IActionTrackingMiddleware2Call<TEnv>) => void;
    onFinish: (call: IActionTrackingMiddleware2Call<TEnv>, error?: any) => void;
}
/**
 * Convenience utility to create action based middleware that supports async processes more easily.
 * The flow is like this:
 * - for each action: if filter passes -> `onStart` -> (inner actions recursively) -> `onFinish`
 *
 * Example: if we had an action `a` that called inside an action `b1`, then `b2` the flow would be:
 * - `filter(a)`
 * - `onStart(a)`
 *   - `filter(b1)`
 *   - `onStart(b1)`
 *   - `onFinish(b1)`
 *   - `filter(b2)`
 *   - `onStart(b2)`
 *   - `onFinish(b2)`
 * - `onFinish(a)`
 *
 * The flow is the same no matter if the actions are sync or async.
 *
 * See the `atomic` middleware for an example
 *
 * @param hooks
 * @returns
 */
declare function createActionTrackingMiddleware2<TEnv = any>(middlewareHooks: IActionTrackingMiddleware2Hooks<TEnv>): IMiddlewareHandler;

interface ISerializedActionCall {
    name: string;
    path?: string;
    args?: any[];
}
interface IActionRecorder {
    actions: ReadonlyArray<ISerializedActionCall>;
    readonly recording: boolean;
    stop(): void;
    resume(): void;
    replay(target: IAnyStateTreeNode): void;
}
/**
 * Applies an action or a series of actions in a single MobX transaction.
 * Does not return any value
 * Takes an action description as produced by the `onAction` middleware.
 *
 * @param target
 * @param actions
 */
declare function applyAction(target: IAnyStateTreeNode, actions: ISerializedActionCall | ISerializedActionCall[]): void;
/**
 * Small abstraction around `onAction` and `applyAction`, attaches an action listener to a tree and records all the actions emitted.
 * Returns an recorder object with the following signature:
 *
 * Example:
 * ```ts
 * export interface IActionRecorder {
 *      // the recorded actions
 *      actions: ISerializedActionCall[]
 *      // true if currently recording
 *      recording: boolean
 *      // stop recording actions
 *      stop(): void
 *      // resume recording actions
 *      resume(): void
 *      // apply all the recorded actions on the given object
 *      replay(target: IAnyStateTreeNode): void
 * }
 * ```
 *
 * The optional filter function allows to skip recording certain actions.
 *
 * @param subject
 * @returns
 */
declare function recordActions(subject: IAnyStateTreeNode, filter?: (action: ISerializedActionCall, actionContext: IActionContext | undefined) => boolean): IActionRecorder;
/**
 * Registers a function that will be invoked for each action that is called on the provided model instance, or to any of its children.
 * See [actions](https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree#actions) for more details. onAction events are emitted only for the outermost called action in the stack.
 * Action can also be intercepted by middleware using addMiddleware to change the function call before it will be run.
 *
 * Not all action arguments might be serializable. For unserializable arguments, a struct like `{ $MST_UNSERIALIZABLE: true, type: "someType" }` will be generated.
 * MST Nodes are considered non-serializable as well (they could be serialized as there snapshot, but it is uncertain whether an replaying party will be able to handle such a non-instantiated snapshot).
 * Rather, when using `onAction` middleware, one should consider in passing arguments which are 1: an id, 2: a (relative) path, or 3: a snapshot. Instead of a real MST node.
 *
 * Example:
 * ```ts
 * const Todo = types.model({
 *   task: types.string
 * })
 *
 * const TodoStore = types.model({
 *   todos: types.array(Todo)
 * }).actions(self => ({
 *   add(todo) {
 *     self.todos.push(todo);
 *   }
 * }))
 *
 * const s = TodoStore.create({ todos: [] })
 *
 * let disposer = onAction(s, (call) => {
 *   console.log(call);
 * })
 *
 * s.add({ task: "Grab a coffee" })
 * // Logs: { name: "add", path: "", args: [{ task: "Grab a coffee" }] }
 * ```
 *
 * @param target
 * @param listener
 * @param attachAfter (default false) fires the listener *after* the action has executed instead of before.
 * @returns
 */
declare function onAction(target: IAnyStateTreeNode, listener: (call: ISerializedActionCall) => void, attachAfter?: boolean): IDisposer;

type IMiddlewareEventType = 'action' | 'flow_spawn' | 'flow_resume' | 'flow_resume_error' | 'flow_return' | 'flow_throw';
interface IMiddlewareEvent extends IActionContext {
    /** Event type */
    readonly type: IMiddlewareEventType;
    /** Parent event unique id */
    readonly parentId: number;
    /** Parent event object */
    readonly parentEvent: IMiddlewareEvent | undefined;
    /** Root event unique id */
    readonly rootId: number;
    /** Id of all events, from root until current (excluding current) */
    readonly allParentIds: number[];
}
interface FunctionWithFlag extends Function {
    _isMSTAction?: boolean;
    _isFlowAction?: boolean;
}
type IMiddlewareHandler = (actionCall: IMiddlewareEvent, next: (actionCall: IMiddlewareEvent, callback?: (value: any) => any) => void, abort: (value: any) => void) => any;
/**
 * Middleware can be used to intercept any action is invoked on the subtree where it is attached.
 * If a tree is protected (by default), this means that any mutation of the tree will pass through your middleware.
 *
 * For more details, see the [middleware docs](concepts/middleware.md)
 *
 * @param target Node to apply the middleware to.
 * @param middleware Middleware to apply.
 * @returns A callable function to dispose the middleware.
 */
declare function addMiddleware(target: IAnyStateTreeNode, handler: IMiddlewareHandler, includeHooks?: boolean): IDisposer;
/**
 * Binds middleware to a specific action.
 *
 * Example:
 * ```ts
 * type.actions(self => {
 *   function takeA____() {
 *       self.toilet.donate()
 *       self.wipe()
 *       self.wipe()
 *       self.toilet.flush()
 *   }
 *   return {
 *     takeA____: decorate(atomic, takeA____)
 *   }
 * })
 * ```
 *
 * @param handler
 * @param fn
 * @param includeHooks
 * @returns The original function
 */
declare function decorate<T extends Function>(handler: IMiddlewareHandler, fn: T, includeHooks?: boolean): T;

interface IActionContext {
    /** Event name (action name for actions) */
    readonly name: string;
    /** Event unique id */
    readonly id: number;
    /** Parent action event object */
    readonly parentActionEvent: IMiddlewareEvent | undefined;
    /** Event context (node where the action was invoked) */
    readonly context: IAnyStateTreeNode;
    /** Event tree (root node of the node where the action was invoked) */
    readonly tree: IAnyStateTreeNode;
    /** Event arguments in an array (action arguments for actions) */
    readonly args: any[];
}
/**
 * Returns the currently executing MST action context, or undefined if none.
 */
declare function getRunningActionContext(): IActionContext | undefined;
/**
 * Returns if the given action context is a parent of this action context.
 */
declare function isActionContextChildOf(actionContext: IActionContext, parent: number | IActionContext | IMiddlewareEvent): boolean;
/**
 * Returns if the given action context is this or a parent of this action context.
 */
declare function isActionContextThisOrChildOf(actionContext: IActionContext, parentOrThis: number | IActionContext | IMiddlewareEvent): boolean;

/** Validation context entry, this is, where the validation should run against which type */
interface IValidationContextEntry {
    /** Subpath where the validation should be run, or an empty string to validate it all */
    path: string;
    /** Type to validate the subpath against */
    type: IAnyType;
}
/** Array of validation context entries */
type IValidationContext = IValidationContextEntry[];
/** Type validation error */
interface IValidationError {
    /** Validation context */
    context: IValidationContext;
    /** Value that was being validated, either a snapshot or an instance */
    value: any;
    /** Error message */
    message?: string;
}
/** Type validation result, which is an array of type validation errors */
type IValidationResult = IValidationError[];
/**
 * Run's the typechecker for the given type on the given value, which can be a snapshot or an instance.
 * Throws if the given value is not according the provided type specification.
 * Use this if you need typechecks even in a production build (by default all automatic runtime type checks will be skipped in production builds)
 *
 * @param type Type to check against.
 * @param value Value to be checked, either a snapshot or an instance.
 */
declare function typecheck<IT extends IAnyType>(type: IT, value: ExtractCSTWithSTN<IT>): void;

/** @hidden */
declare const $stateTreeNodeType: unique symbol;
/**
 * Common interface that represents a node instance.
 * @hidden
 */
interface IStateTreeNode<IT extends IAnyType = IAnyType> {
    readonly [$stateTreeNodeType]?: [IT] | [any];
}
/** @hidden */
type TypeOfValue<T extends IAnyStateTreeNode> = T extends IStateTreeNode<infer IT> ? IT : never;
/**
 * Represents any state tree node instance.
 * @hidden
 */
interface IAnyStateTreeNode extends STNValue<any, IAnyType> {
}
/**
 * Returns true if the given value is a node in a state tree.
 * More precisely, that is, if the value is an instance of a
 * `types.model`, `types.array` or `types.map`.
 *
 * @param value
 * @returns true if the value is a state tree node.
 */
declare function isStateTreeNode<IT extends IAnyComplexType = IAnyComplexType>(value: any): value is STNValue<Instance<IT>, IT>;

/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<R>(generator: () => IterableIterator<any>): () => Promise<R>;
/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<A1>(generator: (a1: A1) => IterableIterator<any>): (a1: A1) => Promise<any>;
/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<A1, A2>(generator: (a1: A1, a2: A2) => IterableIterator<any>): (a1: A1, a2: A2) => Promise<any>;
/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<A1, A2, A3>(generator: (a1: A1, a2: A2, a3: A3) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3) => Promise<any>;
/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<A1, A2, A3, A4>(generator: (a1: A1, a2: A2, a3: A3, a4: A4) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4) => Promise<any>;
/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<A1, A2, A3, A4, A5>(generator: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => Promise<any>;
/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<A1, A2, A3, A4, A5, A6>(generator: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => Promise<any>;
/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<A1, A2, A3, A4, A5, A6, A7>(generator: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => Promise<any>;
/**
 * @deprecated has been renamed to `flow()`.
 * @hidden
 */
declare function process<A1, A2, A3, A4, A5, A6, A7, A8>(generator: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => Promise<any>;

/**
 * @hidden
 */
type FlowReturn<R> = R extends Promise<infer T> ? T : R;
/**
 * See [asynchronous actions](concepts/async-actions.md).
 *
 * @returns The flow as a promise.
 */
declare function flow<R, Args extends any[]>(generator: (...args: Args) => Generator<PromiseLike<any>, R, any>): (...args: Args) => Promise<FlowReturn<R>>;
/**
 * @deprecated Not needed since TS3.6.
 * Used for TypeScript to make flows that return a promise return the actual promise result.
 *
 * @param val
 * @returns
 */
declare function castFlowReturn<T>(val: T): T;
/**
 * @experimental
 * experimental api - might change on minor/patch releases
 *
 * Convert a promise-returning function to a generator-returning one.
 * This is intended to allow for usage of `yield*` in async actions to
 * retain the promise return type.
 *
 * Example:
 * ```ts
 * function getDataAsync(input: string): Promise<number> { ... }
 * const getDataGen = toGeneratorFunction(getDataAsync);
 *
 * const someModel.actions(self => ({
 *   someAction: flow(function*() {
 *     // value is typed as number
 *     const value = yield* getDataGen("input value");
 *     ...
 *   })
 * }))
 * ```
 */
declare function toGeneratorFunction<R, Args extends any[]>(p: (...args: Args) => Promise<R>): (...args: Args) => Generator<Promise<R>, R, R>;
/**
 * @experimental
 * experimental api - might change on minor/patch releases
 *
 * Convert a promise to a generator yielding that promise
 * This is intended to allow for usage of `yield*` in async actions to
 * retain the promise return type.
 *
 * Example:
 * ```ts
 * function getDataAsync(input: string): Promise<number> { ... }
 *
 * const someModel.actions(self => ({
 *   someAction: flow(function*() {
 *     // value is typed as number
 *     const value = yield* toGenerator(getDataAsync("input value"));
 *     ...
 *   })
 * }))
 * ```
 */
declare function toGenerator<R>(p: Promise<R>): Generator<Promise<R>, R, R>;

/**
 * https://tools.ietf.org/html/rfc6902
 * http://jsonpatch.com/
 */
interface IJsonPatch {
    readonly op: 'replace' | 'add' | 'remove';
    readonly path: string;
    readonly value?: any;
}
interface IReversibleJsonPatch extends IJsonPatch {
    readonly oldValue: any;
}
/**
 * Escape slashes and backslashes.
 *
 * http://tools.ietf.org/html/rfc6901
 */
declare function escapeJsonPath(path: string): string;
/**
 * Unescape slashes and backslashes.
 */
declare function unescapeJsonPath(path: string): string;
/**
 * Generates a json-path compliant json path from path parts.
 *
 * @param path
 * @returns
 */
declare function joinJsonPath(path: string[]): string;
/**
 * Splits and decodes a json path into several parts.
 *
 * @param path
 * @returns
 */
declare function splitJsonPath(path: string): string[];

/**
 * A generic disposer.
 */
type IDisposer = () => void;

/** @hidden */
declare const $mstNotCustomized: unique symbol;
/** @hidden */
interface _NotCustomized {
    readonly [$mstNotCustomized]: undefined;
}
/** @hidden */
type _CustomOrOther<Custom, Other> = Custom extends _NotCustomized ? Other : Custom;
/**
 * A type that has its snapshots processed.
 */
interface ISnapshotProcessor<IT extends IAnyType, CustomC, CustomS> extends IType<_CustomOrOther<CustomC, IT['CreationType']>, _CustomOrOther<CustomS, IT['SnapshotType']>, IT['TypeWithoutSTN']> {
}
/**
 * Snapshot processors.
 */
interface ISnapshotProcessors<IT extends IAnyType, CustomC, CustomS> {
    /**
     * Function that transforms an input snapshot.
     */
    preProcessor?(snapshot: _CustomOrOther<CustomC, IT['CreationType']>): IT['CreationType'];
    /**
     * Function that transforms an output snapshot.
     * @param snapshot
     */
    postProcessor?(snapshot: IT['SnapshotType'], node: Instance<IT>): _CustomOrOther<CustomS, IT['SnapshotType']>;
}
/**
 * `types.snapshotProcessor` - Runs a pre/post snapshot processor before/after serializing a given type.
 *
 * [See known issue with `applySnapshot` and `preProcessSnapshot`](https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree/issues/1317)
 *
 * Example:
 * ```ts
 * const Todo1 = types.model({ text: types.string })
 * // in the backend the text type must be null when empty
 * interface BackendTodo {
 *     text: string | null
 * }
 *
 * const Todo2 = types.snapshotProcessor(Todo1, {
 *     // from snapshot to instance
 *     preProcessor(snapshot: BackendTodo) {
 *         return {
 *             text: sn.text || "";
 *         }
 *     },
 *
 *     // from instance to snapshot
 *     postProcessor(snapshot, node): BackendTodo {
 *         return {
 *             text: !sn.text ? null : sn.text
 *         }
 *     }
 * })
 * ```
 *
 * @param type Type to run the processors over.
 * @param processors Processors to run.
 * @param name Type name, or undefined to inherit the inner type one.
 * @returns
 */
declare function snapshotProcessor<IT extends IAnyType, CustomC = _NotCustomized, CustomS = _NotCustomized>(type: IT, processors: ISnapshotProcessors<IT, CustomC, CustomS>, name?: string): ISnapshotProcessor<IT, CustomC, CustomS>;

/** @hidden */
interface IMapType<IT extends IAnyType> extends IType<IKeyValueMap<IT['CreationType']> | undefined, IKeyValueMap<IT['SnapshotType']>, IMSTMap<IT>> {
    hooks(hooks: IHooksGetter<IMSTMap<IT>>): IMapType<IT>;
}
/** @hidden */
interface IMSTMap<IT extends IAnyType> {
    clear(): void;
    delete(key: string): boolean;
    forEach(callbackfn: (value: IT['Type'], key: string | number, map: this) => void, thisArg?: any): void;
    get(key: string | number): IT['Type'] | undefined;
    has(key: string | number): boolean;
    set(key: string | number, value: ExtractCSTWithSTN<IT>): this;
    readonly size: number;
    put(value: ExtractCSTWithSTN<IT>): IT['Type'];
    keys(): IterableIterator<string>;
    values(): IterableIterator<IT['Type']>;
    entries(): IterableIterator<[string, IT['Type']]>;
    [Symbol.iterator](): IterableIterator<[string, IT['Type']]>;
    /** Merge another object into this map, returns self. */
    merge(other: IMSTMap<IType<any, any, IT['TypeWithoutSTN']>> | IKeyValueMap<ExtractCSTWithSTN<IT>> | any): this;
    replace(values: IMSTMap<IType<any, any, IT['TypeWithoutSTN']>> | IKeyValueMap<ExtractCSTWithSTN<IT>> | any): this;
    toJSON(): IKeyValueMap<IT['SnapshotType']>;
    toString(): string;
    [Symbol.toStringTag]: 'Map';
    /**
     * Observes this object. Triggers for the events 'add', 'update' and 'delete'.
     * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
     * for callback details
     */
    observe(listener: (changes: IMapDidChange<string, IT['Type']>) => void, fireImmediately?: boolean): Lambda;
    intercept(handler: IInterceptor<IMapWillChange<string, IT['Type']>>): Lambda;
}
/**
 * `types.map` - Creates a key based collection type who's children are all of a uniform declared type.
 * If the type stored in a map has an identifier, it is mandatory to store the child under that identifier in the map.
 *
 * This type will always produce [observable maps](https://mobx.js.org/api.html#observablemap)
 *
 * Example:
 * ```ts
 * const Todo = types.model({
 *   id: types.identifier,
 *   task: types.string
 * })
 *
 * const TodoStore = types.model({
 *   todos: types.map(Todo)
 * })
 *
 * const s = TodoStore.create({ todos: {} })
 * unprotect(s)
 * s.todos.set(17, { task: "Grab coffee", id: 17 })
 * s.todos.put({ task: "Grab cookie", id: 18 }) // put will infer key from the identifier
 * console.log(s.todos.get(17).task) // prints: "Grab coffee"
 * ```
 *
 * @param subtype
 * @returns
 */
declare function map<IT extends IAnyType>(subtype: IT): IMapType<IT>;
/**
 * Returns if a given value represents a map type.
 *
 * @param type
 * @returns `true` if it is a map type.
 */
declare function isMapType(type: unknown): type is IMapType<IAnyType>;

/** @hidden */
interface IMSTArray<IT extends IAnyType> extends IObservableArray<IT['Type']> {
    push(...items: IT['Type'][]): number;
    push(...items: ExtractCSTWithSTN<IT>[]): number;
    concat(...items: ConcatArray<IT['Type']>[]): IT['Type'][];
    concat(...items: ConcatArray<ExtractCSTWithSTN<IT>>[]): IT['Type'][];
    concat(...items: (IT['Type'] | ConcatArray<IT['Type']>)[]): IT['Type'][];
    concat(...items: (ExtractCSTWithSTN<IT> | ConcatArray<ExtractCSTWithSTN<IT>>)[]): IT['Type'][];
    splice(start: number, deleteCount?: number): IT['Type'][];
    splice(start: number, deleteCount: number, ...items: IT['Type'][]): IT['Type'][];
    splice(start: number, deleteCount: number, ...items: ExtractCSTWithSTN<IT>[]): IT['Type'][];
    unshift(...items: IT['Type'][]): number;
    unshift(...items: ExtractCSTWithSTN<IT>[]): number;
}
/** @hidden */
interface IArrayType<IT extends IAnyType> extends IType<readonly IT['CreationType'][] | undefined, IT['SnapshotType'][], IMSTArray<IT>> {
    hooks(hooks: IHooksGetter<IMSTArray<IAnyType>>): IArrayType<IT>;
}
/**
 * `types.array` - Creates an index based collection type who's children are all of a uniform declared type.
 *
 * This type will always produce [observable arrays](https://mobx.js.org/api.html#observablearray)
 *
 * Example:
 * ```ts
 * const Todo = types.model({
 *   task: types.string
 * })
 *
 * const TodoStore = types.model({
 *   todos: types.array(Todo)
 * })
 *
 * const s = TodoStore.create({ todos: [] })
 * unprotect(s) // needed to allow modifying outside of an action
 * s.todos.push({ task: "Grab coffee" })
 * console.log(s.todos[0]) // prints: "Grab coffee"
 * ```
 *
 * @param subtype
 * @returns
 */
declare function array<IT extends IAnyType>(subtype: IT): IArrayType<IT>;
/**
 * Returns if a given value represents an array type.
 *
 * @param type
 * @returns `true` if the type is an array type.
 */
declare function isArrayType(type: unknown): type is IArrayType<IAnyType>;

/** @hidden */
interface ModelProperties {
    [key: string]: IAnyType;
}
/** @hidden */
type ModelPrimitive = string | number | boolean | Date;
/** @hidden */
interface ModelPropertiesDeclaration {
    [key: string]: ModelPrimitive | IAnyType;
}
/**
 * Unmaps syntax property declarations to a map of { propName: IType }
 *
 * @hidden
 */
type ModelPropertiesDeclarationToProperties<T extends ModelPropertiesDeclaration> = T extends {
    [k: string]: IAnyType;
} ? T : {
    [K in keyof T]: T[K] extends IAnyType ? T[K] : T[K] extends string ? IType<string | undefined, string, string> : T[K] extends number ? IType<number | undefined, number, number> : T[K] extends boolean ? IType<boolean | undefined, boolean, boolean> : T[K] extends Date ? IType<number | Date | undefined, number, Date> : never;
};
/**
 * Checks if a value is optional (undefined, any or unknown).
 * @hidden
 *
 * Examples:
 * - string = false
 * - undefined = true
 * - string | undefined = true
 * - string & undefined = false, but we don't care
 * - any = true
 * - unknown = true
 */
type IsOptionalValue<C, TV, FV> = undefined extends C ? TV : FV;
/**
 * Name of the properties of an object that can't be set to undefined, any or unknown
 * @hidden
 */
type DefinablePropsNames<T> = {
    [K in keyof T]: IsOptionalValue<T[K], never, K>;
}[keyof T];
/** @hidden */
type ExtractCFromProps<P extends ModelProperties> = MaybeEmpty<{
    [k in keyof P]: P[k]['CreationType'] | P[k]['TypeWithoutSTN'];
}>;
/** @hidden */
type MaybeEmpty<T> = keyof T extends never ? EmptyObject : T;
/** @hidden */
type ModelCreationType<PC> = MaybeEmpty<{
    [P in DefinablePropsNames<PC>]: PC[P];
}> & Partial<PC>;
type WithAdditionalProperties<T> = T extends Record<string, never> ? EmptyObject : T;
declare const $nonEmptyObject: unique symbol;
type EmptyObject = {
    [$nonEmptyObject]?: never;
};
/** @hidden */
type ModelCreationType2<P extends ModelProperties, CustomC> = MaybeEmpty<keyof P extends never ? _CustomOrOther<CustomC, ModelCreationType<EmptyObject>> : _CustomOrOther<CustomC, ModelCreationType<ExtractCFromProps<P>>>>;
/** @hidden */
type ModelSnapshotType<P extends ModelProperties> = {
    [K in keyof P]: P[K]['SnapshotType'];
};
/** @hidden */
type ModelSnapshotType2<P extends ModelProperties, CustomS> = _CustomOrOther<CustomS, ModelSnapshotType<P>>;
/**
 * @hidden
 * we keep this separate from ModelInstanceType to shorten model instance types generated declarations
 */
type ModelInstanceTypeProps<P extends ModelProperties> = {
    [K in keyof P]: P[K]['Type'];
};
/**
 * @hidden
 * do not transform this to an interface or model instance type generated declarations will be longer
 */
type ModelInstanceType<P extends ModelProperties, O> = ModelInstanceTypeProps<P> & O;
/** @hidden */
interface ModelActions {
    [key: string]: FunctionWithFlag;
}
interface IModelType<PROPS extends ModelProperties, OTHERS, CustomC = _NotCustomized, CustomS = _NotCustomized> extends IType<ModelCreationType2<PROPS, CustomC>, ModelSnapshotType2<PROPS, CustomS>, ModelInstanceType<PROPS, OTHERS>> {
    readonly properties: PROPS;
    named(newName: string): IModelType<PROPS, OTHERS, CustomC, CustomS>;
    props<PROPS2 extends ModelPropertiesDeclaration>(props: PROPS2): IModelType<PROPS & ModelPropertiesDeclarationToProperties<PROPS2>, OTHERS, CustomC, CustomS>;
    views<V extends Object>(fn: (self: Instance<this>) => V): IModelType<PROPS, OTHERS & V, CustomC, CustomS>;
    actions<A extends ModelActions>(fn: (self: Instance<this>) => A): IModelType<PROPS, OTHERS & A, CustomC, CustomS>;
    volatile<TP extends object>(fn: (self: Instance<this>) => TP): IModelType<PROPS, OTHERS & TP, CustomC, CustomS>;
    extend<A extends ModelActions = {}, V extends Object = {}, VS extends Object = {}>(fn: (self: Instance<this>) => {
        actions?: A;
        views?: V;
        state?: VS;
    }): IModelType<PROPS, OTHERS & A & V & VS, CustomC, CustomS>;
    preProcessSnapshot<NewC = ModelCreationType2<PROPS, CustomC>>(fn: (snapshot: NewC) => WithAdditionalProperties<ModelCreationType2<PROPS, CustomC>>): IModelType<PROPS, OTHERS, NewC, CustomS>;
    postProcessSnapshot<NewS = ModelSnapshotType2<PROPS, CustomS>>(fn: (snapshot: ModelSnapshotType2<PROPS, CustomS>) => NewS): IModelType<PROPS, OTHERS, CustomC, NewS>;
}
/**
 * Any model type.
 */
interface IAnyModelType extends IModelType<any, any, any, any> {
}
declare function model<P extends ModelPropertiesDeclaration = {}>(name: string, properties?: P): IModelType<ModelPropertiesDeclarationToProperties<P>, {}>;
declare function model<P extends ModelPropertiesDeclaration = {}>(properties?: P): IModelType<ModelPropertiesDeclarationToProperties<P>, {}>;
/** @hidden */
type _CustomJoin<A, B> = A extends _NotCustomized ? B : A & B;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB>(name: string, A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>): IModelType<PA & PB, OA & OB, _CustomJoin<FCA, FCB>, _CustomJoin<FSA, FSB>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB>(A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>): IModelType<PA & PB, OA & OB, _CustomJoin<FCA, FCB>, _CustomJoin<FSA, FSB>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC>(name: string, A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>): IModelType<PA & PB & PC, OA & OB & OC, _CustomJoin<FCA, _CustomJoin<FCB, FCC>>, _CustomJoin<FSA, _CustomJoin<FSB, FSC>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC>(A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>): IModelType<PA & PB & PC, OA & OB & OC, _CustomJoin<FCA, _CustomJoin<FCB, FCC>>, _CustomJoin<FSA, _CustomJoin<FSB, FSC>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD>(name: string, A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>): IModelType<PA & PB & PC & PD, OA & OB & OC & OD, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, FCD>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, FSD>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD>(A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>): IModelType<PA & PB & PC & PD, OA & OB & OC & OD, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, FCD>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, FSD>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE>(name: string, A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>): IModelType<PA & PB & PC & PD & PE, OA & OB & OC & OD & OE, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, FCE>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, FSE>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE>(A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>): IModelType<PA & PB & PC & PD & PE, OA & OB & OC & OD & OE, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, FCE>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, FSE>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE, PF extends ModelProperties, OF, FCF, FSF>(name: string, A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>, F: IModelType<PF, OF, FCF, FSF>): IModelType<PA & PB & PC & PD & PE & PF, OA & OB & OC & OD & OE & OF, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, _CustomJoin<FCE, FCF>>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, _CustomJoin<FSE, FSF>>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE, PF extends ModelProperties, OF, FCF, FSF>(A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>, F: IModelType<PF, OF, FCF, FSF>): IModelType<PA & PB & PC & PD & PE & PF, OA & OB & OC & OD & OE & OF, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, _CustomJoin<FCE, FCF>>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, _CustomJoin<FSE, FSF>>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE, PF extends ModelProperties, OF, FCF, FSF, PG extends ModelProperties, OG, FCG, FSG>(name: string, A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>, F: IModelType<PF, OF, FCF, FSF>, G: IModelType<PG, OG, FCG, FSG>): IModelType<PA & PB & PC & PD & PE & PF & PG, OA & OB & OC & OD & OE & OF & OG, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, _CustomJoin<FCE, _CustomJoin<FCF, FCG>>>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, _CustomJoin<FSE, _CustomJoin<FSF, FSG>>>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE, PF extends ModelProperties, OF, FCF, FSF, PG extends ModelProperties, OG, FCG, FSG>(A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>, F: IModelType<PF, OF, FCF, FSF>, G: IModelType<PG, OG, FCG, FSG>): IModelType<PA & PB & PC & PD & PE & PF & PG, OA & OB & OC & OD & OE & OF & OG, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, _CustomJoin<FCE, _CustomJoin<FCF, FCG>>>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, _CustomJoin<FSE, _CustomJoin<FSF, FSG>>>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE, PF extends ModelProperties, OF, FCF, FSF, PG extends ModelProperties, OG, FCG, FSG, PH extends ModelProperties, OH, FCH, FSH>(name: string, A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>, F: IModelType<PF, OF, FCF, FSF>, G: IModelType<PG, OG, FCG, FSG>, H: IModelType<PH, OH, FCH, FSH>): IModelType<PA & PB & PC & PD & PE & PF & PG & PH, OA & OB & OC & OD & OE & OF & OG & OH, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, _CustomJoin<FCE, _CustomJoin<FCF, _CustomJoin<FCG, FCH>>>>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, _CustomJoin<FSE, _CustomJoin<FSF, _CustomJoin<FSG, FSH>>>>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE, PF extends ModelProperties, OF, FCF, FSF, PG extends ModelProperties, OG, FCG, FSG, PH extends ModelProperties, OH, FCH, FSH>(A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>, F: IModelType<PF, OF, FCF, FSF>, G: IModelType<PG, OG, FCG, FSG>, H: IModelType<PH, OH, FCH, FSH>): IModelType<PA & PB & PC & PD & PE & PF & PG & PH, OA & OB & OC & OD & OE & OF & OG & OH, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, _CustomJoin<FCE, _CustomJoin<FCF, _CustomJoin<FCG, FCH>>>>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, _CustomJoin<FSE, _CustomJoin<FSF, _CustomJoin<FSG, FSH>>>>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE, PF extends ModelProperties, OF, FCF, FSF, PG extends ModelProperties, OG, FCG, FSG, PH extends ModelProperties, OH, FCH, FSH, PI extends ModelProperties, OI, FCI, FSI>(name: string, A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>, F: IModelType<PF, OF, FCF, FSF>, G: IModelType<PG, OG, FCG, FSG>, H: IModelType<PH, OH, FCH, FSH>, I: IModelType<PI, OI, FCI, FSI>): IModelType<PA & PB & PC & PD & PE & PF & PG & PH & PI, OA & OB & OC & OD & OE & OF & OG & OH & OI, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, _CustomJoin<FCE, _CustomJoin<FCF, _CustomJoin<FCG, _CustomJoin<FCH, FCI>>>>>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, _CustomJoin<FSE, _CustomJoin<FSF, _CustomJoin<FSG, _CustomJoin<FSH, FSI>>>>>>>>>;
declare function compose<PA extends ModelProperties, OA, FCA, FSA, PB extends ModelProperties, OB, FCB, FSB, PC extends ModelProperties, OC, FCC, FSC, PD extends ModelProperties, OD, FCD, FSD, PE extends ModelProperties, OE, FCE, FSE, PF extends ModelProperties, OF, FCF, FSF, PG extends ModelProperties, OG, FCG, FSG, PH extends ModelProperties, OH, FCH, FSH, PI extends ModelProperties, OI, FCI, FSI>(A: IModelType<PA, OA, FCA, FSA>, B: IModelType<PB, OB, FCB, FSB>, C: IModelType<PC, OC, FCC, FSC>, D: IModelType<PD, OD, FCD, FSD>, E: IModelType<PE, OE, FCE, FSE>, F: IModelType<PF, OF, FCF, FSF>, G: IModelType<PG, OG, FCG, FSG>, H: IModelType<PH, OH, FCH, FSH>, I: IModelType<PI, OI, FCI, FSI>): IModelType<PA & PB & PC & PD & PE & PF & PG & PH & PI, OA & OB & OC & OD & OE & OF & OG & OH & OI, _CustomJoin<FCA, _CustomJoin<FCB, _CustomJoin<FCC, _CustomJoin<FCD, _CustomJoin<FCE, _CustomJoin<FCF, _CustomJoin<FCG, _CustomJoin<FCH, FCI>>>>>>>>, _CustomJoin<FSA, _CustomJoin<FSB, _CustomJoin<FSC, _CustomJoin<FSD, _CustomJoin<FSE, _CustomJoin<FSF, _CustomJoin<FSG, _CustomJoin<FSH, FSI>>>>>>>>>;
/**
 * Returns if a given value represents a model type.
 *
 * @param type
 * @returns
 */
declare function isModelType(type: unknown): type is IAnyModelType;

/**
 * `types.Date` - Creates a type that can only contain a javascript Date value.
 *
 * Example:
 * ```ts
 * const LogLine = types.model({
 *   timestamp: types.Date,
 * })
 *
 * LogLine.create({ timestamp: new Date() })
 * ```
 */
declare const DatePrimitive: IType<number | Date, number, Date>;
/**
 * Returns if a given value represents a primitive type.
 *
 * @param type
 * @returns
 */
declare function isPrimitiveType(type: unknown): type is ISimpleType<string> | ISimpleType<number> | ISimpleType<boolean> | typeof DatePrimitive;

/**
 * `types.literal` - The literal type will return a type that will match only the exact given type.
 * The given value must be a primitive, in order to be serialized to a snapshot correctly.
 * You can use literal to match exact strings for example the exact male or female string.
 *
 * Example:
 * ```ts
 * const Person = types.model({
 *     name: types.string,
 *     gender: types.union(types.literal('male'), types.literal('female'))
 * })
 * ```
 *
 * @param value The value to use in the strict equal check
 * @returns
 */
declare function literal<S extends Primitives>(value: S): ISimpleType<S>;
/**
 * Returns if a given value represents a literal type.
 *
 * @param type
 * @returns
 */
declare function isLiteralType(type: unknown): type is ISimpleType<any>;

declare function refinement<IT extends IAnyType>(name: string, type: IT, predicate: (snapshot: IT['CreationType']) => boolean, message?: string | ((v: IT['CreationType']) => string)): IT;
declare function refinement<IT extends IAnyType>(type: IT, predicate: (snapshot: IT['CreationType']) => boolean, message?: string | ((v: IT['CreationType']) => string)): IT;
/**
 * Returns if a given value is a refinement type.
 *
 * @param type
 * @returns
 */
declare function isRefinementType(type: unknown): type is IAnyType;

/** @hidden */
type UnionStringArray<T extends readonly string[]> = T[number];
declare function enumeration<T extends string>(options: readonly T[]): ISimpleType<UnionStringArray<T[]>>;
declare function enumeration<T extends string>(name: string, options: readonly T[]): ISimpleType<UnionStringArray<T[]>>;

type ITypeDispatcher<Types extends IAnyType[]> = (snapshot: Types[number]['SnapshotType']) => Types[number];
interface UnionOptions<Types extends IAnyType[]> {
    /**
     * Whether or not to use eager validation.
     *
     * When `true`, the first matching type will be used. Otherwise, all types will be checked and the
     * validation will pass if and only if a single type matches.
     */
    eager?: boolean;
    /**
     * A function that returns the type to be used given an input snapshot.
     */
    dispatcher?: ITypeDispatcher<Types>;
}
/**
 * Transform _NotCustomized | _NotCustomized... to _NotCustomized, _NotCustomized | A | B to A | B
 * @hidden
 */
type _CustomCSProcessor<T> = Exclude<T, _NotCustomized> extends never ? _NotCustomized : Exclude<T, _NotCustomized>;
/** @hidden */
interface ITypeUnion<C, S, T> extends IType<_CustomCSProcessor<C>, _CustomCSProcessor<S>, T> {
}
type IUnionType<Types extends IAnyType[]> = ITypeUnion<Types[number]['CreationType'], Types[number]['SnapshotType'], Types[number]['TypeWithoutSTN']>;
declare function union<Types extends IAnyType[]>(...types: Types): IUnionType<Types>;
declare function union<Types extends IAnyType[]>(options: UnionOptions<Types>, ...types: Types): IUnionType<Types>;
/**
 * Returns if a given value represents a union type.
 *
 * @param type
 * @returns
 */
declare function isUnionType(type: unknown): type is IUnionType<IAnyType[]>;

/** @hidden */
type ValidOptionalValue = string | boolean | number | null | undefined;
/** @hidden */
type ValidOptionalValues = [ValidOptionalValue, ...ValidOptionalValue[]];
/** @hidden */
type OptionalDefaultValueOrFunction<IT extends IAnyType> = IT['CreationType'] | IT['SnapshotType'] | (() => ExtractCSTWithSTN<IT>);
/** @hidden */
interface IOptionalIType<IT extends IAnyType, OptionalVals extends ValidOptionalValues> extends IType<IT['CreationType'] | OptionalVals[number], IT['SnapshotType'], IT['TypeWithoutSTN']> {
}
declare function optional<IT extends IAnyType>(type: IT, defaultValueOrFunction: OptionalDefaultValueOrFunction<IT>): IOptionalIType<IT, [undefined]>;
declare function optional<IT extends IAnyType, OptionalVals extends ValidOptionalValues>(type: IT, defaultValueOrFunction: OptionalDefaultValueOrFunction<IT>, optionalValues: OptionalVals): IOptionalIType<IT, OptionalVals>;
/**
 * Returns if a value represents an optional type.
 *
 * @template IT
 * @param type
 * @returns
 */
declare function isOptionalType(type: unknown): type is IOptionalIType<IAnyType, [any, ...any[]]>;

/** @hidden */
interface IMaybeIType<IT extends IAnyType, C, O> extends IType<IT['CreationType'] | C, IT['SnapshotType'] | O, IT['TypeWithoutSTN'] | O> {
}
/** @hidden */
interface IMaybe<IT extends IAnyType> extends IMaybeIType<IT, undefined, undefined> {
}
/** @hidden */
interface IMaybeNull<IT extends IAnyType> extends IMaybeIType<IT, null | undefined, null> {
}
/**
 * `types.maybe` - Maybe will make a type nullable, and also optional.
 * The value `undefined` will be used to represent nullability.
 *
 * @param type
 * @returns
 */
declare function maybe<IT extends IAnyType>(type: IT): IMaybe<IT>;
/**
 * `types.maybeNull` - Maybe will make a type nullable, and also optional.
 * The value `null` will be used to represent no value.
 *
 * @param type
 * @returns
 */
declare function maybeNull<IT extends IAnyType>(type: IT): IMaybeNull<IT>;

declare function late<T extends IAnyType>(type: () => T): T;
declare function late<T extends IAnyType>(name: string, type: () => T): T;
/**
 * Returns if a given value represents a late type.
 *
 * @param type
 * @returns
 */
declare function isLateType(type: unknown): type is IAnyType;

interface LazyOptions<T extends IType<any, any, any>, U> {
    loadType: () => Promise<T>;
    shouldLoadPredicate: (parent: U) => boolean;
}
declare function lazy<T extends IType<any, any, any>, U>(name: string, options: LazyOptions<T, U>): T;

declare function frozen<C>(subType: IType<C, any, any>): IType<C, C, C>;
declare function frozen<T>(defaultValue: T): IType<T | undefined | null, T, T>;
declare function frozen<T = any>(): IType<T, T, T>;
/**
 * Returns if a given value represents a frozen type.
 *
 * @param type
 * @returns
 */
declare function isFrozenType(type: unknown): type is ISimpleType<any>;

type OnReferenceInvalidatedEvent<STN extends IAnyStateTreeNode> = {
    parent: IAnyStateTreeNode;
    invalidTarget: STN | undefined;
    invalidId: ReferenceIdentifier;
    replaceRef: (newRef: STN | null | undefined) => void;
    removeRef: () => void;
    cause: 'detach' | 'destroy' | 'invalidSnapshotReference';
};
type OnReferenceInvalidated<STN extends IAnyStateTreeNode> = (event: OnReferenceInvalidatedEvent<STN>) => void;
/** @hidden */
type ReferenceT<IT extends IAnyType> = IT['TypeWithoutSTN'] & IStateTreeNode<IReferenceType<IT>>;
interface ReferenceOptionsGetSet<IT extends IAnyComplexType> {
    get(identifier: ReferenceIdentifier, parent: IAnyStateTreeNode | null): ReferenceT<IT>;
    set(value: ReferenceT<IT>, parent: IAnyStateTreeNode | null): ReferenceIdentifier;
}
interface ReferenceOptionsOnInvalidated<IT extends IAnyComplexType> {
    onInvalidated: OnReferenceInvalidated<ReferenceT<IT>>;
}
type ReferenceOptions<IT extends IAnyComplexType> = ReferenceOptionsGetSet<IT> | ReferenceOptionsOnInvalidated<IT> | (ReferenceOptionsGetSet<IT> & ReferenceOptionsOnInvalidated<IT>);
/** @hidden */
interface IReferenceType<IT extends IAnyComplexType> extends IType<ReferenceIdentifier, ReferenceIdentifier, IT['TypeWithoutSTN']> {
}
/**
 * `types.reference` - Creates a reference to another type, which should have defined an identifier.
 * See also the [reference and identifiers](https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree#references-and-identifiers) section.
 */
declare function reference<IT extends IAnyComplexType>(subType: IT, options?: ReferenceOptions<IT>): IReferenceType<IT>;
/**
 * Returns if a given value represents a reference type.
 *
 * @param type
 * @returns
 */
declare function isReferenceType(type: unknown): type is IReferenceType<IAnyComplexType>;
declare function safeReference<IT extends IAnyComplexType>(subType: IT, options: (ReferenceOptionsGetSet<IT> | {}) & {
    acceptsUndefined: false;
    onInvalidated?: OnReferenceInvalidated<ReferenceT<IT>>;
}): IReferenceType<IT>;
declare function safeReference<IT extends IAnyComplexType>(subType: IT, options?: (ReferenceOptionsGetSet<IT> | {}) & {
    acceptsUndefined?: boolean;
    onInvalidated?: OnReferenceInvalidated<ReferenceT<IT>>;
}): IMaybe<IReferenceType<IT>>;

/**
 * `types.identifier` - Identifiers are used to make references, lifecycle events and reconciling works.
 * Inside a state tree, for each type can exist only one instance for each given identifier.
 * For example there couldn't be 2 instances of user with id 1. If you need more, consider using references.
 * Identifier can be used only as type property of a model.
 * This type accepts as parameter the value type of the identifier field that can be either string or number.
 *
 * Example:
 * ```ts
 *  const Todo = types.model("Todo", {
 *      id: types.identifier,
 *      title: types.string
 *  })
 * ```
 *
 * @returns
 */
declare const identifier: ISimpleType<string>;
/**
 * `types.identifierNumber` - Similar to `types.identifier`. This one will serialize from / to a number when applying snapshots
 *
 * Example:
 * ```ts
 *  const Todo = types.model("Todo", {
 *      id: types.identifierNumber,
 *      title: types.string
 *  })
 * ```
 *
 * @returns
 */
declare const identifierNumber: ISimpleType<number>;
/**
 * Returns if a given value represents an identifier type.
 *
 * @param type
 * @returns
 */
declare function isIdentifierType(type: unknown): type is typeof identifier | typeof identifierNumber;
/**
 * Valid types for identifiers.
 */
type ReferenceIdentifier = string | number;

interface CustomTypeOptions<S, T> {
    /** Friendly name */
    name: string;
    /** given a serialized value and environment, how to turn it into the target type */
    fromSnapshot(snapshot: S, env?: any): T;
    /** return the serialization of the current value */
    toSnapshot(value: T): S;
    /** if true, this is a converted value, if false, it's a snapshot */
    isTargetType(value: T | S): boolean;
    /** a non empty string is assumed to be a validation error */
    getValidationMessage(snapshot: S): string;
}
/**
 * `types.custom` - Creates a custom type. Custom types can be used for arbitrary immutable values, that have a serializable representation. For example, to create your own Date representation, Decimal type etc.
 *
 * The signature of the options is:
 * ```ts
 * export interface CustomTypeOptions<S, T> {
 *     // Friendly name
 *     name: string
 *     // given a serialized value and environment, how to turn it into the target type
 *     fromSnapshot(snapshot: S, env: any): T
 *     // return the serialization of the current value
 *     toSnapshot(value: T): S
 *     // if true, this is a converted value, if false, it's a snapshot
 *     isTargetType(value: T | S): value is T
 *     // a non empty string is assumed to be a validation error
 *     getValidationMessage?(snapshot: S): string
 * }
 * ```
 *
 * Example:
 * ```ts
 * const DecimalPrimitive = types.custom<string, Decimal>({
 *     name: "Decimal",
 *     fromSnapshot(value: string) {
 *         return new Decimal(value)
 *     },
 *     toSnapshot(value: Decimal) {
 *         return value.toString()
 *     },
 *     isTargetType(value: string | Decimal): boolean {
 *         return value instanceof Decimal
 *     },
 *     getValidationMessage(value: string): string {
 *         if (/^-?\d+\.\d+$/.test(value)) return "" // OK
 *         return `'${value}' doesn't look like a valid decimal number`
 *     }
 * })
 *
 * const Wallet = types.model({
 *     balance: DecimalPrimitive
 * })
 * ```
 *
 * @param options
 * @returns
 */
declare function custom<S, T>(options: CustomTypeOptions<S, T>): IType<S | T, S, T>;

declare const types: {
    enumeration: typeof enumeration;
    model: typeof model;
    compose: typeof compose;
    custom: typeof custom;
    reference: typeof reference;
    safeReference: typeof safeReference;
    union: typeof union;
    optional: typeof optional;
    literal: typeof literal;
    maybe: typeof maybe;
    maybeNull: typeof maybeNull;
    refinement: typeof refinement;
    string: ISimpleType<string>;
    boolean: ISimpleType<boolean>;
    number: ISimpleType<number>;
    integer: ISimpleType<number>;
    float: ISimpleType<number>;
    finite: ISimpleType<number>;
    Date: IType<number | Date, number, Date>;
    map: typeof map;
    array: typeof array;
    frozen: typeof frozen;
    identifier: ISimpleType<string>;
    identifierNumber: ISimpleType<number>;
    late: typeof late;
    lazy: typeof lazy;
    undefined: ISimpleType<undefined>;
    null: ISimpleType<null>;
    snapshotProcessor: typeof snapshotProcessor;
};

export { type CustomTypeOptions, type IActionContext, type IActionRecorder, type IActionTrackingMiddleware2Call, type IActionTrackingMiddleware2Hooks, type IActionTrackingMiddlewareHooks, type IAnyComplexType, type IAnyModelType, type IAnyStateTreeNode, type IAnyType, type IArrayType, type IComplexType, type IDisposer, type IJsonPatch, type IMSTArray, type IMSTMap, type IMapType, type IMaybe, type IMaybeIType, type IMaybeNull, type IMiddlewareEvent, type IMiddlewareEventType, type IMiddlewareHandler, type IModelReflectionData, type IModelReflectionPropertiesData, type IModelType, type IOptionalIType, type IPatchRecorder, type IReferenceType, type IReversibleJsonPatch, type ISerializedActionCall, type ISimpleType, type ISnapshotProcessor, type ISnapshotProcessors, type IStateTreeNode, type IType, type ITypeUnion, type Instance, type LivelinessMode, type LivelynessMode, type ModelActions, type ModelCreationType, type ModelCreationType2, type ModelInstanceType, type ModelInstanceTypeProps, type ModelPrimitive, type ModelProperties, type ModelPropertiesDeclaration, type ModelPropertiesDeclarationToProperties, type ModelSnapshotType, type ModelSnapshotType2, type OnReferenceInvalidated, type OnReferenceInvalidatedEvent, type OptionalDefaultValueOrFunction, type ReferenceIdentifier, type ReferenceOptions, type ReferenceOptionsGetSet, type ReferenceOptionsOnInvalidated, type SnapshotIn, type SnapshotOrInstance, type SnapshotOut, type TypeOfValue, type TypeOrStateTreeNodeToStateTreeNode, type UnionOptions, type UnionStringArray, type ValidOptionalValue, type ValidOptionalValues, type _CustomCSProcessor, type _CustomJoin, type _CustomOrOther, type _NotCustomized, addDisposer, addMiddleware, applyAction, applyPatch, applySnapshot, cast, castFlowReturn, castToReferenceSnapshot, castToSnapshot, clone, createActionTrackingMiddleware, createActionTrackingMiddleware2, decorate, destroy, detach, escapeJsonPath, flow, getChildType, getEnv, getIdentifier, getLivelinessChecking, getMembers, getNodeId, getParent, getParentOfType, getPath, getPathParts, getPropertyMembers, getRelativePath, getRoot, getRunningActionContext, getSnapshot, getType, hasEnv, hasParent, hasParentOfType, isActionContextChildOf, isActionContextThisOrChildOf, isAlive, isArrayType, isFrozenType, isIdentifierType, isLateType, isLiteralType, isMapType, isModelType, isOptionalType, isPrimitiveType, isProtected, isReferenceType, isRefinementType, isRoot, isStateTreeNode, isType, isUnionType, isValidReference, joinJsonPath, onAction, onPatch, onSnapshot, process, protect, recordActions, recordPatches, resolveIdentifier, resolvePath, setLivelinessChecking, setLivelynessChecking, splitJsonPath, types as t, toGenerator, toGeneratorFunction, tryReference, tryResolve, typecheck, types, unescapeJsonPath, unprotect, walk };
