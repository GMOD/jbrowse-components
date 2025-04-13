// src/core/node/livelinessChecking.ts
var livelinessChecking = "warn";
function setLivelinessChecking(mode) {
  livelinessChecking = mode;
}
function getLivelinessChecking() {
  return livelinessChecking;
}
function setLivelynessChecking(mode) {
  setLivelinessChecking(mode);
}

// src/core/node/Hook.ts
var Hook = /* @__PURE__ */ ((Hook3) => {
  Hook3["afterCreate"] = "afterCreate";
  Hook3["afterAttach"] = "afterAttach";
  Hook3["afterCreationFinalization"] = "afterCreationFinalization";
  Hook3["beforeDetach"] = "beforeDetach";
  Hook3["beforeDestroy"] = "beforeDestroy";
  return Hook3;
})(Hook || {});

// src/core/mst-operations.ts
import { isComputedProp, isObservableProp } from "mobx";
function getType(object) {
  assertIsStateTreeNode(object, 1);
  return getStateTreeNode(object).type;
}
function getChildType(object, propertyName) {
  assertIsStateTreeNode(object, 1);
  return getStateTreeNode(object).getChildType(propertyName);
}
function onPatch(target, callback) {
  assertIsStateTreeNode(target, 1);
  assertIsFunction(callback, 2);
  return getStateTreeNode(target).onPatch(callback);
}
function onSnapshot(target, callback) {
  assertIsStateTreeNode(target, 1);
  assertIsFunction(callback, 2);
  return getStateTreeNode(target).onSnapshot(callback);
}
function applyPatch(target, patch) {
  assertIsStateTreeNode(target, 1);
  assertArg(patch, (p) => typeof p === "object", "object or array", 2);
  getStateTreeNode(target).applyPatches(asArray(patch));
}
function recordPatches(subject, filter) {
  assertIsStateTreeNode(subject, 1);
  const data = {
    patches: [],
    inversePatches: []
  };
  const publicData = {};
  let disposer;
  const recorder = {
    get recording() {
      return !!disposer;
    },
    get patches() {
      if (!publicData.patches) {
        publicData.patches = data.patches.slice();
      }
      return publicData.patches;
    },
    get reversedInversePatches() {
      if (!publicData.reversedInversePatches) {
        publicData.reversedInversePatches = data.inversePatches.slice().reverse();
      }
      return publicData.reversedInversePatches;
    },
    get inversePatches() {
      if (!publicData.inversePatches) {
        publicData.inversePatches = data.inversePatches.slice();
      }
      return publicData.inversePatches;
    },
    stop() {
      if (disposer) {
        disposer();
        disposer = void 0;
      }
    },
    resume() {
      if (disposer) return;
      disposer = onPatch(subject, (patch, inversePatch) => {
        if (filter && !filter(patch, inversePatch, getRunningActionContext())) {
          return;
        }
        data.patches.push(patch);
        data.inversePatches.push(inversePatch);
        publicData.patches = void 0;
        publicData.inversePatches = void 0;
        publicData.reversedInversePatches = void 0;
      });
    },
    replay(target) {
      applyPatch(target || subject, data.patches);
    },
    undo(target) {
      applyPatch(target || subject, data.inversePatches.slice().reverse());
    }
  };
  recorder.resume();
  return recorder;
}
function protect(target) {
  assertIsStateTreeNode(target, 1);
  const node = getStateTreeNode(target);
  if (!node.isRoot)
    throw new MstError("`protect` can only be invoked on root nodes");
  node.isProtectionEnabled = true;
}
function unprotect(target) {
  assertIsStateTreeNode(target, 1);
  const node = getStateTreeNode(target);
  if (!node.isRoot)
    throw new MstError("`unprotect` can only be invoked on root nodes");
  node.isProtectionEnabled = false;
}
function isProtected(target) {
  return getStateTreeNode(target).isProtected;
}
function applySnapshot(target, snapshot) {
  assertIsStateTreeNode(target, 1);
  return getStateTreeNode(target).applySnapshot(snapshot);
}
function getSnapshot(target, applyPostProcess = true) {
  assertIsStateTreeNode(target, 1);
  const node = getStateTreeNode(target);
  if (applyPostProcess) return node.snapshot;
  return freeze(node.type.getSnapshot(node, false));
}
function hasParent(target, depth = 1) {
  assertIsStateTreeNode(target, 1);
  assertIsNumber(depth, 2, 0);
  let parent = getStateTreeNode(target).parent;
  while (parent) {
    if (--depth === 0) return true;
    parent = parent.parent;
  }
  return false;
}
function getParent(target, depth = 1) {
  assertIsStateTreeNode(target, 1);
  assertIsNumber(depth, 2, 0);
  let d = depth;
  let parent = getStateTreeNode(target).parent;
  while (parent) {
    if (--d === 0) return parent.storedValue;
    parent = parent.parent;
  }
  throw new MstError(
    `Failed to find the parent of ${getStateTreeNode(target)} at depth ${depth}`
  );
}
function hasParentOfType(target, type) {
  assertIsStateTreeNode(target, 1);
  assertIsType(type, 2);
  let parent = getStateTreeNode(target).parent;
  while (parent) {
    if (type.is(parent.storedValue)) return true;
    parent = parent.parent;
  }
  return false;
}
function getParentOfType(target, type) {
  assertIsStateTreeNode(target, 1);
  assertIsType(type, 2);
  let parent = getStateTreeNode(target).parent;
  while (parent) {
    if (type.is(parent.storedValue)) return parent.storedValue;
    parent = parent.parent;
  }
  throw new MstError(
    `Failed to find the parent of ${getStateTreeNode(target)} of a given type`
  );
}
function getRoot(target) {
  assertIsStateTreeNode(target, 1);
  return getStateTreeNode(target).root.storedValue;
}
function getPath(target) {
  assertIsStateTreeNode(target, 1);
  return getStateTreeNode(target).path;
}
function getPathParts(target) {
  assertIsStateTreeNode(target, 1);
  return splitJsonPath(getStateTreeNode(target).path);
}
function isRoot(target) {
  assertIsStateTreeNode(target, 1);
  return getStateTreeNode(target).isRoot;
}
function resolvePath(target, path) {
  assertIsStateTreeNode(target, 1);
  assertIsString(path, 2);
  const node = resolveNodeByPath(getStateTreeNode(target), path);
  return node ? node.value : void 0;
}
function resolveIdentifier(type, target, identifier2) {
  assertIsType(type, 1);
  assertIsStateTreeNode(target, 2);
  assertIsValidIdentifier(identifier2, 3);
  const node = getStateTreeNode(target).root.identifierCache.resolve(
    type,
    normalizeIdentifier(identifier2)
  );
  return node?.value;
}
function getIdentifier(target) {
  assertIsStateTreeNode(target, 1);
  return getStateTreeNode(target).identifier;
}
function tryReference(getter, checkIfAlive = true) {
  try {
    const node = getter();
    if (node === void 0 || node === null) {
      return void 0;
    } else if (isStateTreeNode(node)) {
      if (!checkIfAlive) {
        return node;
      } else {
        return isAlive(node) ? node : void 0;
      }
    } else {
      throw new MstError(
        "The reference to be checked is not one of node, null or undefined"
      );
    }
  } catch (e) {
    if (e instanceof InvalidReferenceError) {
      return void 0;
    }
    throw e;
  }
}
function isValidReference(getter, checkIfAlive = true) {
  try {
    const node = getter();
    if (node === void 0 || node === null) {
      return false;
    } else if (isStateTreeNode(node)) {
      return checkIfAlive ? isAlive(node) : true;
    } else {
      throw new MstError(
        "The reference to be checked is not one of node, null or undefined"
      );
    }
  } catch (e) {
    if (e instanceof InvalidReferenceError) {
      return false;
    }
    throw e;
  }
}
function tryResolve(target, path) {
  assertIsStateTreeNode(target, 1);
  assertIsString(path, 2);
  const node = resolveNodeByPath(getStateTreeNode(target), path, false);
  if (node === void 0) return void 0;
  try {
    return node.value;
  } catch (e) {
    return void 0;
  }
}
function getRelativePath(base, target) {
  assertIsStateTreeNode(base, 1);
  assertIsStateTreeNode(target, 2);
  return getRelativePathBetweenNodes(
    getStateTreeNode(base),
    getStateTreeNode(target)
  );
}
function clone(source, keepEnvironment = true) {
  assertIsStateTreeNode(source, 1);
  const node = getStateTreeNode(source);
  return node.type.create(
    node.snapshot,
    keepEnvironment === true ? node.root.environment : keepEnvironment === false ? void 0 : keepEnvironment
  );
}
function detach(target) {
  assertIsStateTreeNode(target, 1);
  getStateTreeNode(target).detach();
  return target;
}
function destroy(target) {
  assertIsStateTreeNode(target, 1);
  const node = getStateTreeNode(target);
  if (node.isRoot) node.die();
  else node.parent.removeChild(node.subpath);
}
function isAlive(target) {
  assertIsStateTreeNode(target, 1);
  return getStateTreeNode(target).observableIsAlive;
}
function addDisposer(target, disposer) {
  assertIsStateTreeNode(target, 1);
  assertIsFunction(disposer, 2);
  const node = getStateTreeNode(target);
  node.addDisposer(disposer);
  return disposer;
}
function getEnv(target) {
  assertIsStateTreeNode(target, 1);
  const node = getStateTreeNode(target);
  const env = node.root.environment;
  if (!env)
    throw new MstError(`Failed to find the environment of ${node} ${node.path}`);
  return env;
}
function hasEnv(target) {
  if (process.env.NODE_ENV !== "production") {
    if (!isStateTreeNode(target))
      throw new MstError(
        "expected first argument to be a @jbrowse/@jbrowse/mobx-state-tree node, got " + target + " instead"
      );
  }
  const node = getStateTreeNode(target);
  const env = node.root.environment;
  return !!env;
}
function walk(target, processor) {
  assertIsStateTreeNode(target, 1);
  assertIsFunction(processor, 2);
  const node = getStateTreeNode(target);
  node.getChildren().forEach((child) => {
    if (isStateTreeNode(child.storedValue)) walk(child.storedValue, processor);
  });
  processor(node.storedValue);
}
function getPropertyMembers(typeOrNode) {
  let type;
  if (isStateTreeNode(typeOrNode)) {
    type = getType(typeOrNode);
  } else {
    type = typeOrNode;
  }
  assertArg(type, (t) => isModelType(t), "model type or model instance", 1);
  return {
    name: type.name,
    properties: { ...type.properties }
  };
}
function getMembers(target) {
  const type = getStateTreeNode(target).type;
  const reflected = {
    ...getPropertyMembers(type),
    actions: [],
    volatile: [],
    views: [],
    flowActions: []
  };
  const props = Object.getOwnPropertyNames(target);
  props.forEach((key) => {
    if (key in reflected.properties) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor.get) {
      if (isComputedProp(target, key)) reflected.views.push(key);
      else reflected.volatile.push(key);
      return;
    }
    if (descriptor.value._isFlowAction === true) {
      reflected.flowActions.push(key);
    }
    if (descriptor.value._isMSTAction === true) {
      reflected.actions.push(key);
    } else if (isObservableProp(target, key)) {
      reflected.volatile.push(key);
    } else {
      reflected.views.push(key);
    }
  });
  return reflected;
}
function cast(snapshotOrInstance) {
  return snapshotOrInstance;
}
function castToSnapshot(snapshotOrInstance) {
  return snapshotOrInstance;
}
function castToReferenceSnapshot(instance) {
  return instance;
}
function getNodeId(target) {
  assertIsStateTreeNode(target, 1);
  return getStateTreeNode(target).nodeId;
}

// src/core/node/BaseNode.ts
import { createAtom } from "mobx";
var BaseNode = class {
  constructor(type, parent, subpath, environment) {
    this.type = type;
    this.environment = environment;
    this.environment = environment;
    this.baseSetParent(parent, subpath);
  }
  _escapedSubpath;
  _subpath;
  get subpath() {
    return this._subpath;
  }
  _subpathUponDeath;
  get subpathUponDeath() {
    return this._subpathUponDeath;
  }
  _pathUponDeath;
  get pathUponDeath() {
    return this._pathUponDeath;
  }
  storedValue;
  // usually the same type as the value, but not always (such as with references)
  get value() {
    return this.type.getValue(this);
  }
  aliveAtom;
  _state = 0 /* INITIALIZING */;
  get state() {
    return this._state;
  }
  set state(val) {
    const wasAlive = this.isAlive;
    this._state = val;
    const isAlive2 = this.isAlive;
    if (this.aliveAtom && wasAlive !== isAlive2) {
      this.aliveAtom.reportChanged();
    }
  }
  _hookSubscribers;
  fireInternalHook(name) {
    if (this._hookSubscribers) {
      this._hookSubscribers.emit(name, this, name);
    }
  }
  registerHook(hook, hookHandler) {
    if (!this._hookSubscribers) {
      this._hookSubscribers = new EventHandlers();
    }
    return this._hookSubscribers.register(hook, hookHandler);
  }
  _parent;
  get parent() {
    return this._parent;
  }
  getReconciliationType() {
    return this.type;
  }
  pathAtom;
  baseSetParent(parent, subpath) {
    this._parent = parent;
    this._subpath = subpath;
    this._escapedSubpath = void 0;
    if (this.pathAtom) {
      this.pathAtom.reportChanged();
    }
  }
  /*
   * Returns (escaped) path representation as string
   */
  get path() {
    return this.getEscapedPath(true);
  }
  getEscapedPath(reportObserved) {
    if (reportObserved) {
      if (!this.pathAtom) {
        this.pathAtom = createAtom(`path`);
      }
      this.pathAtom.reportObserved();
    }
    if (!this.parent) return "";
    if (this._escapedSubpath === void 0) {
      this._escapedSubpath = !this._subpath ? "" : escapeJsonPath(this._subpath);
    }
    return this.parent.getEscapedPath(reportObserved) + "/" + this._escapedSubpath;
  }
  get isRoot() {
    return this.parent === null;
  }
  get isAlive() {
    return this.state !== 4 /* DEAD */;
  }
  get isDetaching() {
    return this.state === 3 /* DETACHING */;
  }
  get observableIsAlive() {
    if (!this.aliveAtom) {
      this.aliveAtom = createAtom(`alive`);
    }
    this.aliveAtom.reportObserved();
    return this.isAlive;
  }
  baseFinalizeCreation(whenFinalized) {
    if (devMode()) {
      if (!this.isAlive) {
        throw new MstError(
          "assertion failed: cannot finalize the creation of a node that is already dead"
        );
      }
    }
    if (this.state === 1 /* CREATED */) {
      if (this.parent) {
        if (this.parent.state !== 2 /* FINALIZED */) {
          return;
        }
        this.fireHook("afterAttach" /* afterAttach */);
      }
      this.state = 2 /* FINALIZED */;
      if (whenFinalized) {
        whenFinalized();
      }
    }
  }
  baseFinalizeDeath() {
    if (this._hookSubscribers) {
      this._hookSubscribers.clearAll();
    }
    this._subpathUponDeath = this._subpath;
    this._pathUponDeath = this.getEscapedPath(false);
    this.baseSetParent(null, "");
    this.state = 4 /* DEAD */;
  }
  baseAboutToDie() {
    this.fireHook("beforeDestroy" /* beforeDestroy */);
  }
};

// src/core/node/scalar-node.ts
import { action } from "mobx";
var ScalarNode = class extends BaseNode {
  constructor(simpleType, parent, subpath, environment, initialSnapshot) {
    super(simpleType, parent, subpath, environment);
    try {
      this.storedValue = simpleType.createNewInstance(initialSnapshot);
    } catch (e) {
      this.state = 4 /* DEAD */;
      throw e;
    }
    this.state = 1 /* CREATED */;
    this.finalizeCreation();
  }
  get root() {
    if (!this.parent)
      throw new MstError(`This scalar node is not part of a tree`);
    return this.parent.root;
  }
  setParent(newParent, subpath) {
    const parentChanged = this.parent !== newParent;
    const subpathChanged = this.subpath !== subpath;
    if (!parentChanged && !subpathChanged) {
      return;
    }
    if (devMode()) {
      if (!subpath) {
        throw new MstError("assertion failed: subpath expected");
      }
      if (!newParent) {
        throw new MstError("assertion failed: parent expected");
      }
      if (parentChanged) {
        throw new MstError(
          "assertion failed: scalar nodes cannot change their parent"
        );
      }
    }
    this.environment = void 0;
    this.baseSetParent(this.parent, subpath);
  }
  get snapshot() {
    return freeze(this.getSnapshot());
  }
  getSnapshot() {
    return this.type.getSnapshot(this);
  }
  toString() {
    const path = (this.isAlive ? this.path : this.pathUponDeath) || "<root>";
    return `${this.type.name}@${path}${this.isAlive ? "" : " [dead]"}`;
  }
  die() {
    if (!this.isAlive || this.state === 3 /* DETACHING */) return;
    this.aboutToDie();
    this.finalizeDeath();
  }
  finalizeCreation() {
    this.baseFinalizeCreation();
  }
  aboutToDie() {
    this.baseAboutToDie();
  }
  finalizeDeath() {
    this.baseFinalizeDeath();
  }
  fireHook(name) {
    this.fireInternalHook(name);
  }
};
ScalarNode.prototype.die = action(ScalarNode.prototype.die);

// src/core/node/object-node.ts
import {
  action as action2,
  computed,
  reaction,
  _allowStateChangesInsideComputed
} from "mobx";
var nextNodeId = 1;
var snapshotReactionOptions = {
  onError(e) {
    throw e;
  }
};
var ObjectNode = class extends BaseNode {
  nodeId = ++nextNodeId;
  identifierAttribute;
  identifier;
  // Identifier is always normalized to string, even if the identifier property isn't
  unnormalizedIdentifier;
  identifierCache;
  isProtectionEnabled = true;
  middlewares;
  hasSnapshotPostProcessor = false;
  _applyPatches;
  applyPatches(patches) {
    this.createObservableInstanceIfNeeded();
    this._applyPatches(patches);
  }
  _applySnapshot;
  applySnapshot(snapshot) {
    this.createObservableInstanceIfNeeded();
    this._applySnapshot(snapshot);
  }
  _autoUnbox = true;
  // unboxing is disabled when reading child nodes
  _isRunningAction = false;
  // only relevant for root
  _hasSnapshotReaction = false;
  _observableInstanceState = 0 /* UNINITIALIZED */;
  _childNodes;
  _initialSnapshot;
  _cachedInitialSnapshot;
  _cachedInitialSnapshotCreated = false;
  _snapshotComputed;
  constructor(complexType, parent, subpath, environment, initialValue) {
    super(complexType, parent, subpath, environment);
    this._snapshotComputed = computed(() => freeze(this.getSnapshot()));
    this.unbox = this.unbox.bind(this);
    this._initialSnapshot = freeze(initialValue);
    this.identifierAttribute = complexType.identifierAttribute;
    if (!parent) {
      this.identifierCache = new IdentifierCache();
    }
    this._childNodes = complexType.initializeChildNodes(
      this,
      this._initialSnapshot
    );
    this.identifier = null;
    this.unnormalizedIdentifier = null;
    if (this.identifierAttribute && this._initialSnapshot) {
      let id = this._initialSnapshot[this.identifierAttribute];
      if (id === void 0) {
        const childNode = this._childNodes[this.identifierAttribute];
        if (childNode) {
          id = childNode.value;
        }
      }
      if (typeof id !== "string" && typeof id !== "number") {
        throw new MstError(
          `Instance identifier '${this.identifierAttribute}' for type '${this.type.name}' must be a string or a number`
        );
      }
      this.identifier = normalizeIdentifier(id);
      this.unnormalizedIdentifier = id;
    }
    if (!parent) {
      this.identifierCache.addNodeToCache(this);
    } else {
      parent.root.identifierCache.addNodeToCache(this);
    }
  }
  createObservableInstanceIfNeeded(fireHooks = true) {
    if (this._observableInstanceState === 0 /* UNINITIALIZED */) {
      this.createObservableInstance(fireHooks);
    }
  }
  createObservableInstance(fireHooks = true) {
    if (devMode()) {
      if (this.state !== 0 /* INITIALIZING */) {
        throw new MstError(
          "assertion failed: the creation of the observable instance must be done on the initializing phase"
        );
      }
    }
    this._observableInstanceState = 1 /* CREATING */;
    const parentChain = [];
    let parent = this.parent;
    while (parent && parent._observableInstanceState === 0 /* UNINITIALIZED */) {
      parentChain.unshift(parent);
      parent = parent.parent;
    }
    for (const p of parentChain) {
      p.createObservableInstanceIfNeeded(false);
    }
    const type = this.type;
    try {
      this.storedValue = type.createNewInstance(
        this._childNodes
      );
      this.preboot();
      this._isRunningAction = true;
      type.finalizeNewInstance(this, this.storedValue);
    } catch (e) {
      this.state = 4 /* DEAD */;
      throw e;
    } finally {
      this._isRunningAction = false;
    }
    this._observableInstanceState = 2 /* CREATED */;
    this._snapshotComputed.trackAndCompute();
    if (this.isRoot) this._addSnapshotReaction();
    this._childNodes = EMPTY_OBJECT;
    this.state = 1 /* CREATED */;
    if (fireHooks) {
      this.fireHook("afterCreate" /* afterCreate */);
      this.finalizeCreation();
      for (const p of parentChain.reverse()) {
        p.fireHook("afterCreate" /* afterCreate */);
        p.finalizeCreation();
      }
    }
  }
  get root() {
    const parent = this.parent;
    return parent ? parent.root : this;
  }
  clearParent() {
    if (!this.parent) return;
    this.fireHook("beforeDetach" /* beforeDetach */);
    const previousState = this.state;
    this.state = 3 /* DETACHING */;
    const root = this.root;
    const newEnv = root.environment;
    const newIdCache = root.identifierCache.splitCache(this);
    try {
      this.parent.removeChild(this.subpath);
      this.baseSetParent(null, "");
      this.environment = newEnv;
      this.identifierCache = newIdCache;
    } finally {
      this.state = previousState;
    }
  }
  setParent(newParent, subpath) {
    const parentChanged = newParent !== this.parent;
    const subpathChanged = subpath !== this.subpath;
    if (!parentChanged && !subpathChanged) {
      return;
    }
    if (devMode()) {
      if (!subpath) {
        throw new MstError("assertion failed: subpath expected");
      }
      if (!newParent) {
        throw new MstError("assertion failed: new parent expected");
      }
      if (this.parent && parentChanged) {
        throw new MstError(
          `A node cannot exists twice in the state tree. Failed to add ${this} to path '${newParent.path}/${subpath}'.`
        );
      }
      if (!this.parent && newParent.root === this) {
        throw new MstError(
          `A state tree is not allowed to contain itself. Cannot assign ${this} to path '${newParent.path}/${subpath}'`
        );
      }
      if (!this.parent && !!this.environment && this.environment !== newParent.root.environment) {
        throw new MstError(
          `A state tree cannot be made part of another state tree as long as their environments are different.`
        );
      }
    }
    if (parentChanged) {
      this.environment = void 0;
      newParent.root.identifierCache.mergeCache(this);
      this.baseSetParent(newParent, subpath);
      this.fireHook("afterAttach" /* afterAttach */);
    } else if (subpathChanged) {
      this.baseSetParent(this.parent, subpath);
    }
  }
  fireHook(name) {
    this.fireInternalHook(name);
    const fn = this.storedValue && typeof this.storedValue === "object" && this.storedValue[name];
    if (typeof fn === "function") {
      if (_allowStateChangesInsideComputed) {
        _allowStateChangesInsideComputed(() => {
          fn.apply(this.storedValue);
        });
      } else {
        fn.apply(this.storedValue);
      }
    }
  }
  _snapshotUponDeath;
  // advantage of using computed for a snapshot is that nicely respects transactions etc.
  get snapshot() {
    if (this.hasSnapshotPostProcessor) {
      this.createObservableInstanceIfNeeded();
    }
    return this._snapshotComputed.get();
  }
  // NOTE: we use this method to get snapshot without creating @computed overhead
  getSnapshot() {
    if (!this.isAlive) return this._snapshotUponDeath;
    return this._observableInstanceState === 2 /* CREATED */ ? this._getActualSnapshot() : this._getCachedInitialSnapshot();
  }
  _getActualSnapshot() {
    return this.type.getSnapshot(this);
  }
  _getCachedInitialSnapshot() {
    if (!this._cachedInitialSnapshotCreated) {
      const type = this.type;
      const childNodes = this._childNodes;
      const snapshot = this._initialSnapshot;
      this._cachedInitialSnapshot = type.processInitialSnapshot(
        childNodes,
        snapshot
      );
      this._cachedInitialSnapshotCreated = true;
    }
    return this._cachedInitialSnapshot;
  }
  isRunningAction() {
    if (this._isRunningAction) return true;
    if (this.isRoot) return false;
    return this.parent.isRunningAction();
  }
  assertAlive(context) {
    const livelinessChecking2 = getLivelinessChecking();
    if (!this.isAlive && livelinessChecking2 !== "ignore") {
      const error = this._getAssertAliveError(context);
      switch (livelinessChecking2) {
        case "error":
          throw new MstError(error);
        case "warn":
          warnError(error);
      }
    }
  }
  _getAssertAliveError(context) {
    const escapedPath = this.getEscapedPath(false) || this.pathUponDeath || "";
    const subpath = context.subpath && escapeJsonPath(context.subpath) || "";
    let actionContext = context.actionContext || getCurrentActionContext();
    if (actionContext && actionContext.type !== "action" && actionContext.parentActionEvent) {
      actionContext = actionContext.parentActionEvent;
    }
    let actionFullPath = "";
    if (actionContext && actionContext.name != null) {
      const actionPath = actionContext && actionContext.context && getPath(actionContext.context) || escapedPath;
      actionFullPath = `${actionPath}.${actionContext.name}()`;
    }
    return `You are trying to read or write to an object that is no longer part of a state tree. (Object type: '${this.type.name}', Path upon death: '${escapedPath}', Subpath: '${subpath}', Action: '${actionFullPath}'). Either detach nodes first, or don't use objects after removing / replacing them in the tree.`;
  }
  getChildNode(subpath) {
    this.assertAlive({
      subpath
    });
    this._autoUnbox = false;
    try {
      return this._observableInstanceState === 2 /* CREATED */ ? this.type.getChildNode(this, subpath) : this._childNodes[subpath];
    } finally {
      this._autoUnbox = true;
    }
  }
  getChildren() {
    this.assertAlive(EMPTY_OBJECT);
    this._autoUnbox = false;
    try {
      return this._observableInstanceState === 2 /* CREATED */ ? this.type.getChildren(this) : convertChildNodesToArray(this._childNodes);
    } finally {
      this._autoUnbox = true;
    }
  }
  getChildType(propertyName) {
    return this.type.getChildType(propertyName);
  }
  get isProtected() {
    return this.root.isProtectionEnabled;
  }
  assertWritable(context) {
    this.assertAlive(context);
    if (!this.isRunningAction() && this.isProtected) {
      throw new MstError(
        `Cannot modify '${this}', the object is protected and can only be modified by using an action.`
      );
    }
  }
  removeChild(subpath) {
    this.type.removeChild(this, subpath);
  }
  // bound on the constructor
  unbox(childNode) {
    if (!childNode) return childNode;
    this.assertAlive({
      subpath: childNode.subpath || childNode.subpathUponDeath
    });
    return this._autoUnbox ? childNode.value : childNode;
  }
  toString() {
    const path = (this.isAlive ? this.path : this.pathUponDeath) || "<root>";
    const identifier2 = this.identifier ? `(id: ${this.identifier})` : "";
    return `${this.type.name}@${path}${identifier2}${this.isAlive ? "" : " [dead]"}`;
  }
  finalizeCreation() {
    this.baseFinalizeCreation(() => {
      for (let child of this.getChildren()) {
        child.finalizeCreation();
      }
      this.fireInternalHook("afterCreationFinalization" /* afterCreationFinalization */);
    });
  }
  detach() {
    if (!this.isAlive)
      throw new MstError(`Error while detaching, node is not alive.`);
    this.clearParent();
  }
  preboot() {
    const self = this;
    this._applyPatches = createActionInvoker(
      this.storedValue,
      "@APPLY_PATCHES",
      (patches) => {
        patches.forEach((patch) => {
          if (!patch.path) {
            self.type.applySnapshot(self, patch.value);
            return;
          }
          const parts = splitJsonPath(patch.path);
          const node = resolveNodeByPathParts(
            self,
            parts.slice(0, -1)
          );
          node.applyPatchLocally(parts[parts.length - 1], patch);
        });
      }
    );
    this._applySnapshot = createActionInvoker(
      this.storedValue,
      "@APPLY_SNAPSHOT",
      (snapshot) => {
        if (snapshot === self.snapshot) return;
        return self.type.applySnapshot(self, snapshot);
      }
    );
    addHiddenFinalProp(this.storedValue, "$treenode", this);
    addHiddenFinalProp(this.storedValue, "toJSON", toJSON);
  }
  die() {
    if (!this.isAlive || this.state === 3 /* DETACHING */) return;
    this.aboutToDie();
    this.finalizeDeath();
  }
  aboutToDie() {
    if (this._observableInstanceState === 0 /* UNINITIALIZED */) {
      return;
    }
    this.getChildren().forEach((node) => {
      node.aboutToDie();
    });
    this.baseAboutToDie();
    this._internalEventsEmit("dispose" /* Dispose */);
    this._internalEventsClear("dispose" /* Dispose */);
  }
  finalizeDeath() {
    this.getChildren().forEach((node) => {
      node.finalizeDeath();
    });
    this.root.identifierCache.notifyDied(this);
    const snapshot = this.snapshot;
    this._snapshotUponDeath = snapshot;
    this._internalEventsClearAll();
    this.baseFinalizeDeath();
  }
  onSnapshot(onChange) {
    this._addSnapshotReaction();
    return this._internalEventsRegister("snapshot" /* Snapshot */, onChange);
  }
  emitSnapshot(snapshot) {
    this._internalEventsEmit("snapshot" /* Snapshot */, snapshot);
  }
  onPatch(handler) {
    return this._internalEventsRegister("patch" /* Patch */, handler);
  }
  emitPatch(basePatch, source) {
    if (this._internalEventsHasSubscribers("patch" /* Patch */)) {
      const path = source.path.substr(this.path.length) + (basePatch.path ? "/" + basePatch.path : "");
      const localizedPatch = extend({}, basePatch, {
        path
      });
      const [patch, reversePatch] = splitPatch(localizedPatch);
      this._internalEventsEmit("patch" /* Patch */, patch, reversePatch);
    }
    if (this.parent) this.parent.emitPatch(basePatch, source);
  }
  hasDisposer(disposer) {
    return this._internalEventsHas("dispose" /* Dispose */, disposer);
  }
  addDisposer(disposer) {
    if (!this.hasDisposer(disposer)) {
      this._internalEventsRegister("dispose" /* Dispose */, disposer, true);
      return;
    }
    throw new MstError(
      "cannot add a disposer when it is already registered for execution"
    );
  }
  removeDisposer(disposer) {
    if (!this._internalEventsHas("dispose" /* Dispose */, disposer)) {
      throw new MstError(
        "cannot remove a disposer which was never registered for execution"
      );
    }
    this._internalEventsUnregister("dispose" /* Dispose */, disposer);
  }
  removeMiddleware(middleware) {
    if (this.middlewares) {
      const index = this.middlewares.indexOf(middleware);
      if (index >= 0) {
        this.middlewares.splice(index, 1);
      }
    }
  }
  addMiddleWare(handler, includeHooks = true) {
    const middleware = { handler, includeHooks };
    if (!this.middlewares) this.middlewares = [middleware];
    else this.middlewares.push(middleware);
    return () => {
      this.removeMiddleware(middleware);
    };
  }
  applyPatchLocally(subpath, patch) {
    this.assertWritable({
      subpath
    });
    this.createObservableInstanceIfNeeded();
    this.type.applyPatchLocally(this, subpath, patch);
  }
  _addSnapshotReaction() {
    if (!this._hasSnapshotReaction) {
      const snapshotDisposer = reaction(
        () => this.snapshot,
        (snapshot) => this.emitSnapshot(snapshot),
        snapshotReactionOptions
      );
      this.addDisposer(snapshotDisposer);
      this._hasSnapshotReaction = true;
    }
  }
  // #region internal event handling
  _internalEvents;
  // we proxy the methods to avoid creating an EventHandlers instance when it is not needed
  _internalEventsHasSubscribers(event) {
    return !!this._internalEvents && this._internalEvents.hasSubscribers(event);
  }
  _internalEventsRegister(event, eventHandler, atTheBeginning = false) {
    if (!this._internalEvents) {
      this._internalEvents = new EventHandlers();
    }
    return this._internalEvents.register(event, eventHandler, atTheBeginning);
  }
  _internalEventsHas(event, eventHandler) {
    return !!this._internalEvents && this._internalEvents.has(event, eventHandler);
  }
  _internalEventsUnregister(event, eventHandler) {
    if (this._internalEvents) {
      this._internalEvents.unregister(event, eventHandler);
    }
  }
  _internalEventsEmit(event, ...args) {
    if (this._internalEvents) {
      this._internalEvents.emit(event, ...args);
    }
  }
  _internalEventsClear(event) {
    if (this._internalEvents) {
      this._internalEvents.clear(event);
    }
  }
  _internalEventsClearAll() {
    if (this._internalEvents) {
      this._internalEvents.clearAll();
    }
  }
  // #endregion
};
ObjectNode.prototype.createObservableInstance = action2(
  ObjectNode.prototype.createObservableInstance
);
ObjectNode.prototype.detach = action2(ObjectNode.prototype.detach);
ObjectNode.prototype.die = action2(ObjectNode.prototype.die);

// src/core/type/type.ts
import { action as action3 } from "mobx";
var cannotDetermineSubtype = "cannotDetermine";
var $type = Symbol("$type");
var BaseType = class {
  [$type];
  // these are just to make inner types avaialable to inherited classes
  C;
  S;
  T;
  N;
  isType = true;
  name;
  constructor(name) {
    this.name = name;
  }
  create(snapshot, environment) {
    typecheckInternal(this, snapshot);
    return this.instantiate(null, "", environment, snapshot).value;
  }
  getSnapshot(node, applyPostProcess) {
    throw new MstError("unimplemented method");
  }
  isAssignableFrom(type) {
    return type === this;
  }
  validate(value, context) {
    const node = getStateTreeNodeSafe(value);
    if (node) {
      const valueType = getType(value);
      return this.isAssignableFrom(valueType) ? typeCheckSuccess() : typeCheckFailure(context, value);
    }
    return this.isValidSnapshot(value, context);
  }
  is(thing) {
    return this.validate(thing, [{ path: "", type: this }]).length === 0;
  }
  get Type() {
    throw new MstError(
      "Factory.Type should not be actually called. It is just a Type signature that can be used at compile time with Typescript, by using `typeof type.Type`"
    );
  }
  get TypeWithoutSTN() {
    throw new MstError(
      "Factory.TypeWithoutSTN should not be actually called. It is just a Type signature that can be used at compile time with Typescript, by using `typeof type.TypeWithoutSTN`"
    );
  }
  get SnapshotType() {
    throw new MstError(
      "Factory.SnapshotType should not be actually called. It is just a Type signature that can be used at compile time with Typescript, by using `typeof type.SnapshotType`"
    );
  }
  get CreationType() {
    throw new MstError(
      "Factory.CreationType should not be actually called. It is just a Type signature that can be used at compile time with Typescript, by using `typeof type.CreationType`"
    );
  }
};
BaseType.prototype.create = action3(BaseType.prototype.create);
var ComplexType2 = class extends BaseType {
  identifierAttribute;
  constructor(name) {
    super(name);
  }
  create(snapshot = this.getDefaultSnapshot(), environment) {
    return super.create(snapshot, environment);
  }
  getValue(node) {
    node.createObservableInstanceIfNeeded();
    return node.storedValue;
  }
  isMatchingSnapshotId(current, snapshot) {
    return !current.identifierAttribute || current.identifier === normalizeIdentifier(snapshot[current.identifierAttribute]);
  }
  tryToReconcileNode(current, newValue) {
    if (current.isDetaching) return false;
    if (current.snapshot === newValue) {
      return true;
    }
    if (isStateTreeNode(newValue) && getStateTreeNode(newValue) === current) {
      return true;
    }
    if (current.type === this && isMutable(newValue) && !isStateTreeNode(newValue) && this.isMatchingSnapshotId(current, newValue)) {
      current.applySnapshot(newValue);
      return true;
    }
    return false;
  }
  reconcile(current, newValue, parent, subpath) {
    const nodeReconciled = this.tryToReconcileNode(current, newValue);
    if (nodeReconciled) {
      current.setParent(parent, subpath);
      return current;
    }
    current.die();
    if (isStateTreeNode(newValue) && this.isAssignableFrom(getType(newValue))) {
      const newNode = getStateTreeNode(newValue);
      newNode.setParent(parent, subpath);
      return newNode;
    }
    return this.instantiate(parent, subpath, void 0, newValue);
  }
  getSubTypes() {
    return null;
  }
};
ComplexType2.prototype.create = action3(ComplexType2.prototype.create);
var SimpleType2 = class extends BaseType {
  createNewInstance(snapshot) {
    return snapshot;
  }
  getValue(node) {
    return node.storedValue;
  }
  getSnapshot(node) {
    return node.storedValue;
  }
  reconcile(current, newValue, parent, subpath) {
    if (!current.isDetaching && current.type === this && current.storedValue === newValue) {
      return current;
    }
    const res = this.instantiate(parent, subpath, void 0, newValue);
    current.die();
    return res;
  }
  getSubTypes() {
    return null;
  }
};
function isType(value) {
  return typeof value === "object" && value && value.isType === true;
}
function assertIsType(type, argNumber) {
  assertArg(type, isType, "@jbrowse/@jbrowse/mobx-state-tree type", argNumber);
}

// src/middlewares/create-action-tracking-middleware.ts
var runningActions = /* @__PURE__ */ new Map();
function createActionTrackingMiddleware(hooks) {
  return function actionTrackingMiddleware(call, next, abort) {
    switch (call.type) {
      case "action": {
        if (!hooks.filter || hooks.filter(call) === true) {
          const context = hooks.onStart(call);
          hooks.onResume(call, context);
          runningActions.set(call.id, {
            call,
            context,
            async: false
          });
          try {
            const res = next(call);
            hooks.onSuspend(call, context);
            if (runningActions.get(call.id).async === false) {
              runningActions.delete(call.id);
              hooks.onSuccess(call, context, res);
            }
            return res;
          } catch (e) {
            runningActions.delete(call.id);
            hooks.onFail(call, context, e);
            throw e;
          }
        } else {
          return next(call);
        }
      }
      case "flow_spawn": {
        const root = runningActions.get(call.rootId);
        root.async = true;
        return next(call);
      }
      case "flow_resume":
      case "flow_resume_error": {
        const root = runningActions.get(call.rootId);
        hooks.onResume(call, root.context);
        try {
          return next(call);
        } finally {
          hooks.onSuspend(call, root.context);
        }
      }
      case "flow_throw": {
        const root = runningActions.get(call.rootId);
        runningActions.delete(call.rootId);
        hooks.onFail(call, root.context, call.args[0]);
        return next(call);
      }
      case "flow_return": {
        const root = runningActions.get(call.rootId);
        runningActions.delete(call.rootId);
        hooks.onSuccess(call, root.context, call.args[0]);
        return next(call);
      }
    }
  };
}

// src/middlewares/createActionTrackingMiddleware2.ts
var RunningAction = class {
  constructor(hooks, call) {
    this.hooks = hooks;
    this.call = call;
    if (hooks) {
      hooks.onStart(call);
    }
  }
  flowsPending = 0;
  running = true;
  finish(error) {
    if (this.running) {
      this.running = false;
      if (this.hooks) {
        this.hooks.onFinish(this.call, error);
      }
    }
  }
  incFlowsPending() {
    this.flowsPending++;
  }
  decFlowsPending() {
    this.flowsPending--;
  }
  get hasFlowsPending() {
    return this.flowsPending > 0;
  }
};
function createActionTrackingMiddleware2(middlewareHooks) {
  const runningActions2 = /* @__PURE__ */ new Map();
  return function actionTrackingMiddleware(call, next) {
    const parentRunningAction = call.parentActionEvent ? runningActions2.get(call.parentActionEvent.id) : void 0;
    if (call.type === "action") {
      const newCall = {
        ...call,
        // make a shallow copy of the parent action env
        env: parentRunningAction && parentRunningAction.call.env,
        parentCall: parentRunningAction && parentRunningAction.call
      };
      const passesFilter = !middlewareHooks.filter || middlewareHooks.filter(newCall);
      const hooks = passesFilter ? middlewareHooks : void 0;
      const runningAction = new RunningAction(hooks, newCall);
      runningActions2.set(call.id, runningAction);
      let res;
      try {
        res = next(call);
      } catch (e) {
        runningActions2.delete(call.id);
        runningAction.finish(e);
        throw e;
      }
      if (!runningAction.hasFlowsPending) {
        runningActions2.delete(call.id);
        runningAction.finish();
      }
      return res;
    } else {
      if (!parentRunningAction) {
        return next(call);
      }
      switch (call.type) {
        case "flow_spawn": {
          parentRunningAction.incFlowsPending();
          return next(call);
        }
        case "flow_resume":
        case "flow_resume_error": {
          return next(call);
        }
        case "flow_throw": {
          const error = call.args[0];
          try {
            return next(call);
          } finally {
            parentRunningAction.decFlowsPending();
            if (!parentRunningAction.hasFlowsPending) {
              runningActions2.delete(call.parentActionEvent.id);
              parentRunningAction.finish(error);
            }
          }
        }
        case "flow_return": {
          try {
            return next(call);
          } finally {
            parentRunningAction.decFlowsPending();
            if (!parentRunningAction.hasFlowsPending) {
              runningActions2.delete(call.parentActionEvent.id);
              parentRunningAction.finish();
            }
          }
        }
      }
    }
  };
}

// src/middlewares/on-action.ts
import { runInAction } from "mobx";
function serializeArgument(node, actionName, index, arg) {
  if (arg instanceof Date) return { $MST_DATE: arg.getTime() };
  if (isPrimitive(arg)) return arg;
  if (isStateTreeNode(arg))
    return serializeTheUnserializable(`[MSTNode: ${getType(arg).name}]`);
  if (typeof arg === "function") return serializeTheUnserializable(`[function]`);
  if (typeof arg === "object" && !isPlainObject(arg) && !isArray(arg))
    return serializeTheUnserializable(
      `[object ${arg && arg.constructor && arg.constructor.name || "Complex Object"}]`
    );
  try {
    JSON.stringify(arg);
    return arg;
  } catch (e) {
    return serializeTheUnserializable("" + e);
  }
}
function deserializeArgument(adm, value) {
  if (value && typeof value === "object" && "$MST_DATE" in value)
    return new Date(value["$MST_DATE"]);
  return value;
}
function serializeTheUnserializable(baseType) {
  return {
    $MST_UNSERIALIZABLE: true,
    type: baseType
  };
}
function applyAction(target, actions) {
  assertIsStateTreeNode(target, 1);
  assertArg(actions, (a) => typeof a === "object", "object or array", 2);
  runInAction(() => {
    asArray(actions).forEach((action8) => baseApplyAction(target, action8));
  });
}
function baseApplyAction(target, action8) {
  const resolvedTarget = tryResolve(target, action8.path || "");
  if (!resolvedTarget)
    throw new MstError(`Invalid action path: ${action8.path || ""}`);
  const node = getStateTreeNode(resolvedTarget);
  if (action8.name === "@APPLY_PATCHES") {
    return applyPatch.call(null, resolvedTarget, action8.args[0]);
  }
  if (action8.name === "@APPLY_SNAPSHOT") {
    return applySnapshot.call(null, resolvedTarget, action8.args[0]);
  }
  if (!(typeof resolvedTarget[action8.name] === "function"))
    throw new MstError(
      `Action '${action8.name}' does not exist in '${node.path}'`
    );
  return resolvedTarget[action8.name].apply(
    resolvedTarget,
    action8.args ? action8.args.map((v) => deserializeArgument(node, v)) : []
  );
}
function recordActions(subject, filter) {
  assertIsStateTreeNode(subject, 1);
  const actions = [];
  const listener = (call) => {
    const recordThis = filter ? filter(call, getRunningActionContext()) : true;
    if (recordThis) {
      actions.push(call);
    }
  };
  let disposer;
  const recorder = {
    actions,
    get recording() {
      return !!disposer;
    },
    stop() {
      if (disposer) {
        disposer();
        disposer = void 0;
      }
    },
    resume() {
      if (disposer) return;
      disposer = onAction(subject, listener);
    },
    replay(target) {
      applyAction(target, actions);
    }
  };
  recorder.resume();
  return recorder;
}
function onAction(target, listener, attachAfter = false) {
  assertIsStateTreeNode(target, 1);
  if (devMode()) {
    if (!isRoot(target))
      warnError(
        "Warning: Attaching onAction listeners to non root nodes is dangerous: No events will be emitted for actions initiated higher up in the tree."
      );
    if (!isProtected(target))
      warnError(
        "Warning: Attaching onAction listeners to non protected nodes is dangerous: No events will be emitted for direct modifications without action."
      );
  }
  return addMiddleware(target, function handler(rawCall, next) {
    if (rawCall.type === "action" && rawCall.id === rawCall.rootId) {
      const sourceNode = getStateTreeNode(rawCall.context);
      const info = {
        name: rawCall.name,
        path: getRelativePathBetweenNodes(getStateTreeNode(target), sourceNode),
        args: rawCall.args.map(
          (arg, index) => serializeArgument(sourceNode, rawCall.name, index, arg)
        )
      };
      if (attachAfter) {
        const res = next(rawCall);
        listener(info);
        return res;
      } else {
        listener(info);
        return next(rawCall);
      }
    } else {
      return next(rawCall);
    }
  });
}

// src/core/action.ts
import { action as mobxAction } from "mobx";
var nextActionId = 1;
var currentActionContext;
function getCurrentActionContext() {
  return currentActionContext;
}
function getNextActionId() {
  return nextActionId++;
}
function runWithActionContext(context, fn) {
  const node = getStateTreeNode(context.context);
  if (context.type === "action") {
    node.assertAlive({
      actionContext: context
    });
  }
  const baseIsRunningAction = node._isRunningAction;
  node._isRunningAction = true;
  const previousContext = currentActionContext;
  currentActionContext = context;
  try {
    return runMiddleWares(node, context, fn);
  } finally {
    currentActionContext = previousContext;
    node._isRunningAction = baseIsRunningAction;
  }
}
function getParentActionContext(parentContext) {
  if (!parentContext) return void 0;
  if (parentContext.type === "action") return parentContext;
  return parentContext.parentActionEvent;
}
function createActionInvoker(target, name, fn) {
  const res = function() {
    const id = getNextActionId();
    const parentContext = currentActionContext;
    const parentActionContext = getParentActionContext(parentContext);
    return runWithActionContext(
      {
        type: "action",
        name,
        id,
        args: argsToArray(arguments),
        context: target,
        tree: getRoot(target),
        rootId: parentContext ? parentContext.rootId : id,
        parentId: parentContext ? parentContext.id : 0,
        allParentIds: parentContext ? [...parentContext.allParentIds, parentContext.id] : [],
        parentEvent: parentContext,
        parentActionEvent: parentActionContext
      },
      fn
    );
  };
  res._isMSTAction = true;
  res._isFlowAction = fn._isFlowAction;
  return res;
}
function addMiddleware(target, handler, includeHooks = true) {
  const node = getStateTreeNode(target);
  if (devMode()) {
    if (!node.isProtectionEnabled) {
      warnError(
        "It is recommended to protect the state tree before attaching action middleware, as otherwise it cannot be guaranteed that all changes are passed through middleware. See `protect`"
      );
    }
  }
  return node.addMiddleWare(handler, includeHooks);
}
function decorate(handler, fn, includeHooks = true) {
  const middleware = { handler, includeHooks };
  fn.$mst_middleware = fn.$mst_middleware || [];
  fn.$mst_middleware.push(middleware);
  return fn;
}
var CollectedMiddlewares = class {
  arrayIndex = 0;
  inArrayIndex = 0;
  middlewares = [];
  constructor(node, fn) {
    if (fn.$mst_middleware) {
      this.middlewares.push(fn.$mst_middleware);
    }
    let n = node;
    while (n) {
      if (n.middlewares) this.middlewares.push(n.middlewares);
      n = n.parent;
    }
  }
  get isEmpty() {
    return this.middlewares.length <= 0;
  }
  getNextMiddleware() {
    const array2 = this.middlewares[this.arrayIndex];
    if (!array2) return void 0;
    const item = array2[this.inArrayIndex++];
    if (!item) {
      this.arrayIndex++;
      this.inArrayIndex = 0;
      return this.getNextMiddleware();
    }
    return item;
  }
};
function runMiddleWares(node, baseCall, originalFn) {
  const middlewares = new CollectedMiddlewares(node, originalFn);
  if (middlewares.isEmpty)
    return mobxAction(originalFn).apply(null, baseCall.args);
  let result = null;
  function runNextMiddleware(call) {
    const middleware = middlewares.getNextMiddleware();
    const handler = middleware && middleware.handler;
    if (!handler) {
      return mobxAction(originalFn).apply(null, call.args);
    }
    if (!middleware.includeHooks && Hook[call.name]) {
      return runNextMiddleware(call);
    }
    let nextInvoked = false;
    function next(call2, callback) {
      nextInvoked = true;
      result = runNextMiddleware(call2);
      if (callback) {
        result = callback(result);
      }
    }
    let abortInvoked = false;
    function abort(value) {
      abortInvoked = true;
      result = value;
    }
    handler(call, next, abort);
    if (devMode()) {
      if (!nextInvoked && !abortInvoked) {
        const node2 = getStateTreeNode(call.tree);
        throw new MstError(
          `Neither the next() nor the abort() callback within the middleware ${handler.name} for the action: "${call.name}" on the node: ${node2.type.name} was invoked.`
        );
      } else if (nextInvoked && abortInvoked) {
        const node2 = getStateTreeNode(call.tree);
        throw new MstError(
          `The next() and abort() callback within the middleware ${handler.name} for the action: "${call.name}" on the node: ${node2.type.name} were invoked.`
        );
      }
    }
    return result;
  }
  return runNextMiddleware(baseCall);
}

// src/core/actionContext.ts
function getRunningActionContext() {
  let current = getCurrentActionContext();
  while (current && current.type !== "action") {
    current = current.parentActionEvent;
  }
  return current;
}
function _isActionContextThisOrChildOf(actionContext, sameOrParent, includeSame) {
  const parentId = typeof sameOrParent === "number" ? sameOrParent : sameOrParent.id;
  let current = includeSame ? actionContext : actionContext.parentActionEvent;
  while (current) {
    if (current.id === parentId) {
      return true;
    }
    current = current.parentActionEvent;
  }
  return false;
}
function isActionContextChildOf(actionContext, parent) {
  return _isActionContextThisOrChildOf(actionContext, parent, false);
}
function isActionContextThisOrChildOf(actionContext, parentOrThis) {
  return _isActionContextThisOrChildOf(actionContext, parentOrThis, true);
}

// src/core/type/type-checker.ts
function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return `<Unserializable: ${e}>`;
  }
}
function prettyPrintValue(value) {
  return typeof value === "function" ? `<function${value.name ? " " + value.name : ""}>` : isStateTreeNode(value) ? `<${value}>` : `\`${safeStringify(value)}\``;
}
function shortenPrintValue(valueInString) {
  return valueInString.length < 280 ? valueInString : `${valueInString.substring(0, 272)}......${valueInString.substring(valueInString.length - 8)}`;
}
function toErrorString(error) {
  const { value } = error;
  const type = error.context[error.context.length - 1].type;
  const fullPath = error.context.map(({ path }) => path).filter((path) => path.length > 0).join("/");
  const pathPrefix = fullPath.length > 0 ? `at path "/${fullPath}" ` : ``;
  const currentTypename = isStateTreeNode(value) ? `value of type ${getStateTreeNode(value).type.name}:` : isPrimitive(value) ? "value" : "snapshot";
  const isSnapshotCompatible = type && isStateTreeNode(value) && type.is(getStateTreeNode(value).snapshot);
  return `${pathPrefix}${currentTypename} ${prettyPrintValue(value)} is not assignable ${type ? `to type: \`${type.name}\`` : ``}` + (error.message ? ` (${error.message})` : "") + (type ? isPrimitiveType(type) || isPrimitive(value) ? `.` : `, expected an instance of \`${type.name}\` or a snapshot like \`${type.describe()}\` instead.` + (isSnapshotCompatible ? " (Note that a snapshot of the provided value is compatible with the targeted type)" : "") : `.`);
}
function getContextForPath(context, path, type) {
  return context.concat([{ path, type }]);
}
function typeCheckSuccess() {
  return EMPTY_ARRAY;
}
function typeCheckFailure(context, value, message) {
  return [{ context, value, message }];
}
function flattenTypeErrors(errors) {
  return errors.reduce((a, i) => a.concat(i), []);
}
function typecheckInternal(type, value) {
  if (isTypeCheckingEnabled()) {
    typecheck(type, value);
  }
}
function typecheck(type, value) {
  const errors = type.validate(value, [{ path: "", type }]);
  if (errors.length > 0) {
    throw new MstError(validationErrorsToString(type, value, errors));
  }
}
function validationErrorsToString(type, value, errors) {
  if (errors.length === 0) {
    return void 0;
  }
  return `Error while converting ${shortenPrintValue(prettyPrintValue(value))} to \`${type.name}\`:

    ` + errors.map(toErrorString).join("\n    ");
}

// src/core/node/identifier-cache.ts
import { values, observable, entries } from "mobx";
var identifierCacheId = 0;
var IdentifierCache = class _IdentifierCache {
  cacheId = identifierCacheId++;
  // n.b. in cache all identifiers are normalized to strings
  cache = observable.map();
  // last time the cache (array) for a given time changed
  // n.b. it is not really the time, but just an integer that gets increased after each modification to the array
  lastCacheModificationPerId = observable.map();
  constructor() {
  }
  updateLastCacheModificationPerId(identifier2) {
    const lcm = this.lastCacheModificationPerId.get(identifier2);
    this.lastCacheModificationPerId.set(
      identifier2,
      lcm === void 0 ? 1 : lcm + 1
    );
  }
  getLastCacheModificationPerId(identifier2) {
    const modificationId = this.lastCacheModificationPerId.get(identifier2) || 0;
    return `${this.cacheId}-${modificationId}`;
  }
  addNodeToCache(node, lastCacheUpdate = true) {
    if (node.identifierAttribute) {
      const identifier2 = node.identifier;
      if (!this.cache.has(identifier2)) {
        this.cache.set(
          identifier2,
          observable.array([], mobxShallow)
        );
      }
      const set2 = this.cache.get(identifier2);
      if (set2.indexOf(node) !== -1) throw new MstError(`Already registered`);
      set2.push(node);
      if (lastCacheUpdate) {
        this.updateLastCacheModificationPerId(identifier2);
      }
    }
  }
  mergeCache(node) {
    values(node.identifierCache.cache).forEach(
      (nodes) => nodes.forEach((child) => {
        this.addNodeToCache(child);
      })
    );
  }
  notifyDied(node) {
    if (node.identifierAttribute) {
      const id = node.identifier;
      const set2 = this.cache.get(id);
      if (set2) {
        set2.remove(node);
        if (!set2.length) {
          this.cache.delete(id);
        }
        this.updateLastCacheModificationPerId(node.identifier);
      }
    }
  }
  splitCache(splitNode) {
    const newCache = new _IdentifierCache();
    const basePath = splitNode.path + "/";
    entries(this.cache).forEach(([id, nodes]) => {
      let modified = false;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (node === splitNode || node.path.indexOf(basePath) === 0) {
          newCache.addNodeToCache(node, false);
          nodes.splice(i, 1);
          if (!nodes.length) {
            this.cache.delete(id);
          }
          modified = true;
        }
      }
      if (modified) {
        this.updateLastCacheModificationPerId(id);
      }
    });
    return newCache;
  }
  has(type, identifier2) {
    const set2 = this.cache.get(identifier2);
    if (!set2) return false;
    return set2.some((candidate) => type.isAssignableFrom(candidate.type));
  }
  resolve(type, identifier2) {
    const set2 = this.cache.get(identifier2);
    if (!set2) return null;
    const matches = set2.filter(
      (candidate) => type.isAssignableFrom(candidate.type)
    );
    switch (matches.length) {
      case 0:
        return null;
      case 1:
        return matches[0];
      default:
        throw new MstError(
          `Cannot resolve a reference to type '${type.name}' with id: '${identifier2}' unambigously, there are multiple candidates: ${matches.map((n) => n.path).join(", ")}`
        );
    }
  }
};

// src/core/node/create-node.ts
function createObjectNode(type, parent, subpath, environment, initialValue) {
  const existingNode = getStateTreeNodeSafe(initialValue);
  if (existingNode) {
    if (existingNode.parent) {
      throw new MstError(
        `Cannot add an object to a state tree if it is already part of the same or another state tree. Tried to assign an object to '${parent ? parent.path : ""}/${subpath}', but it lives already at '${existingNode.path}'`
      );
    }
    if (parent) {
      existingNode.setParent(parent, subpath);
    }
    return existingNode;
  }
  return new ObjectNode(type, parent, subpath, environment, initialValue);
}
function createScalarNode(type, parent, subpath, environment, initialValue) {
  return new ScalarNode(type, parent, subpath, environment, initialValue);
}
function isNode(value) {
  return value instanceof ScalarNode || value instanceof ObjectNode;
}

// src/core/node/node-utils.ts
function isStateTreeNode(value) {
  return !!(value && value.$treenode);
}
function assertIsStateTreeNode(value, argNumber) {
  assertArg(value, isStateTreeNode, "@jbrowse/@jbrowse/mobx-state-tree node", argNumber);
}
function getStateTreeNode(value) {
  if (!isStateTreeNode(value)) {
    throw new MstError(`Value ${value} is no MST Node`);
  }
  return value.$treenode;
}
function getStateTreeNodeSafe(value) {
  return value && value.$treenode || null;
}
function toJSON() {
  return getStateTreeNode(this).snapshot;
}
var doubleDot = (_) => "..";
function getRelativePathBetweenNodes(base, target) {
  if (base.root !== target.root) {
    throw new MstError(
      `Cannot calculate relative path: objects '${base}' and '${target}' are not part of the same object tree`
    );
  }
  const baseParts = splitJsonPath(base.path);
  const targetParts = splitJsonPath(target.path);
  let common = 0;
  for (; common < baseParts.length; common++) {
    if (baseParts[common] !== targetParts[common]) break;
  }
  return baseParts.slice(common).map(doubleDot).join("/") + joinJsonPath(targetParts.slice(common));
}
function resolveNodeByPath(base, path, failIfResolveFails = true) {
  return resolveNodeByPathParts(base, splitJsonPath(path), failIfResolveFails);
}
function resolveNodeByPathParts(base, pathParts, failIfResolveFails = true) {
  let current = base;
  try {
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (part === "..") {
        current = current.parent;
        if (current) continue;
      } else if (part === ".") {
        continue;
      } else if (current) {
        if (current instanceof ScalarNode) {
          const value = current.value;
          if (isStateTreeNode(value)) {
            current = getStateTreeNode(value);
          }
        }
        if (current instanceof ObjectNode) {
          const subType = current.getChildType(part);
          if (subType) {
            current = current.getChildNode(part);
            if (current) continue;
          }
        }
      }
      throw new MstError(
        `Could not resolve '${part}' in path '${joinJsonPath(pathParts.slice(0, i)) || "/"}' while resolving '${joinJsonPath(pathParts)}'`
      );
    }
  } catch (e) {
    if (!failIfResolveFails) {
      return void 0;
    }
    throw e;
  }
  return current;
}
function convertChildNodesToArray(childNodes) {
  if (!childNodes) return EMPTY_ARRAY;
  const keys = Object.keys(childNodes);
  if (!keys.length) return EMPTY_ARRAY;
  const result = new Array(keys.length);
  keys.forEach((key, index) => {
    result[index] = childNodes[key];
  });
  return result;
}

// src/core/process.ts
var DEPRECATION_MESSAGE = "See https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree/issues/399 for more information. Note that the middleware event types starting with `process` now start with `flow`.";
function process2(asyncAction) {
  deprecated(
    "process",
    "`process()` has been renamed to `flow()`. " + DEPRECATION_MESSAGE
  );
  return flow(asyncAction);
}

// src/utils.ts
import {
  isObservableArray,
  isObservableObject,
  _getGlobalState,
  defineProperty as mobxDefineProperty
} from "mobx";
var plainObjectString = Object.toString();
var EMPTY_ARRAY = Object.freeze([]);
var EMPTY_OBJECT = Object.freeze({});
var mobxShallow = _getGlobalState().useProxies ? { deep: false } : { deep: false, proxy: false };
Object.freeze(mobxShallow);
var MstError = class extends Error {
  constructor(message = "Illegal state") {
    super(`[@jbrowse/@jbrowse/mobx-state-tree] ${message}`);
  }
};
function identity(_) {
  return _;
}
var isInteger = Number.isInteger;
function isFloat(val) {
  return Number(val) === val && val % 1 !== 0;
}
function isFinite(val) {
  return Number.isFinite(val);
}
function isArray(val) {
  return Array.isArray(val) || isObservableArray(val);
}
function asArray(val) {
  if (!val) return EMPTY_ARRAY;
  if (isArray(val)) return val;
  return [val];
}
function extend(a, ...b) {
  for (let i = 0; i < b.length; i++) {
    const current = b[i];
    for (let key in current) a[key] = current[key];
  }
  return a;
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  if (proto == null) return true;
  return proto.constructor?.toString() === plainObjectString;
}
function isMutable(value) {
  return value !== null && typeof value === "object" && !(value instanceof Date) && !(value instanceof RegExp);
}
function isPrimitive(value, includeDate = true) {
  return value === null || value === void 0 || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || includeDate && value instanceof Date;
}
function freeze(value) {
  if (!devMode()) return value;
  return isPrimitive(value) || isObservableArray(value) ? value : Object.freeze(value);
}
function deepFreeze(value) {
  if (!devMode()) return value;
  freeze(value);
  if (isPlainObject(value)) {
    Object.keys(value).forEach((propKey) => {
      if (!isPrimitive(value[propKey]) && !Object.isFrozen(value[propKey])) {
        deepFreeze(value[propKey]);
      }
    });
  }
  return value;
}
function isSerializable(value) {
  return typeof value !== "function";
}
function defineProperty(object, key, descriptor) {
  isObservableObject(object) ? mobxDefineProperty(object, key, descriptor) : Object.defineProperty(object, key, descriptor);
}
function addHiddenFinalProp(object, propName, value) {
  defineProperty(object, propName, {
    enumerable: false,
    writable: false,
    configurable: true,
    value
  });
}
function addHiddenWritableProp(object, propName, value) {
  defineProperty(object, propName, {
    enumerable: false,
    writable: true,
    configurable: true,
    value
  });
}
var EventHandler = class {
  handlers = [];
  get hasSubscribers() {
    return this.handlers.length > 0;
  }
  register(fn, atTheBeginning = false) {
    if (atTheBeginning) {
      this.handlers.unshift(fn);
    } else {
      this.handlers.push(fn);
    }
    return () => {
      this.unregister(fn);
    };
  }
  has(fn) {
    return this.handlers.indexOf(fn) >= 0;
  }
  unregister(fn) {
    const index = this.handlers.indexOf(fn);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }
  clear() {
    this.handlers.length = 0;
  }
  emit(...args) {
    const handlers = this.handlers.slice();
    handlers.forEach((f) => f(...args));
  }
};
var EventHandlers = class {
  eventHandlers;
  hasSubscribers(event) {
    const handler = this.eventHandlers && this.eventHandlers[event];
    return !!handler && handler.hasSubscribers;
  }
  register(event, fn, atTheBeginning = false) {
    if (!this.eventHandlers) {
      this.eventHandlers = {};
    }
    let handler = this.eventHandlers[event];
    if (!handler) {
      handler = this.eventHandlers[event] = new EventHandler();
    }
    return handler.register(fn, atTheBeginning);
  }
  has(event, fn) {
    const handler = this.eventHandlers && this.eventHandlers[event];
    return !!handler && handler.has(fn);
  }
  unregister(event, fn) {
    const handler = this.eventHandlers && this.eventHandlers[event];
    if (handler) {
      handler.unregister(fn);
    }
  }
  clear(event) {
    if (this.eventHandlers) {
      delete this.eventHandlers[event];
    }
  }
  clearAll() {
    this.eventHandlers = void 0;
  }
  emit(event, ...args) {
    const handler = this.eventHandlers && this.eventHandlers[event];
    if (handler) {
      ;
      handler.emit(...args);
    }
  }
};
function argsToArray(args) {
  const res = new Array(args.length);
  for (let i = 0; i < args.length; i++) res[i] = args[i];
  return res;
}
function stringStartsWith(str, beginning) {
  return str.indexOf(beginning) === 0;
}
var deprecated = function(id, message) {
  if (!devMode()) return;
  if (deprecated.ids && !deprecated.ids.hasOwnProperty(id)) {
    warnError("Deprecation warning: " + message);
  }
  if (deprecated.ids) deprecated.ids[id] = true;
};
deprecated.ids = {};
function warnError(msg) {
  console.warn(new Error(`[@jbrowse/@jbrowse/mobx-state-tree] ${msg}`));
}
function isTypeCheckingEnabled() {
  return devMode() || typeof process !== "undefined" && process.env && process.env.ENABLE_TYPE_CHECK === "true";
}
function devMode() {
  return process.env.NODE_ENV !== "production";
}
function assertArg(value, fn, typeName, argNumber) {
  if (devMode()) {
    if (!fn(value)) {
      throw new MstError(
        `expected ${typeName} as argument ${asArray(argNumber).join(" or ")}, got ${value} instead`
      );
    }
  }
}
function assertIsFunction(value, argNumber) {
  assertArg(value, (fn) => typeof fn === "function", "function", argNumber);
}
function assertIsNumber(value, argNumber, min, max) {
  assertArg(value, (n) => typeof n === "number", "number", argNumber);
  if (min !== void 0) {
    assertArg(value, (n) => n >= min, `number greater than ${min}`, argNumber);
  }
  if (max !== void 0) {
    assertArg(value, (n) => n <= max, `number lesser than ${max}`, argNumber);
  }
}
function assertIsString(value, argNumber, canBeEmpty = true) {
  assertArg(value, (s) => typeof s === "string", "string", argNumber);
  if (!canBeEmpty) {
    assertArg(value, (s) => s !== "", "not empty string", argNumber);
  }
}
function setImmediateWithFallback(fn) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
  } else if (typeof setImmediate === "function") {
    setImmediate(fn);
  } else {
    setTimeout(fn, 1);
  }
}

// src/core/flow.ts
function flow(generator) {
  return createFlowSpawner(generator.name, generator);
}
function castFlowReturn(val) {
  return val;
}
function toGeneratorFunction(p) {
  return function* (...args) {
    return yield p(...args);
  };
}
function* toGenerator(p) {
  return yield p;
}
function createFlowSpawner(name, generator) {
  const spawner = function flowSpawner() {
    const runId = getNextActionId();
    const parentContext = getCurrentActionContext();
    if (!parentContext) {
      throw new MstError("a mst flow must always have a parent context");
    }
    const parentActionContext = getParentActionContext(parentContext);
    if (!parentActionContext) {
      throw new MstError("a mst flow must always have a parent action context");
    }
    const contextBase = {
      name,
      id: runId,
      tree: parentContext.tree,
      context: parentContext.context,
      parentId: parentContext.id,
      allParentIds: [...parentContext.allParentIds, parentContext.id],
      rootId: parentContext.rootId,
      parentEvent: parentContext,
      parentActionEvent: parentActionContext
    };
    const args = arguments;
    function wrap(fn, type, arg) {
      fn.$mst_middleware = spawner.$mst_middleware;
      return runWithActionContext(
        {
          ...contextBase,
          type,
          args: [arg]
        },
        fn
      );
    }
    return new Promise(function(resolve, reject) {
      let gen;
      const init = function asyncActionInit() {
        gen = generator.apply(null, arguments);
        onFulfilled(void 0);
      };
      init.$mst_middleware = spawner.$mst_middleware;
      runWithActionContext(
        {
          ...contextBase,
          type: "flow_spawn",
          args: argsToArray(args)
        },
        init
      );
      function onFulfilled(res) {
        let ret;
        try {
          const cancelError = wrap((r) => {
            ret = gen.next(r);
          }, "flow_resume", res);
          if (cancelError instanceof Error) {
            ret = gen.throw(cancelError);
          }
        } catch (e) {
          setImmediateWithFallback(() => {
            wrap((r) => {
              reject(e);
            }, "flow_throw", e);
          });
          return;
        }
        next(ret);
        return;
      }
      function onRejected(err) {
        let ret;
        try {
          wrap((r) => {
            ret = gen.throw(r);
          }, "flow_resume_error", err);
        } catch (e) {
          setImmediateWithFallback(() => {
            wrap((r) => {
              reject(e);
            }, "flow_throw", e);
          });
          return;
        }
        next(ret);
      }
      function next(ret) {
        if (ret.done) {
          setImmediateWithFallback(() => {
            wrap((r) => {
              resolve(r);
            }, "flow_return", ret.value);
          });
          return;
        }
        if (!ret.value || typeof ret.value.then !== "function") {
          throw new MstError(
            "Only promises can be yielded to `async`, got: " + ret
          );
        }
        return ret.value.then(onFulfilled, onRejected);
      }
    });
  };
  spawner._isFlowAction = true;
  return spawner;
}

// src/core/json-patch.ts
function splitPatch(patch) {
  if (!("oldValue" in patch))
    throw new MstError(`Patches without \`oldValue\` field cannot be inversed`);
  return [stripPatch(patch), invertPatch(patch)];
}
function stripPatch(patch) {
  switch (patch.op) {
    case "add":
      return { op: "add", path: patch.path, value: patch.value };
    case "remove":
      return { op: "remove", path: patch.path };
    case "replace":
      return { op: "replace", path: patch.path, value: patch.value };
  }
}
function invertPatch(patch) {
  switch (patch.op) {
    case "add":
      return {
        op: "remove",
        path: patch.path
      };
    case "remove":
      return {
        op: "add",
        path: patch.path,
        value: patch.oldValue
      };
    case "replace":
      return {
        op: "replace",
        path: patch.path,
        value: patch.oldValue
      };
  }
}
function isNumber(x) {
  return typeof x === "number";
}
function escapeJsonPath(path) {
  if (isNumber(path) === true) {
    return "" + path;
  }
  if (path.indexOf("/") === -1 && path.indexOf("~") === -1) return path;
  return path.replace(/~/g, "~0").replace(/\//g, "~1");
}
function unescapeJsonPath(path) {
  return path.replace(/~1/g, "/").replace(/~0/g, "~");
}
function joinJsonPath(path) {
  if (path.length === 0) return "";
  const getPathStr = (p) => p.map(escapeJsonPath).join("/");
  if (path[0] === "." || path[0] === "..") {
    return getPathStr(path);
  } else {
    return "/" + getPathStr(path);
  }
}
function splitJsonPath(path) {
  const parts = path.split("/").map(unescapeJsonPath);
  const valid = path === "" || path === "." || path === ".." || stringStartsWith(path, "/") || stringStartsWith(path, "./") || stringStartsWith(path, "../");
  if (!valid) {
    throw new MstError(
      `a json path must be either rooted, empty or relative, but got '${path}'`
    );
  }
  if (parts[0] === "") {
    parts.shift();
  }
  return parts;
}

// src/types/utility-types/snapshotProcessor.ts
var $preProcessorFailed = Symbol("$preProcessorFailed");
var SnapshotProcessor = class extends BaseType {
  constructor(_subtype, _processors, name) {
    super(name || _subtype.name);
    this._subtype = _subtype;
    this._processors = _processors;
  }
  get flags() {
    return this._subtype.flags | 524288 /* SnapshotProcessor */;
  }
  describe() {
    return `snapshotProcessor(${this._subtype.describe()})`;
  }
  preProcessSnapshot(sn) {
    if (this._processors.preProcessor) {
      return this._processors.preProcessor.call(null, sn);
    }
    return sn;
  }
  preProcessSnapshotSafe(sn) {
    try {
      return this.preProcessSnapshot(sn);
    } catch (e) {
      return $preProcessorFailed;
    }
  }
  postProcessSnapshot(sn, node) {
    if (this._processors.postProcessor) {
      return this._processors.postProcessor.call(
        null,
        sn,
        node.storedValue
      );
    }
    return sn;
  }
  _fixNode(node) {
    proxyNodeTypeMethods(node.type, this, "create");
    if (node instanceof ObjectNode) {
      node.hasSnapshotPostProcessor = !!this._processors.postProcessor;
    }
    const oldGetSnapshot = node.getSnapshot;
    node.getSnapshot = () => this.postProcessSnapshot(oldGetSnapshot.call(node), node);
    if (!isUnionType(this._subtype)) {
      node.getReconciliationType = () => {
        return this;
      };
    }
  }
  instantiate(parent, subpath, environment, initialValue) {
    const processedInitialValue = isStateTreeNode(initialValue) ? initialValue : this.preProcessSnapshot(initialValue);
    const node = this._subtype.instantiate(
      parent,
      subpath,
      environment,
      processedInitialValue
    );
    this._fixNode(node);
    return node;
  }
  reconcile(current, newValue, parent, subpath) {
    const node = this._subtype.reconcile(
      current,
      isStateTreeNode(newValue) ? newValue : this.preProcessSnapshot(newValue),
      parent,
      subpath
    );
    if (node !== current) {
      this._fixNode(node);
    }
    return node;
  }
  getSnapshot(node, applyPostProcess = true) {
    const sn = this._subtype.getSnapshot(node);
    return applyPostProcess ? this.postProcessSnapshot(sn, node) : sn;
  }
  isValidSnapshot(value, context) {
    const processedSn = this.preProcessSnapshotSafe(value);
    if (processedSn === $preProcessorFailed) {
      return typeCheckFailure(context, value, "Failed to preprocess value");
    }
    return this._subtype.validate(processedSn, context);
  }
  getSubTypes() {
    return this._subtype;
  }
  /**
   * MST considers a given value to "be" of a subtype is the value is either:
   *
   * 1. And instance of the subtype
   * 2. A valid snapshot *in* of the subtype
   *
   * Before v7, we used to also consider processed models (as in, SnapshotOut values of this).
   * This is no longer the case, and is more in line with our overall "is" philosophy, which you can
   * see in `src/core/type/type.ts:104` (assuming lines don't change too much).
   *
   * For additonal commentary, see discussion in https://github.com/mobxjs/@jbrowse/@jbrowse/mobx-state-tree/pull/2182
   *
   * The `is` function specifically checks for `SnapshotIn` or `Instance` of a given type.
   *
   * @param thing
   * @returns
   */
  is(thing) {
    const value = isType(thing) ? this._subtype : isStateTreeNode(thing) ? thing : this.preProcessSnapshotSafe(thing);
    if (value === $preProcessorFailed) {
      return false;
    }
    return this._subtype.validate(value, [{ path: "", type: this._subtype }]).length === 0;
  }
  isAssignableFrom(type) {
    return this._subtype.isAssignableFrom(type);
  }
  isMatchingSnapshotId(current, snapshot) {
    if (!(this._subtype instanceof ComplexType2)) {
      return false;
    }
    const processedSn = this.preProcessSnapshot(snapshot);
    return this._subtype.isMatchingSnapshotId(current, processedSn);
  }
};
function proxyNodeTypeMethods(nodeType, snapshotProcessorType, ...methods) {
  for (const method of methods) {
    nodeType[method] = snapshotProcessorType[method].bind(snapshotProcessorType);
  }
}
function snapshotProcessor(type, processors, name) {
  assertIsType(type, 1);
  if (devMode()) {
    if (processors.postProcessor && typeof processors.postProcessor !== "function") {
      throw new MstError("postSnapshotProcessor must be a function");
    }
    if (processors.preProcessor && typeof processors.preProcessor !== "function") {
      throw new MstError("preSnapshotProcessor must be a function");
    }
  }
  return new SnapshotProcessor(type, processors, name);
}

// src/types/complex-types/map.ts
import {
  _interceptReads,
  action as action4,
  intercept,
  observable as observable2,
  ObservableMap,
  observe,
  values as values2
} from "mobx";
var needsIdentifierError = `Map.put can only be used to store complex values that have an identifier type attribute`;
function tryCollectModelTypes(type, modelTypes) {
  const subtypes = type.getSubTypes();
  if (subtypes === cannotDetermineSubtype) {
    return false;
  }
  if (subtypes) {
    const subtypesArray = asArray(subtypes);
    for (const subtype of subtypesArray) {
      if (!tryCollectModelTypes(subtype, modelTypes)) return false;
    }
  }
  if (type instanceof ModelType) {
    modelTypes.push(type);
  }
  return true;
}
var MSTMap = class extends ObservableMap {
  constructor(initialData, name) {
    super(initialData, observable2.ref.enhancer, name);
  }
  get(key) {
    return super.get("" + key);
  }
  has(key) {
    return super.has("" + key);
  }
  delete(key) {
    return super.delete("" + key);
  }
  set(key, value) {
    return super.set("" + key, value);
  }
  put(value) {
    if (!value) throw new MstError(`Map.put cannot be used to set empty values`);
    if (isStateTreeNode(value)) {
      const node = getStateTreeNode(value);
      if (devMode()) {
        if (!node.identifierAttribute) {
          throw new MstError(needsIdentifierError);
        }
      }
      if (node.identifier === null) {
        throw new MstError(needsIdentifierError);
      }
      this.set(node.identifier, value);
      return value;
    } else if (!isMutable(value)) {
      throw new MstError(`Map.put can only be used to store complex values`);
    } else {
      const mapNode = getStateTreeNode(this);
      const mapType = mapNode.type;
      if (mapType.identifierMode !== 1 /* YES */) {
        throw new MstError(needsIdentifierError);
      }
      const idAttr = mapType.mapIdentifierAttribute;
      const id = value[idAttr];
      if (!isValidIdentifier(id)) {
        const newNode = this.put(
          mapType.getChildType().create(value, mapNode.environment)
        );
        return this.put(getSnapshot(newNode));
      }
      const key = normalizeIdentifier(id);
      this.set(key, value);
      return this.get(key);
    }
  }
};
var MapType = class _MapType extends ComplexType2 {
  constructor(name, _subType, hookInitializers = []) {
    super(name);
    this._subType = _subType;
    this._determineIdentifierMode();
    this.hookInitializers = hookInitializers;
  }
  identifierMode = 0 /* UNKNOWN */;
  mapIdentifierAttribute = void 0;
  flags = 64 /* Map */;
  hookInitializers = [];
  hooks(hooks) {
    const hookInitializers = this.hookInitializers.length > 0 ? this.hookInitializers.concat(hooks) : [hooks];
    return new _MapType(this.name, this._subType, hookInitializers);
  }
  instantiate(parent, subpath, environment, initialValue) {
    this._determineIdentifierMode();
    return createObjectNode(this, parent, subpath, environment, initialValue);
  }
  _determineIdentifierMode() {
    if (this.identifierMode !== 0 /* UNKNOWN */) {
      return;
    }
    const modelTypes = [];
    if (tryCollectModelTypes(this._subType, modelTypes)) {
      const identifierAttribute = modelTypes.reduce(
        (current, type) => {
          if (!type.identifierAttribute) return current;
          if (current && current !== type.identifierAttribute) {
            throw new MstError(
              `The objects in a map should all have the same identifier attribute, expected '${current}', but child of type '${type.name}' declared attribute '${type.identifierAttribute}' as identifier`
            );
          }
          return type.identifierAttribute;
        },
        void 0
      );
      if (identifierAttribute) {
        this.identifierMode = 1 /* YES */;
        this.mapIdentifierAttribute = identifierAttribute;
      } else {
        this.identifierMode = 2 /* NO */;
      }
    }
  }
  initializeChildNodes(objNode, initialSnapshot = {}) {
    const subType = objNode.type._subType;
    const result = {};
    Object.keys(initialSnapshot).forEach((name) => {
      result[name] = subType.instantiate(
        objNode,
        name,
        void 0,
        initialSnapshot[name]
      );
    });
    return result;
  }
  createNewInstance(childNodes) {
    return new MSTMap(childNodes, this.name);
  }
  finalizeNewInstance(node, instance) {
    _interceptReads(instance, node.unbox);
    const type = node.type;
    type.hookInitializers.forEach((initializer) => {
      const hooks = initializer(instance);
      Object.keys(hooks).forEach((name) => {
        const hook = hooks[name];
        const actionInvoker = createActionInvoker(
          instance,
          name,
          hook
        );
        (!devMode() ? addHiddenFinalProp : addHiddenWritableProp)(
          instance,
          name,
          actionInvoker
        );
      });
    });
    intercept(instance, this.willChange);
    observe(instance, this.didChange);
  }
  describe() {
    return this.name;
  }
  getChildren(node) {
    return values2(node.storedValue);
  }
  getChildNode(node, key) {
    const childNode = node.storedValue.get("" + key);
    if (!childNode) throw new MstError("Not a child " + key);
    return childNode;
  }
  willChange(change) {
    const node = getStateTreeNode(change.object);
    const key = change.name;
    node.assertWritable({ subpath: key });
    const mapType = node.type;
    const subType = mapType._subType;
    switch (change.type) {
      case "update":
        {
          const { newValue } = change;
          const oldValue = change.object.get(key);
          if (newValue === oldValue) return null;
          typecheckInternal(subType, newValue);
          change.newValue = subType.reconcile(
            node.getChildNode(key),
            change.newValue,
            node,
            key
          );
          mapType.processIdentifier(key, change.newValue);
        }
        break;
      case "add":
        {
          typecheckInternal(subType, change.newValue);
          change.newValue = subType.instantiate(
            node,
            key,
            void 0,
            change.newValue
          );
          mapType.processIdentifier(key, change.newValue);
        }
        break;
    }
    return change;
  }
  processIdentifier(expected, node) {
    if (this.identifierMode === 1 /* YES */ && node instanceof ObjectNode) {
      const identifier2 = node.identifier;
      if (identifier2 !== expected)
        throw new MstError(
          `A map of objects containing an identifier should always store the object under their own identifier. Trying to store key '${identifier2}', but expected: '${expected}'`
        );
    }
  }
  getSnapshot(node) {
    const res = {};
    node.getChildren().forEach((childNode) => {
      res[childNode.subpath] = childNode.snapshot;
    });
    return res;
  }
  processInitialSnapshot(childNodes) {
    const processed = {};
    Object.keys(childNodes).forEach((key) => {
      processed[key] = childNodes[key].getSnapshot();
    });
    return processed;
  }
  didChange(change) {
    const node = getStateTreeNode(change.object);
    switch (change.type) {
      case "update":
        return void node.emitPatch(
          {
            op: "replace",
            path: escapeJsonPath(change.name),
            value: change.newValue.snapshot,
            oldValue: change.oldValue ? change.oldValue.snapshot : void 0
          },
          node
        );
      case "add":
        return void node.emitPatch(
          {
            op: "add",
            path: escapeJsonPath(change.name),
            value: change.newValue.snapshot,
            oldValue: void 0
          },
          node
        );
      case "delete":
        const oldSnapshot = change.oldValue.snapshot;
        change.oldValue.die();
        return void node.emitPatch(
          {
            op: "remove",
            path: escapeJsonPath(change.name),
            oldValue: oldSnapshot
          },
          node
        );
    }
  }
  applyPatchLocally(node, subpath, patch) {
    const target = node.storedValue;
    switch (patch.op) {
      case "add":
      case "replace":
        target.set(subpath, patch.value);
        break;
      case "remove":
        target.delete(subpath);
        break;
    }
  }
  applySnapshot(node, snapshot) {
    typecheckInternal(this, snapshot);
    const target = node.storedValue;
    const currentKeys = {};
    Array.from(target.keys()).forEach((key) => {
      currentKeys[key] = false;
    });
    if (snapshot) {
      for (let key in snapshot) {
        target.set(key, snapshot[key]);
        currentKeys["" + key] = true;
      }
    }
    Object.keys(currentKeys).forEach((key) => {
      if (currentKeys[key] === false) target.delete(key);
    });
  }
  getChildType() {
    return this._subType;
  }
  isValidSnapshot(value, context) {
    if (!isPlainObject(value)) {
      return typeCheckFailure(context, value, "Value is not a plain object");
    }
    return flattenTypeErrors(
      Object.keys(value).map(
        (path) => this._subType.validate(
          value[path],
          getContextForPath(context, path, this._subType)
        )
      )
    );
  }
  getDefaultSnapshot() {
    return EMPTY_OBJECT;
  }
  removeChild(node, subpath) {
    node.storedValue.delete(subpath);
  }
};
MapType.prototype.applySnapshot = action4(MapType.prototype.applySnapshot);
function map(subtype) {
  return new MapType(`Map<string, ${subtype.name}>`, subtype);
}
function isMapType(type) {
  return isType(type) && (type.flags & 64 /* Map */) > 0;
}

// src/types/complex-types/array.ts
import {
  _getAdministration,
  action as action5,
  intercept as intercept2,
  observable as observable3,
  observe as observe2
} from "mobx";
var ArrayType = class _ArrayType extends ComplexType2 {
  constructor(name, _subType, hookInitializers = []) {
    super(name);
    this._subType = _subType;
    this.hookInitializers = hookInitializers;
  }
  flags = 32 /* Array */;
  hookInitializers = [];
  hooks(hooks) {
    const hookInitializers = this.hookInitializers.length > 0 ? this.hookInitializers.concat(hooks) : [hooks];
    return new _ArrayType(this.name, this._subType, hookInitializers);
  }
  instantiate(parent, subpath, environment, initialValue) {
    return createObjectNode(this, parent, subpath, environment, initialValue);
  }
  initializeChildNodes(objNode, snapshot = []) {
    const subType = objNode.type._subType;
    const result = {};
    snapshot.forEach((item, index) => {
      const subpath = "" + index;
      result[subpath] = subType.instantiate(objNode, subpath, void 0, item);
    });
    return result;
  }
  createNewInstance(childNodes) {
    const options = { ...mobxShallow, name: this.name };
    return observable3.array(
      convertChildNodesToArray(childNodes),
      options
    );
  }
  finalizeNewInstance(node, instance) {
    _getAdministration(instance).dehancer = node.unbox;
    const type = node.type;
    type.hookInitializers.forEach((initializer) => {
      const hooks = initializer(instance);
      Object.keys(hooks).forEach((name) => {
        const hook = hooks[name];
        const actionInvoker = createActionInvoker(
          instance,
          name,
          hook
        );
        (!devMode() ? addHiddenFinalProp : addHiddenWritableProp)(
          instance,
          name,
          actionInvoker
        );
      });
    });
    intercept2(instance, this.willChange);
    observe2(instance, this.didChange);
  }
  describe() {
    return this.name;
  }
  getChildren(node) {
    return node.storedValue.slice();
  }
  getChildNode(node, key) {
    const index = Number(key);
    if (index < node.storedValue.length) return node.storedValue[index];
    throw new MstError("Not a child: " + key);
  }
  willChange(change) {
    const node = getStateTreeNode(change.object);
    node.assertWritable({ subpath: "" + change.index });
    const subType = node.type._subType;
    const childNodes = node.getChildren();
    switch (change.type) {
      case "update":
        {
          if (change.newValue === change.object[change.index]) return null;
          const updatedNodes = reconcileArrayChildren(
            node,
            subType,
            [childNodes[change.index]],
            [change.newValue],
            [change.index]
          );
          if (!updatedNodes) {
            return null;
          }
          change.newValue = updatedNodes[0];
        }
        break;
      case "splice":
        {
          const { index, removedCount, added } = change;
          const addedNodes = reconcileArrayChildren(
            node,
            subType,
            childNodes.slice(index, index + removedCount),
            added,
            added.map((_, i) => index + i)
          );
          if (!addedNodes) {
            return null;
          }
          change.added = addedNodes;
          for (let i = index + removedCount; i < childNodes.length; i++) {
            childNodes[i].setParent(
              node,
              "" + (i + added.length - removedCount)
            );
          }
        }
        break;
    }
    return change;
  }
  getSnapshot(node) {
    return node.getChildren().map((childNode) => childNode.snapshot);
  }
  processInitialSnapshot(childNodes) {
    const processed = [];
    Object.keys(childNodes).forEach((key) => {
      processed.push(childNodes[key].getSnapshot());
    });
    return processed;
  }
  didChange(change) {
    const node = getStateTreeNode(change.object);
    switch (change.type) {
      case "update":
        return void node.emitPatch(
          {
            op: "replace",
            path: "" + change.index,
            value: change.newValue.snapshot,
            oldValue: change.oldValue ? change.oldValue.snapshot : void 0
          },
          node
        );
      case "splice":
        if (change.removedCount && change.addedCount === change.object.length) {
          return void node.emitPatch(
            {
              op: "replace",
              path: "",
              value: node.snapshot,
              oldValue: change.removed.map((node2) => node2.snapshot)
            },
            node
          );
        }
        for (let i = change.removedCount - 1; i >= 0; i--)
          node.emitPatch(
            {
              op: "remove",
              path: "" + (change.index + i),
              oldValue: change.removed[i].snapshot
            },
            node
          );
        for (let i = 0; i < change.addedCount; i++)
          node.emitPatch(
            {
              op: "add",
              path: "" + (change.index + i),
              value: change.added[i].snapshot,
              oldValue: void 0
            },
            node
          );
        return;
    }
  }
  applyPatchLocally(node, subpath, patch) {
    const target = node.storedValue;
    const index = subpath === "-" ? target.length : Number(subpath);
    switch (patch.op) {
      case "replace":
        target[index] = patch.value;
        break;
      case "add":
        target.splice(index, 0, patch.value);
        break;
      case "remove":
        target.splice(index, 1);
        break;
    }
  }
  applySnapshot(node, snapshot) {
    typecheckInternal(this, snapshot);
    const target = node.storedValue;
    target.replace(snapshot);
  }
  getChildType() {
    return this._subType;
  }
  isValidSnapshot(value, context) {
    if (!isArray(value)) {
      return typeCheckFailure(context, value, "Value is not an array");
    }
    return flattenTypeErrors(
      value.map(
        (item, index) => this._subType.validate(
          item,
          getContextForPath(context, "" + index, this._subType)
        )
      )
    );
  }
  getDefaultSnapshot() {
    return EMPTY_ARRAY;
  }
  removeChild(node, subpath) {
    node.storedValue.splice(Number(subpath), 1);
  }
};
ArrayType.prototype.applySnapshot = action5(ArrayType.prototype.applySnapshot);
function array(subtype) {
  assertIsType(subtype, 1);
  return new ArrayType(`${subtype.name}[]`, subtype);
}
function reconcileArrayChildren(parent, childType, oldNodes, newValues, newPaths) {
  let nothingChanged = true;
  for (let i = 0; ; i++) {
    const hasNewNode = i <= newValues.length - 1;
    const oldNode = oldNodes[i];
    let newValue = hasNewNode ? newValues[i] : void 0;
    const newPath = "" + newPaths[i];
    if (isNode(newValue)) newValue = newValue.storedValue;
    if (!oldNode && !hasNewNode) {
      break;
    } else if (!hasNewNode) {
      nothingChanged = false;
      oldNodes.splice(i, 1);
      if (oldNode instanceof ObjectNode) {
        oldNode.createObservableInstanceIfNeeded();
      }
      oldNode.die();
      i--;
    } else if (!oldNode) {
      if (isStateTreeNode(newValue) && getStateTreeNode(newValue).parent === parent) {
        throw new MstError(
          `Cannot add an object to a state tree if it is already part of the same or another state tree. Tried to assign an object to '${parent.path}/${newPath}', but it lives already at '${getStateTreeNode(newValue).path}'`
        );
      }
      nothingChanged = false;
      const newNode = valueAsNode(childType, parent, newPath, newValue);
      oldNodes.splice(i, 0, newNode);
    } else if (areSame(oldNode, newValue)) {
      oldNodes[i] = valueAsNode(childType, parent, newPath, newValue, oldNode);
    } else {
      let oldMatch = void 0;
      for (let j = i; j < oldNodes.length; j++) {
        if (areSame(oldNodes[j], newValue)) {
          oldMatch = oldNodes.splice(j, 1)[0];
          break;
        }
      }
      nothingChanged = false;
      const newNode = valueAsNode(
        childType,
        parent,
        newPath,
        newValue,
        oldMatch
      );
      oldNodes.splice(i, 0, newNode);
    }
  }
  return nothingChanged ? null : oldNodes;
}
function valueAsNode(childType, parent, subpath, newValue, oldNode) {
  typecheckInternal(childType, newValue);
  function getNewNode() {
    if (isStateTreeNode(newValue)) {
      const childNode = getStateTreeNode(newValue);
      childNode.assertAlive(EMPTY_OBJECT);
      if (childNode.parent !== null && childNode.parent === parent) {
        childNode.setParent(parent, subpath);
        return childNode;
      }
    }
    if (oldNode) {
      return childType.reconcile(oldNode, newValue, parent, subpath);
    }
    return childType.instantiate(parent, subpath, void 0, newValue);
  }
  const newNode = getNewNode();
  if (oldNode && oldNode !== newNode) {
    if (oldNode instanceof ObjectNode) {
      oldNode.createObservableInstanceIfNeeded();
    }
    oldNode.die();
  }
  return newNode;
}
function areSame(oldNode, newValue) {
  if (!oldNode.isAlive) {
    return false;
  }
  if (isStateTreeNode(newValue)) {
    const newNode = getStateTreeNode(newValue);
    return newNode.isAlive && newNode === oldNode;
  }
  if (oldNode.snapshot === newValue) {
    return true;
  }
  if (!(oldNode instanceof ObjectNode)) {
    return false;
  }
  const oldNodeType = oldNode.getReconciliationType();
  return oldNode.identifier !== null && oldNode.identifierAttribute && isPlainObject(newValue) && oldNodeType.is(newValue) && oldNodeType.isMatchingSnapshotId(oldNode, newValue);
}
function isArrayType(type) {
  return isType(type) && (type.flags & 32 /* Array */) > 0;
}

// src/types/complex-types/model.ts
import {
  _getAdministration as _getAdministration2,
  _interceptReads as _interceptReads2,
  action as action6,
  computed as computed2,
  defineProperty as defineProperty2,
  getAtom,
  intercept as intercept3,
  makeObservable,
  observable as observable4,
  observe as observe3,
  set
} from "mobx";
var PRE_PROCESS_SNAPSHOT = "preProcessSnapshot";
var POST_PROCESS_SNAPSHOT = "postProcessSnapshot";
function objectTypeToString() {
  return getStateTreeNode(this).toString();
}
var defaultObjectOptions = {
  name: "AnonymousModel",
  properties: {},
  initializers: EMPTY_ARRAY
};
function toPropertiesObject(declaredProps) {
  const keysList = Object.keys(declaredProps);
  const alreadySeenKeys = /* @__PURE__ */ new Set();
  keysList.forEach((key) => {
    if (alreadySeenKeys.has(key)) {
      throw new MstError(
        `${key} is declared twice in the model. Model should not contain the same keys`
      );
    }
    alreadySeenKeys.add(key);
  });
  return keysList.reduce(
    (props, key) => {
      if (key in Hook) {
        throw new MstError(
          `Hook '${key}' was defined as property. Hooks should be defined as part of the actions`
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(declaredProps, key);
      if ("get" in descriptor) {
        throw new MstError(
          "Getters are not supported as properties. Please use views instead"
        );
      }
      const value = descriptor.value;
      if (value === null || value === void 0) {
        throw new MstError(
          "The default value of an attribute cannot be null or undefined as the type cannot be inferred. Did you mean `types.maybe(someType)`?"
        );
      } else if (isPrimitive(value)) {
        props[key] = optional(getPrimitiveFactoryFromValue(value), value);
      } else if (value instanceof MapType) {
        props[key] = optional(value, {});
      } else if (value instanceof ArrayType) {
        props[key] = optional(value, []);
      } else if (isType(value)) {
      } else if (devMode() && typeof value === "function") {
        throw new MstError(
          `Invalid type definition for property '${key}', it looks like you passed a function. Did you forget to invoke it, or did you intend to declare a view / action?`
        );
      } else if (devMode() && typeof value === "object") {
        throw new MstError(
          `Invalid type definition for property '${key}', it looks like you passed an object. Try passing another model type or a types.frozen.`
        );
      } else {
        throw new MstError(
          `Invalid type definition for property '${key}', cannot infer a type from a value like '${value}' (${typeof value})`
        );
      }
      return props;
    },
    { ...declaredProps }
  );
}
var ModelType = class _ModelType extends ComplexType2 {
  flags = 128 /* Object */;
  /*
   * The original object definition
   */
  initializers;
  properties;
  preProcessor;
  postProcessor;
  propertyNames;
  constructor(opts) {
    super(opts.name || defaultObjectOptions.name);
    Object.assign(this, defaultObjectOptions, opts);
    this.properties = toPropertiesObject(this.properties);
    freeze(this.properties);
    this.propertyNames = Object.keys(this.properties);
    this.identifierAttribute = this._getIdentifierAttribute();
  }
  _getIdentifierAttribute() {
    let identifierAttribute = void 0;
    this.forAllProps((propName, propType) => {
      if (propType.flags & 2048 /* Identifier */) {
        if (identifierAttribute)
          throw new MstError(
            `Cannot define property '${propName}' as object identifier, property '${identifierAttribute}' is already defined as identifier property`
          );
        identifierAttribute = propName;
      }
    });
    return identifierAttribute;
  }
  cloneAndEnhance(opts) {
    return new _ModelType({
      name: opts.name || this.name,
      properties: Object.assign({}, this.properties, opts.properties),
      initializers: this.initializers.concat(opts.initializers || []),
      preProcessor: opts.preProcessor || this.preProcessor,
      postProcessor: opts.postProcessor || this.postProcessor
    });
  }
  actions(fn) {
    const actionInitializer = (self) => {
      this.instantiateActions(self, fn(self));
      return self;
    };
    return this.cloneAndEnhance({ initializers: [actionInitializer] });
  }
  instantiateActions(self, actions) {
    if (!isPlainObject(actions)) {
      throw new MstError(
        `actions initializer should return a plain object containing actions`
      );
    }
    Object.getOwnPropertyNames(actions).forEach((name) => {
      if (name in this.properties) {
        throw new MstError(
          `'${name}' is a property and cannot be declared as an action`
        );
      }
      if (name === PRE_PROCESS_SNAPSHOT)
        throw new MstError(
          `Cannot define action '${PRE_PROCESS_SNAPSHOT}', it should be defined using 'type.preProcessSnapshot(fn)' instead`
        );
      if (name === POST_PROCESS_SNAPSHOT)
        throw new MstError(
          `Cannot define action '${POST_PROCESS_SNAPSHOT}', it should be defined using 'type.postProcessSnapshot(fn)' instead`
        );
      let action22 = actions[name];
      let baseAction = self[name];
      if (name in Hook && baseAction) {
        let specializedAction = action22;
        action22 = function() {
          baseAction.apply(null, arguments);
          specializedAction.apply(null, arguments);
        };
      }
      const middlewares = action22.$mst_middleware;
      let boundAction = action22.bind(actions);
      boundAction._isFlowAction = action22._isFlowAction || false;
      boundAction.$mst_middleware = middlewares;
      const actionInvoker = createActionInvoker(self, name, boundAction);
      actions[name] = actionInvoker;
      (!devMode() ? addHiddenFinalProp : addHiddenWritableProp)(
        self,
        name,
        actionInvoker
      );
    });
  }
  named = (name) => {
    return this.cloneAndEnhance({ name });
  };
  props = (properties) => {
    return this.cloneAndEnhance({ properties });
  };
  volatile(fn) {
    if (typeof fn !== "function") {
      throw new MstError(
        `You passed an ${typeof fn} to volatile state as an argument, when function is expected`
      );
    }
    const stateInitializer = (self) => {
      this.instantiateVolatileState(self, fn(self));
      return self;
    };
    return this.cloneAndEnhance({ initializers: [stateInitializer] });
  }
  instantiateVolatileState(self, state) {
    if (!isPlainObject(state)) {
      throw new MstError(
        `volatile state initializer should return a plain object containing state`
      );
    }
    Object.getOwnPropertyNames(state).forEach((name) => {
      if (name in this.properties) {
        throw new MstError(
          `'${name}' is a property and cannot be declared as volatile state`
        );
      }
      set(self, name, state[name]);
    });
  }
  extend(fn) {
    const initializer = (self) => {
      const { actions, views, state, ...rest } = fn(self);
      for (let key in rest)
        throw new MstError(
          `The \`extend\` function should return an object with a subset of the fields 'actions', 'views' and 'state'. Found invalid key '${key}'`
        );
      if (state) this.instantiateVolatileState(self, state);
      if (views) this.instantiateViews(self, views);
      if (actions) this.instantiateActions(self, actions);
      return self;
    };
    return this.cloneAndEnhance({ initializers: [initializer] });
  }
  views(fn) {
    const viewInitializer = (self) => {
      this.instantiateViews(self, fn(self));
      return self;
    };
    return this.cloneAndEnhance({ initializers: [viewInitializer] });
  }
  instantiateViews(self, views) {
    if (!isPlainObject(views)) {
      throw new MstError(
        `views initializer should return a plain object containing views`
      );
    }
    Object.getOwnPropertyNames(views).forEach((name) => {
      if (name in this.properties) {
        throw new MstError(
          `'${name}' is a property and cannot be declared as a view`
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(views, name);
      if ("get" in descriptor) {
        defineProperty2(self, name, descriptor);
        makeObservable(self, { [name]: computed2 });
      } else if (typeof descriptor.value === "function") {
        ;
        (!devMode() ? addHiddenFinalProp : addHiddenWritableProp)(
          self,
          name,
          descriptor.value
        );
      } else {
        throw new MstError(
          `A view member should either be a function or getter based property`
        );
      }
    });
  }
  preProcessSnapshot = (preProcessor) => {
    const currentPreprocessor = this.preProcessor;
    if (!currentPreprocessor) return this.cloneAndEnhance({ preProcessor });
    else
      return this.cloneAndEnhance({
        preProcessor: (snapshot) => currentPreprocessor(preProcessor(snapshot))
      });
  };
  postProcessSnapshot = (postProcessor) => {
    const currentPostprocessor = this.postProcessor;
    if (!currentPostprocessor) return this.cloneAndEnhance({ postProcessor });
    else
      return this.cloneAndEnhance({
        postProcessor: (snapshot) => postProcessor(currentPostprocessor(snapshot))
      });
  };
  instantiate(parent, subpath, environment, initialValue) {
    const value = isStateTreeNode(initialValue) ? initialValue : this.applySnapshotPreProcessor(initialValue);
    return createObjectNode(this, parent, subpath, environment, value);
  }
  initializeChildNodes(objNode, initialSnapshot = {}) {
    const type = objNode.type;
    const result = {};
    type.forAllProps((name, childType) => {
      result[name] = childType.instantiate(
        objNode,
        name,
        void 0,
        initialSnapshot[name]
      );
    });
    return result;
  }
  createNewInstance(childNodes) {
    const options = { ...mobxShallow, name: this.name };
    return observable4.object(childNodes, EMPTY_OBJECT, options);
  }
  finalizeNewInstance(node, instance) {
    addHiddenFinalProp(instance, "toString", objectTypeToString);
    this.forAllProps((name) => {
      _interceptReads2(instance, name, node.unbox);
    });
    this.initializers.reduce((self, fn) => fn(self), instance);
    intercept3(instance, this.willChange);
    observe3(instance, this.didChange);
  }
  willChange(chg) {
    const change = chg;
    const node = getStateTreeNode(change.object);
    const subpath = change.name;
    node.assertWritable({ subpath });
    const childType = node.type.properties[subpath];
    if (childType) {
      typecheckInternal(childType, change.newValue);
      change.newValue = childType.reconcile(
        node.getChildNode(subpath),
        change.newValue,
        node,
        subpath
      );
    }
    return change;
  }
  didChange(chg) {
    const change = chg;
    const childNode = getStateTreeNode(change.object);
    const childType = childNode.type.properties[change.name];
    if (!childType) {
      return;
    }
    const oldChildValue = change.oldValue ? change.oldValue.snapshot : void 0;
    childNode.emitPatch(
      {
        op: "replace",
        path: escapeJsonPath(change.name),
        value: change.newValue.snapshot,
        oldValue: oldChildValue
      },
      childNode
    );
  }
  getChildren(node) {
    const res = [];
    this.forAllProps((name) => {
      res.push(this.getChildNode(node, name));
    });
    return res;
  }
  getChildNode(node, key) {
    if (!(key in this.properties))
      throw new MstError("Not a value property: " + key);
    const adm = _getAdministration2(node.storedValue, key);
    const childNode = adm.raw?.();
    if (!childNode) throw new MstError("Node not available for property " + key);
    return childNode;
  }
  getSnapshot(node, applyPostProcess = true) {
    const res = {};
    this.forAllProps((name, type) => {
      const atom = getAtom(node.storedValue, name);
      atom.reportObserved();
      res[name] = this.getChildNode(node, name).snapshot;
    });
    if (applyPostProcess) {
      return this.applySnapshotPostProcessor(res);
    }
    return res;
  }
  processInitialSnapshot(childNodes) {
    const processed = {};
    Object.keys(childNodes).forEach((key) => {
      processed[key] = childNodes[key].getSnapshot();
    });
    return this.applySnapshotPostProcessor(processed);
  }
  applyPatchLocally(node, subpath, patch) {
    if (!(patch.op === "replace" || patch.op === "add")) {
      throw new MstError(`object does not support operation ${patch.op}`);
    }
    ;
    node.storedValue[subpath] = patch.value;
  }
  applySnapshot(node, snapshot) {
    typecheckInternal(this, snapshot);
    const preProcessedSnapshot = this.applySnapshotPreProcessor(snapshot);
    this.forAllProps((name) => {
      ;
      node.storedValue[name] = preProcessedSnapshot[name];
    });
  }
  applySnapshotPreProcessor(snapshot) {
    const processor = this.preProcessor;
    return processor ? processor.call(null, snapshot) : snapshot;
  }
  applySnapshotPostProcessor(snapshot) {
    const postProcessor = this.postProcessor;
    if (postProcessor) return postProcessor.call(null, snapshot);
    return snapshot;
  }
  getChildType(propertyName) {
    assertIsString(propertyName, 1);
    return this.properties[propertyName];
  }
  isValidSnapshot(value, context) {
    let snapshot = this.applySnapshotPreProcessor(value);
    if (!isPlainObject(snapshot)) {
      return typeCheckFailure(context, snapshot, "Value is not a plain object");
    }
    return flattenTypeErrors(
      this.propertyNames.map(
        (key) => this.properties[key].validate(
          snapshot[key],
          getContextForPath(context, key, this.properties[key])
        )
      )
    );
  }
  forAllProps(fn) {
    this.propertyNames.forEach((key) => fn(key, this.properties[key]));
  }
  describe() {
    return "{ " + this.propertyNames.map((key) => key + ": " + this.properties[key].describe()).join("; ") + " }";
  }
  getDefaultSnapshot() {
    return EMPTY_OBJECT;
  }
  removeChild(node, subpath) {
    ;
    node.storedValue[subpath] = void 0;
  }
};
ModelType.prototype.applySnapshot = action6(ModelType.prototype.applySnapshot);
function model(...args) {
  if (devMode() && typeof args[0] !== "string" && args[1]) {
    throw new MstError(
      "Model creation failed. First argument must be a string when two arguments are provided"
    );
  }
  const name = typeof args[0] === "string" ? args.shift() : "AnonymousModel";
  const properties = args.shift() || {};
  return new ModelType({ name, properties });
}
function compose(...args) {
  const hasTypename = typeof args[0] === "string";
  const typeName = hasTypename ? args[0] : "AnonymousModel";
  if (hasTypename) {
    args.shift();
  }
  if (devMode()) {
    args.forEach((type, i) => {
      assertArg(
        type,
        isModelType,
        "@jbrowse/@jbrowse/mobx-state-tree model type",
        hasTypename ? i + 2 : i + 1
      );
    });
  }
  return args.reduce(
    (prev, cur) => prev.cloneAndEnhance({
      name: prev.name + "_" + cur.name,
      properties: cur.properties,
      initializers: cur.initializers,
      preProcessor: (snapshot) => cur.applySnapshotPreProcessor(
        prev.applySnapshotPreProcessor(snapshot)
      ),
      postProcessor: (snapshot) => cur.applySnapshotPostProcessor(
        prev.applySnapshotPostProcessor(snapshot)
      )
    })
  ).named(typeName);
}
function isModelType(type) {
  return isType(type) && (type.flags & 128 /* Object */) > 0;
}

// src/types/primitives.ts
var CoreType = class extends SimpleType2 {
  constructor(name, flags, checker, initializer = identity) {
    super(name);
    this.flags = flags;
    this.checker = checker;
    this.initializer = initializer;
    this.flags = flags;
  }
  describe() {
    return this.name;
  }
  instantiate(parent, subpath, environment, initialValue) {
    return createScalarNode(this, parent, subpath, environment, initialValue);
  }
  createNewInstance(snapshot) {
    return this.initializer(snapshot);
  }
  isValidSnapshot(value, context) {
    if (isPrimitive(value) && this.checker(value)) {
      return typeCheckSuccess();
    }
    const typeName = this.name === "Date" ? "Date or a unix milliseconds timestamp" : this.name;
    return typeCheckFailure(context, value, `Value is not a ${typeName}`);
  }
};
var string = new CoreType(
  "string",
  1 /* String */,
  (v) => typeof v === "string"
);
var number = new CoreType(
  "number",
  2 /* Number */,
  (v) => typeof v === "number"
);
var integer = new CoreType("integer", 131072 /* Integer */, (v) => isInteger(v));
var float = new CoreType(
  "float",
  4194304 /* Float */,
  (v) => isFloat(v)
);
var finite = new CoreType(
  "finite",
  2097152 /* Finite */,
  (v) => isFinite(v)
);
var boolean = new CoreType("boolean", 4 /* Boolean */, (v) => typeof v === "boolean");
var nullType = new CoreType(
  "null",
  32768 /* Null */,
  (v) => v === null
);
var undefinedType = new CoreType("undefined", 65536 /* Undefined */, (v) => v === void 0);
var _DatePrimitive = new CoreType(
  "Date",
  8 /* Date */,
  (v) => typeof v === "number" || v instanceof Date,
  (v) => v instanceof Date ? v : new Date(v)
);
_DatePrimitive.getSnapshot = function(node) {
  return node.storedValue.getTime();
};
var DatePrimitive = _DatePrimitive;
function getPrimitiveFactoryFromValue(value) {
  switch (typeof value) {
    case "string":
      return string;
    case "number":
      return number;
    // In the future, isInteger(value) ? integer : number would be interesting, but would be too breaking for now
    case "boolean":
      return boolean;
    case "object":
      if (value instanceof Date) return DatePrimitive;
  }
  throw new MstError("Cannot determine primitive type from value " + value);
}
function isPrimitiveType(type) {
  return isType(type) && (type.flags & (1 /* String */ | 2 /* Number */ | 131072 /* Integer */ | 4 /* Boolean */ | 8 /* Date */)) > 0;
}

// src/types/utility-types/literal.ts
var Literal = class extends SimpleType2 {
  value;
  flags = 16 /* Literal */;
  constructor(value) {
    super(JSON.stringify(value));
    this.value = value;
  }
  instantiate(parent, subpath, environment, initialValue) {
    return createScalarNode(this, parent, subpath, environment, initialValue);
  }
  describe() {
    return JSON.stringify(this.value);
  }
  isValidSnapshot(value, context) {
    if (isPrimitive(value) && value === this.value) {
      return typeCheckSuccess();
    }
    return typeCheckFailure(
      context,
      value,
      `Value is not a literal ${JSON.stringify(this.value)}`
    );
  }
};
function literal(value) {
  assertArg(value, isPrimitive, "primitive", 1);
  return new Literal(value);
}
function isLiteralType(type) {
  return isType(type) && (type.flags & 16 /* Literal */) > 0;
}

// src/types/utility-types/refinement.ts
var Refinement = class extends BaseType {
  constructor(name, _subtype, _predicate, _message) {
    super(name);
    this._subtype = _subtype;
    this._predicate = _predicate;
    this._message = _message;
  }
  get flags() {
    return this._subtype.flags | 8192 /* Refinement */;
  }
  describe() {
    return this.name;
  }
  instantiate(parent, subpath, environment, initialValue) {
    return this._subtype.instantiate(
      parent,
      subpath,
      environment,
      initialValue
    );
  }
  isAssignableFrom(type) {
    return this._subtype.isAssignableFrom(type);
  }
  isValidSnapshot(value, context) {
    const subtypeErrors = this._subtype.validate(value, context);
    if (subtypeErrors.length > 0) return subtypeErrors;
    const snapshot = isStateTreeNode(value) ? getStateTreeNode(value).snapshot : value;
    if (!this._predicate(snapshot)) {
      return typeCheckFailure(context, value, this._message(value));
    }
    return typeCheckSuccess();
  }
  reconcile(current, newValue, parent, subpath) {
    return this._subtype.reconcile(current, newValue, parent, subpath);
  }
  getSubTypes() {
    return this._subtype;
  }
};
function refinement(...args) {
  const name = typeof args[0] === "string" ? args.shift() : isType(args[0]) ? args[0].name : null;
  const type = args[0];
  const predicate = args[1];
  const message = args[2] ? args[2] : (v) => "Value does not respect the refinement predicate";
  assertIsType(type, [1, 2]);
  assertIsString(name, 1);
  assertIsFunction(predicate, [2, 3]);
  assertIsFunction(message, [3, 4]);
  return new Refinement(name, type, predicate, message);
}
function isRefinementType(type) {
  return isType(type) && (type.flags & 8192 /* Refinement */) > 0;
}

// src/types/utility-types/enumeration.ts
function enumeration(name, options) {
  const realOptions = typeof name === "string" ? options : name;
  if (devMode()) {
    realOptions.forEach((option, i) => {
      assertIsString(option, i + 1);
    });
  }
  const type = union(...realOptions.map((option) => literal("" + option)));
  if (typeof name === "string") type.name = name;
  return type;
}

// src/types/utility-types/union.ts
var Union = class extends BaseType {
  constructor(name, _types, options) {
    super(name);
    this._types = _types;
    options = {
      eager: true,
      dispatcher: void 0,
      ...options
    };
    this._dispatcher = options.dispatcher;
    if (!options.eager) this._eager = false;
  }
  _dispatcher;
  _eager = true;
  get flags() {
    let result = 16384 /* Union */;
    this._types.forEach((type) => {
      result |= type.flags;
    });
    return result;
  }
  isAssignableFrom(type) {
    return this._types.some((subType) => subType.isAssignableFrom(type));
  }
  describe() {
    return "(" + this._types.map((factory) => factory.describe()).join(" | ") + ")";
  }
  instantiate(parent, subpath, environment, initialValue) {
    const type = this.determineType(initialValue, void 0);
    if (!type)
      throw new MstError("No matching type for union " + this.describe());
    return type.instantiate(parent, subpath, environment, initialValue);
  }
  reconcile(current, newValue, parent, subpath) {
    const type = this.determineType(newValue, current.getReconciliationType());
    if (!type)
      throw new MstError("No matching type for union " + this.describe());
    return type.reconcile(current, newValue, parent, subpath);
  }
  determineType(value, reconcileCurrentType) {
    if (this._dispatcher) {
      return this._dispatcher(value);
    }
    if (reconcileCurrentType) {
      if (reconcileCurrentType.is(value)) {
        return reconcileCurrentType;
      }
      return this._types.filter((t) => t !== reconcileCurrentType).find((type) => type.is(value));
    } else {
      return this._types.find((type) => type.is(value));
    }
  }
  isValidSnapshot(value, context) {
    if (this._dispatcher) {
      return this._dispatcher(value).validate(value, context);
    }
    const allErrors = [];
    let applicableTypes = 0;
    for (let i = 0; i < this._types.length; i++) {
      const type = this._types[i];
      const errors = type.validate(value, context);
      if (errors.length === 0) {
        if (this._eager) return typeCheckSuccess();
        else applicableTypes++;
      } else {
        allErrors.push(errors);
      }
    }
    if (applicableTypes === 1) return typeCheckSuccess();
    return typeCheckFailure(
      context,
      value,
      "No type is applicable for the union"
    ).concat(flattenTypeErrors(allErrors));
  }
  getSubTypes() {
    return this._types;
  }
};
function union(optionsOrType, ...otherTypes) {
  const options = isType(optionsOrType) ? void 0 : optionsOrType;
  const types2 = isType(optionsOrType) ? [optionsOrType, ...otherTypes] : otherTypes;
  const name = "(" + types2.map((type) => type.name).join(" | ") + ")";
  if (devMode()) {
    if (options) {
      assertArg(
        options,
        (o) => isPlainObject(o),
        "object { eager?: boolean, dispatcher?: Function }",
        1
      );
    }
    types2.forEach((type, i) => {
      assertIsType(type, options ? i + 2 : i + 1);
    });
  }
  return new Union(name, types2, options);
}
function isUnionType(type) {
  return isType(type) && (type.flags & 16384 /* Union */) > 0;
}

// src/types/utility-types/optional.ts
var OptionalValue = class extends BaseType {
  constructor(_subtype, _defaultValue, optionalValues) {
    super(_subtype.name);
    this._subtype = _subtype;
    this._defaultValue = _defaultValue;
    this.optionalValues = optionalValues;
  }
  get flags() {
    return this._subtype.flags | 512 /* Optional */;
  }
  describe() {
    return this._subtype.describe() + "?";
  }
  instantiate(parent, subpath, environment, initialValue) {
    if (this.optionalValues.indexOf(initialValue) >= 0) {
      const defaultInstanceOrSnapshot = this.getDefaultInstanceOrSnapshot();
      return this._subtype.instantiate(
        parent,
        subpath,
        environment,
        defaultInstanceOrSnapshot
      );
    }
    return this._subtype.instantiate(parent, subpath, environment, initialValue);
  }
  reconcile(current, newValue, parent, subpath) {
    return this._subtype.reconcile(
      current,
      this.optionalValues.indexOf(newValue) < 0 && this._subtype.is(newValue) ? newValue : this.getDefaultInstanceOrSnapshot(),
      parent,
      subpath
    );
  }
  getDefaultInstanceOrSnapshot() {
    const defaultInstanceOrSnapshot = typeof this._defaultValue === "function" ? this._defaultValue() : this._defaultValue;
    if (typeof this._defaultValue === "function") {
      typecheckInternal(this, defaultInstanceOrSnapshot);
    }
    return defaultInstanceOrSnapshot;
  }
  isValidSnapshot(value, context) {
    if (this.optionalValues.indexOf(value) >= 0) {
      return typeCheckSuccess();
    }
    return this._subtype.validate(value, context);
  }
  isAssignableFrom(type) {
    return this._subtype.isAssignableFrom(type);
  }
  getSubTypes() {
    return this._subtype;
  }
};
function checkOptionalPreconditions(type, defaultValueOrFunction) {
  if (typeof defaultValueOrFunction !== "function" && isStateTreeNode(defaultValueOrFunction)) {
    throw new MstError(
      "default value cannot be an instance, pass a snapshot or a function that creates an instance/snapshot instead"
    );
  }
  assertIsType(type, 1);
  if (devMode()) {
    if (typeof defaultValueOrFunction !== "function") {
      typecheckInternal(type, defaultValueOrFunction);
    }
  }
}
function optional(type, defaultValueOrFunction, optionalValues) {
  checkOptionalPreconditions(type, defaultValueOrFunction);
  return new OptionalValue(
    type,
    defaultValueOrFunction,
    optionalValues ? optionalValues : undefinedAsOptionalValues
  );
}
var undefinedAsOptionalValues = [void 0];
function isOptionalType(type) {
  return isType(type) && (type.flags & 512 /* Optional */) > 0;
}

// src/types/utility-types/maybe.ts
var optionalUndefinedType = optional(undefinedType, void 0);
var optionalNullType = optional(nullType, null);
function maybe(type) {
  assertIsType(type, 1);
  return union(type, optionalUndefinedType);
}
function maybeNull(type) {
  assertIsType(type, 1);
  return union(type, optionalNullType);
}

// src/types/utility-types/late.ts
var Late = class extends BaseType {
  constructor(name, _definition) {
    super(name);
    this._definition = _definition;
  }
  _subType;
  get flags() {
    return (this._subType ? this._subType.flags : 0) | 4096 /* Late */;
  }
  getSubType(mustSucceed) {
    if (!this._subType) {
      let t = void 0;
      try {
        t = this._definition();
      } catch (e) {
        if (e instanceof ReferenceError)
          t = void 0;
        else throw e;
      }
      if (mustSucceed && t === void 0)
        throw new MstError(
          "Late type seems to be used too early, the definition (still) returns undefined"
        );
      if (t) {
        if (devMode() && !isType(t))
          throw new MstError(
            "Failed to determine subtype, make sure types.late returns a type definition."
          );
        this._subType = t;
      }
    }
    return this._subType;
  }
  instantiate(parent, subpath, environment, initialValue) {
    return this.getSubType(true).instantiate(
      parent,
      subpath,
      environment,
      initialValue
    );
  }
  reconcile(current, newValue, parent, subpath) {
    return this.getSubType(true).reconcile(
      current,
      newValue,
      parent,
      subpath
    );
  }
  describe() {
    const t = this.getSubType(false);
    return t ? t.name : "<uknown late type>";
  }
  isValidSnapshot(value, context) {
    const t = this.getSubType(false);
    if (!t) {
      return typeCheckSuccess();
    }
    return t.validate(value, context);
  }
  isAssignableFrom(type) {
    const t = this.getSubType(false);
    return t ? t.isAssignableFrom(type) : false;
  }
  getSubTypes() {
    const subtype = this.getSubType(false);
    return subtype ? subtype : cannotDetermineSubtype;
  }
};
function late(nameOrType, maybeType) {
  const name = typeof nameOrType === "string" ? nameOrType : `late(${nameOrType.toString()})`;
  const type = typeof nameOrType === "string" ? maybeType : nameOrType;
  if (devMode()) {
    if (!(typeof type === "function" && type.length === 0))
      throw new MstError(
        "Invalid late type, expected a function with zero arguments that returns a type, got: " + type
      );
  }
  return new Late(name, type);
}
function isLateType(type) {
  return isType(type) && (type.flags & 4096 /* Late */) > 0;
}

// src/types/utility-types/lazy.ts
import { action as action7, observable as observable5, when } from "mobx";
function lazy(name, options) {
  return new Lazy(name, options);
}
var Lazy = class extends SimpleType2 {
  constructor(name, options) {
    super(name);
    this.options = options;
    when(
      () => this.pendingNodeList.length > 0 && this.pendingNodeList.some(
        (node) => node.isAlive && this.options.shouldLoadPredicate(
          node.parent ? node.parent.value : null
        )
      ),
      () => {
        this.options.loadType().then(
          action7((type) => {
            this.loadedType = type;
            this.pendingNodeList.forEach((node) => {
              if (!node.parent) return;
              if (!this.loadedType) return;
              node.parent.applyPatches([
                {
                  op: "replace",
                  path: `/${node.subpath}`,
                  value: node.snapshot
                }
              ]);
            });
          })
        );
      }
    );
  }
  flags = 1048576 /* Lazy */;
  loadedType = null;
  pendingNodeList = observable5.array();
  describe() {
    return `<lazy ${this.name}>`;
  }
  instantiate(parent, subpath, environment, value) {
    if (this.loadedType) {
      return this.loadedType.instantiate(
        parent,
        subpath,
        environment,
        value
      );
    }
    const node = createScalarNode(
      this,
      parent,
      subpath,
      environment,
      deepFreeze(value)
    );
    this.pendingNodeList.push(node);
    when(
      () => !node.isAlive,
      () => this.pendingNodeList.splice(this.pendingNodeList.indexOf(node), 1)
    );
    return node;
  }
  isValidSnapshot(value, context) {
    if (this.loadedType) {
      return this.loadedType.validate(value, context);
    }
    if (!isSerializable(value)) {
      return typeCheckFailure(
        context,
        value,
        "Value is not serializable and cannot be lazy"
      );
    }
    return typeCheckSuccess();
  }
  reconcile(current, value, parent, subpath) {
    if (this.loadedType) {
      current.die();
      return this.loadedType.instantiate(
        parent,
        subpath,
        parent.environment,
        value
      );
    }
    return super.reconcile(current, value, parent, subpath);
  }
};

// src/types/utility-types/frozen.ts
var Frozen = class extends SimpleType2 {
  constructor(subType) {
    super(subType ? `frozen(${subType.name})` : "frozen");
    this.subType = subType;
  }
  flags = 256 /* Frozen */;
  describe() {
    return "<any immutable value>";
  }
  instantiate(parent, subpath, environment, value) {
    return createScalarNode(
      this,
      parent,
      subpath,
      environment,
      deepFreeze(value)
    );
  }
  isValidSnapshot(value, context) {
    if (!isSerializable(value)) {
      return typeCheckFailure(
        context,
        value,
        "Value is not serializable and cannot be frozen"
      );
    }
    if (this.subType) return this.subType.validate(value, context);
    return typeCheckSuccess();
  }
};
var untypedFrozenInstance = new Frozen();
function frozen(arg) {
  if (arguments.length === 0) return untypedFrozenInstance;
  else if (isType(arg)) return new Frozen(arg);
  else return optional(untypedFrozenInstance, arg);
}
function isFrozenType(type) {
  return isType(type) && (type.flags & 256 /* Frozen */) > 0;
}

// src/types/utility-types/reference.ts
function getInvalidationCause(hook) {
  switch (hook) {
    case "beforeDestroy" /* beforeDestroy */:
      return "destroy";
    case "beforeDetach" /* beforeDetach */:
      return "detach";
    default:
      return void 0;
  }
}
var StoredReference = class {
  constructor(value, targetType) {
    this.targetType = targetType;
    if (isValidIdentifier(value)) {
      this.identifier = value;
    } else if (isStateTreeNode(value)) {
      const targetNode = getStateTreeNode(value);
      if (!targetNode.identifierAttribute)
        throw new MstError(
          `Can only store references with a defined identifier attribute.`
        );
      const id = targetNode.unnormalizedIdentifier;
      if (id === null || id === void 0) {
        throw new MstError(
          `Can only store references to tree nodes with a defined identifier.`
        );
      }
      this.identifier = id;
    } else {
      throw new MstError(
        `Can only store references to tree nodes or identifiers, got: '${value}'`
      );
    }
  }
  identifier;
  node;
  resolvedReference;
  updateResolvedReference(node) {
    const normalizedId = normalizeIdentifier(this.identifier);
    const root = node.root;
    const lastCacheModification = root.identifierCache.getLastCacheModificationPerId(normalizedId);
    if (!this.resolvedReference || this.resolvedReference.lastCacheModification !== lastCacheModification) {
      const { targetType } = this;
      const target = root.identifierCache.resolve(targetType, normalizedId);
      if (!target) {
        throw new InvalidReferenceError(
          `[@jbrowse/@jbrowse/mobx-state-tree] Failed to resolve reference '${this.identifier}' to type '${this.targetType.name}' (from node: ${node.path})`
        );
      }
      this.resolvedReference = {
        node: target,
        lastCacheModification
      };
    }
  }
  get resolvedValue() {
    this.updateResolvedReference(this.node);
    return this.resolvedReference.node.value;
  }
};
var InvalidReferenceError = class _InvalidReferenceError extends Error {
  constructor(m) {
    super(m);
    Object.setPrototypeOf(this, _InvalidReferenceError.prototype);
  }
};
var BaseReferenceType = class extends SimpleType2 {
  constructor(targetType, onInvalidated) {
    super(`reference(${targetType.name})`);
    this.targetType = targetType;
    this.onInvalidated = onInvalidated;
  }
  flags = 1024 /* Reference */;
  describe() {
    return this.name;
  }
  isAssignableFrom(type) {
    return this.targetType.isAssignableFrom(type);
  }
  isValidSnapshot(value, context) {
    return isValidIdentifier(value) ? typeCheckSuccess() : typeCheckFailure(
      context,
      value,
      "Value is not a valid identifier, which is a string or a number"
    );
  }
  fireInvalidated(cause, storedRefNode, referenceId, refTargetNode) {
    const storedRefParentNode = storedRefNode.parent;
    if (!storedRefParentNode || !storedRefParentNode.isAlive) {
      return;
    }
    const storedRefParentValue = storedRefParentNode.storedValue;
    if (!storedRefParentValue) {
      return;
    }
    this.onInvalidated({
      cause,
      parent: storedRefParentValue,
      invalidTarget: refTargetNode ? refTargetNode.storedValue : void 0,
      invalidId: referenceId,
      replaceRef(newRef) {
        applyPatch(storedRefNode.root.storedValue, {
          op: "replace",
          value: newRef,
          path: storedRefNode.path
        });
      },
      removeRef() {
        if (isModelType(storedRefParentNode.type)) {
          this.replaceRef(void 0);
        } else {
          applyPatch(storedRefNode.root.storedValue, {
            op: "remove",
            path: storedRefNode.path
          });
        }
      }
    });
  }
  addTargetNodeWatcher(storedRefNode, referenceId) {
    const refTargetValue = this.getValue(storedRefNode);
    if (!refTargetValue) {
      return void 0;
    }
    const refTargetNode = getStateTreeNode(refTargetValue);
    const hookHandler = (_, refTargetNodeHook) => {
      const cause = getInvalidationCause(refTargetNodeHook);
      if (!cause) {
        return;
      }
      this.fireInvalidated(cause, storedRefNode, referenceId, refTargetNode);
    };
    const refTargetDetachHookDisposer = refTargetNode.registerHook(
      "beforeDetach" /* beforeDetach */,
      hookHandler
    );
    const refTargetDestroyHookDisposer = refTargetNode.registerHook(
      "beforeDestroy" /* beforeDestroy */,
      hookHandler
    );
    return () => {
      refTargetDetachHookDisposer();
      refTargetDestroyHookDisposer();
    };
  }
  watchTargetNodeForInvalidations(storedRefNode, identifier2, customGetSet) {
    if (!this.onInvalidated) {
      return;
    }
    let onRefTargetDestroyedHookDisposer;
    storedRefNode.registerHook("beforeDestroy" /* beforeDestroy */, () => {
      if (onRefTargetDestroyedHookDisposer) {
        onRefTargetDestroyedHookDisposer();
      }
    });
    const startWatching = (sync) => {
      if (onRefTargetDestroyedHookDisposer) {
        onRefTargetDestroyedHookDisposer();
      }
      const storedRefParentNode = storedRefNode.parent;
      const storedRefParentValue = storedRefParentNode && storedRefParentNode.storedValue;
      if (storedRefParentNode && storedRefParentNode.isAlive && storedRefParentValue) {
        let refTargetNodeExists;
        if (customGetSet) {
          refTargetNodeExists = !!customGetSet.get(
            identifier2,
            storedRefParentValue
          );
        } else {
          refTargetNodeExists = storedRefNode.root.identifierCache.has(
            this.targetType,
            normalizeIdentifier(identifier2)
          );
        }
        if (!refTargetNodeExists) {
          if (!sync) {
            this.fireInvalidated(
              "invalidSnapshotReference",
              storedRefNode,
              identifier2,
              null
            );
          }
        } else {
          onRefTargetDestroyedHookDisposer = this.addTargetNodeWatcher(
            storedRefNode,
            identifier2
          );
        }
      }
    };
    if (storedRefNode.state === 2 /* FINALIZED */) {
      startWatching(true);
    } else {
      if (!storedRefNode.isRoot) {
        storedRefNode.root.registerHook("afterCreationFinalization" /* afterCreationFinalization */, () => {
          if (storedRefNode.parent) {
            storedRefNode.parent.createObservableInstanceIfNeeded();
          }
        });
      }
      storedRefNode.registerHook("afterAttach" /* afterAttach */, () => {
        startWatching(false);
      });
    }
  }
};
var IdentifierReferenceType = class extends BaseReferenceType {
  constructor(targetType, onInvalidated) {
    super(targetType, onInvalidated);
  }
  getValue(storedRefNode) {
    if (!storedRefNode.isAlive) return void 0;
    const storedRef = storedRefNode.storedValue;
    return storedRef.resolvedValue;
  }
  getSnapshot(storedRefNode) {
    const ref = storedRefNode.storedValue;
    return ref.identifier;
  }
  instantiate(parent, subpath, environment, initialValue) {
    const identifier2 = isStateTreeNode(initialValue) ? getIdentifier(initialValue) : initialValue;
    const storedRef = new StoredReference(initialValue, this.targetType);
    const storedRefNode = createScalarNode(
      this,
      parent,
      subpath,
      environment,
      storedRef
    );
    storedRef.node = storedRefNode;
    this.watchTargetNodeForInvalidations(
      storedRefNode,
      identifier2,
      void 0
    );
    return storedRefNode;
  }
  reconcile(current, newValue, parent, subpath) {
    if (!current.isDetaching && current.type === this) {
      const compareByValue = isStateTreeNode(newValue);
      const ref = current.storedValue;
      if (!compareByValue && ref.identifier === newValue || compareByValue && ref.resolvedValue === newValue) {
        current.setParent(parent, subpath);
        return current;
      }
    }
    const newNode = this.instantiate(parent, subpath, void 0, newValue);
    current.die();
    return newNode;
  }
};
var CustomReferenceType = class extends BaseReferenceType {
  constructor(targetType, options, onInvalidated) {
    super(targetType, onInvalidated);
    this.options = options;
  }
  getValue(storedRefNode) {
    if (!storedRefNode.isAlive) return void 0;
    const referencedNode = this.options.get(
      storedRefNode.storedValue,
      storedRefNode.parent ? storedRefNode.parent.storedValue : null
    );
    return referencedNode;
  }
  getSnapshot(storedRefNode) {
    return storedRefNode.storedValue;
  }
  instantiate(parent, subpath, environment, newValue) {
    const identifier2 = isStateTreeNode(newValue) ? this.options.set(newValue, parent ? parent.storedValue : null) : newValue;
    const storedRefNode = createScalarNode(
      this,
      parent,
      subpath,
      environment,
      identifier2
    );
    this.watchTargetNodeForInvalidations(
      storedRefNode,
      identifier2,
      this.options
    );
    return storedRefNode;
  }
  reconcile(current, newValue, parent, subpath) {
    const newIdentifier = isStateTreeNode(newValue) ? this.options.set(newValue, current ? current.storedValue : null) : newValue;
    if (!current.isDetaching && current.type === this && current.storedValue === newIdentifier) {
      current.setParent(parent, subpath);
      return current;
    }
    const newNode = this.instantiate(parent, subpath, void 0, newIdentifier);
    current.die();
    return newNode;
  }
};
function reference(subType, options) {
  assertIsType(subType, 1);
  if (devMode()) {
    if (arguments.length === 2 && typeof arguments[1] === "string") {
      throw new MstError(
        "References with base path are no longer supported. Please remove the base path."
      );
    }
  }
  const getSetOptions = options ? options : void 0;
  const onInvalidated = options ? options.onInvalidated : void 0;
  if (getSetOptions && (getSetOptions.get || getSetOptions.set)) {
    if (devMode()) {
      if (!getSetOptions.get || !getSetOptions.set) {
        throw new MstError(
          "reference options must either contain both a 'get' and a 'set' method or none of them"
        );
      }
    }
    return new CustomReferenceType(
      subType,
      {
        get: getSetOptions.get,
        set: getSetOptions.set
      },
      onInvalidated
    );
  } else {
    return new IdentifierReferenceType(subType, onInvalidated);
  }
}
function isReferenceType(type) {
  return isType(type) && (type.flags & 1024 /* Reference */) > 0;
}
function safeReference(subType, options) {
  const refType = reference(subType, {
    ...options,
    onInvalidated(ev) {
      if (options && options.onInvalidated) {
        options.onInvalidated(ev);
      }
      ev.removeRef();
    }
  });
  if (options && options.acceptsUndefined === false) {
    return refType;
  } else {
    return maybe(refType);
  }
}

// src/types/utility-types/identifier.ts
var BaseIdentifierType = class extends SimpleType2 {
  constructor(name, validType) {
    super(name);
    this.validType = validType;
  }
  flags = 2048 /* Identifier */;
  instantiate(parent, subpath, environment, initialValue) {
    if (!parent || !(parent.type instanceof ModelType))
      throw new MstError(
        `Identifier types can only be instantiated as direct child of a model type`
      );
    return createScalarNode(this, parent, subpath, environment, initialValue);
  }
  reconcile(current, newValue, parent, subpath) {
    if (current.storedValue !== newValue)
      throw new MstError(
        `Tried to change identifier from '${current.storedValue}' to '${newValue}'. Changing identifiers is not allowed.`
      );
    current.setParent(parent, subpath);
    return current;
  }
  isValidSnapshot(value, context) {
    if (typeof value !== this.validType) {
      return typeCheckFailure(
        context,
        value,
        `Value is not a valid ${this.describe()}, expected a ${this.validType}`
      );
    }
    return typeCheckSuccess();
  }
};
var IdentifierType = class extends BaseIdentifierType {
  flags = 2048 /* Identifier */;
  constructor() {
    super(`identifier`, "string");
  }
  describe() {
    return `identifier`;
  }
};
var IdentifierNumberType = class extends BaseIdentifierType {
  constructor() {
    super("identifierNumber", "number");
  }
  getSnapshot(node) {
    return node.storedValue;
  }
  describe() {
    return `identifierNumber`;
  }
};
var identifier = new IdentifierType();
var identifierNumber = new IdentifierNumberType();
function isIdentifierType(type) {
  return isType(type) && (type.flags & 2048 /* Identifier */) > 0;
}
function normalizeIdentifier(id) {
  return "" + id;
}
function isValidIdentifier(id) {
  return typeof id === "string" || typeof id === "number";
}
function assertIsValidIdentifier(id, argNumber) {
  assertArg(id, isValidIdentifier, "string or number (identifier)", argNumber);
}

// src/types/utility-types/custom.ts
function custom(options) {
  return new CustomType(options);
}
var CustomType = class extends SimpleType2 {
  constructor(options) {
    super(options.name);
    this.options = options;
  }
  flags = 262144 /* Custom */;
  describe() {
    return this.name;
  }
  isValidSnapshot(value, context) {
    if (this.options.isTargetType(value)) return typeCheckSuccess();
    const typeError = this.options.getValidationMessage(value);
    if (typeError) {
      return typeCheckFailure(
        context,
        value,
        `Invalid value for type '${this.name}': ${typeError}`
      );
    }
    return typeCheckSuccess();
  }
  getSnapshot(node) {
    return this.options.toSnapshot(node.storedValue);
  }
  instantiate(parent, subpath, environment, initialValue) {
    const valueToStore = this.options.isTargetType(initialValue) ? initialValue : this.options.fromSnapshot(
      initialValue,
      parent && parent.root.environment
    );
    return createScalarNode(this, parent, subpath, environment, valueToStore);
  }
  reconcile(current, value, parent, subpath) {
    const isSnapshot = !this.options.isTargetType(value);
    if (!current.isDetaching) {
      const unchanged = current.type === this && (isSnapshot ? value === current.snapshot : value === current.storedValue);
      if (unchanged) {
        current.setParent(parent, subpath);
        return current;
      }
    }
    const valueToStore = isSnapshot ? this.options.fromSnapshot(value, parent.root.environment) : value;
    const newNode = this.instantiate(parent, subpath, void 0, valueToStore);
    current.die();
    return newNode;
  }
};

// src/types/index.ts
var types = {
  enumeration,
  model,
  compose,
  custom,
  reference,
  safeReference,
  union,
  optional,
  literal,
  maybe,
  maybeNull,
  refinement,
  string,
  boolean,
  number,
  integer,
  float,
  finite,
  Date: DatePrimitive,
  map,
  array,
  frozen,
  identifier,
  identifierNumber,
  late,
  lazy,
  undefined: undefinedType,
  null: nullType,
  snapshotProcessor
};

// src/index.ts
console.log("wow new mst");
export {
  addDisposer,
  addMiddleware,
  applyAction,
  applyPatch,
  applySnapshot,
  cast,
  castFlowReturn,
  castToReferenceSnapshot,
  castToSnapshot,
  clone,
  createActionTrackingMiddleware,
  createActionTrackingMiddleware2,
  decorate,
  destroy,
  detach,
  escapeJsonPath,
  flow,
  getChildType,
  getEnv,
  getIdentifier,
  getLivelinessChecking,
  getMembers,
  getNodeId,
  getParent,
  getParentOfType,
  getPath,
  getPathParts,
  getPropertyMembers,
  getRelativePath,
  getRoot,
  getRunningActionContext,
  getSnapshot,
  getType,
  hasEnv,
  hasParent,
  hasParentOfType,
  isActionContextChildOf,
  isActionContextThisOrChildOf,
  isAlive,
  isArrayType,
  isFrozenType,
  isIdentifierType,
  isLateType,
  isLiteralType,
  isMapType,
  isModelType,
  isOptionalType,
  isPrimitiveType,
  isProtected,
  isReferenceType,
  isRefinementType,
  isRoot,
  isStateTreeNode,
  isType,
  isUnionType,
  isValidReference,
  joinJsonPath,
  onAction,
  onPatch,
  onSnapshot,
  process2 as process,
  protect,
  recordActions,
  recordPatches,
  resolveIdentifier,
  resolvePath,
  setLivelinessChecking,
  setLivelynessChecking,
  splitJsonPath,
  types as t,
  toGenerator,
  toGeneratorFunction,
  tryReference,
  tryResolve,
  typecheck,
  types,
  unescapeJsonPath,
  unprotect,
  walk
};
