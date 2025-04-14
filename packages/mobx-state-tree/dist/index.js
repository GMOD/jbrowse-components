"use strict";
function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
function _assert_this_initialized(self) {
    if (self === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
}
function _call_super(_this, derived, args) {
    derived = _get_prototype_of(derived);
    return _possible_constructor_return(_this, _is_native_reflect_construct() ? Reflect.construct(derived, args || [], _get_prototype_of(_this).constructor) : derived.apply(_this, args));
}
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _construct(Parent, args, Class) {
    if (_is_native_reflect_construct()) {
        _construct = Reflect.construct;
    } else {
        _construct = function construct(Parent, args, Class) {
            var a = [
                null
            ];
            a.push.apply(a, args);
            var Constructor = Function.bind.apply(Parent, a);
            var instance = new Constructor();
            if (Class) _set_prototype_of(instance, Class.prototype);
            return instance;
        };
    }
    return _construct.apply(null, arguments);
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _create_class(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
}
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _get(target, property, receiver) {
    if (typeof Reflect !== "undefined" && Reflect.get) {
        _get = Reflect.get;
    } else {
        _get = function get(target, property, receiver) {
            var base = _super_prop_base(target, property);
            if (!base) return;
            var desc = Object.getOwnPropertyDescriptor(base, property);
            if (desc.get) {
                return desc.get.call(receiver || target);
            }
            return desc.value;
        };
    }
    return _get(target, property, receiver || target);
}
function _get_prototype_of(o) {
    _get_prototype_of = Object.setPrototypeOf ? Object.getPrototypeOf : function getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _get_prototype_of(o);
}
function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            writable: true,
            configurable: true
        }
    });
    if (superClass) _set_prototype_of(subClass, superClass);
}
function _instanceof(left, right) {
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
}
function _is_native_function(fn) {
    return Function.toString.call(fn).indexOf("[native code]") !== -1;
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}
function _iterable_to_array_limit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _non_iterable_rest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
                return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function _object_without_properties(source, excluded) {
    if (source == null) return {};
    var target = _object_without_properties_loose(source, excluded);
    var key, i;
    if (Object.getOwnPropertySymbols) {
        var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
        for(i = 0; i < sourceSymbolKeys.length; i++){
            key = sourceSymbolKeys[i];
            if (excluded.indexOf(key) >= 0) continue;
            if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
            target[key] = source[key];
        }
    }
    return target;
}
function _object_without_properties_loose(source, excluded) {
    if (source == null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key, i;
    for(i = 0; i < sourceKeys.length; i++){
        key = sourceKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        target[key] = source[key];
    }
    return target;
}
function _possible_constructor_return(self, call) {
    if (call && (_type_of(call) === "object" || typeof call === "function")) {
        return call;
    }
    return _assert_this_initialized(self);
}
function _set_prototype_of(o, p) {
    _set_prototype_of = Object.setPrototypeOf || function setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _set_prototype_of(o, p);
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _super_prop_base(object, property) {
    while(!Object.prototype.hasOwnProperty.call(object, property)){
        object = _get_prototype_of(object);
        if (object === null) break;
    }
    return object;
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
function _wrap_native_super(Class) {
    var _cache = typeof Map === "function" ? new Map() : undefined;
    _wrap_native_super = function wrapNativeSuper(Class) {
        if (Class === null || !_is_native_function(Class)) return Class;
        if (typeof Class !== "function") {
            throw new TypeError("Super expression must either be null or a function");
        }
        if (typeof _cache !== "undefined") {
            if (_cache.has(Class)) return _cache.get(Class);
            _cache.set(Class, Wrapper);
        }
        function Wrapper() {
            return _construct(Class, arguments, _get_prototype_of(this).constructor);
        }
        Wrapper.prototype = Object.create(Class.prototype, {
            constructor: {
                value: Wrapper,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        return _set_prototype_of(Wrapper, Class);
    };
    return _wrap_native_super(Class);
}
function _is_native_reflect_construct() {
    try {
        var result = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (_) {}
    return (_is_native_reflect_construct = function() {
        return !!result;
    })();
}
function _ts_generator(thisArg, body) {
    var f, y, t1, g, _ = {
        label: 0,
        sent: function() {
            if (t1[0] & 1) throw t1[1];
            return t1[1];
        },
        trys: [],
        ops: []
    };
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t1 = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t1 = y["return"]) && t1.call(y), 0) : y.next) && !(t1 = t1.call(y, op[1])).done) return t1;
            if (y = 0, t1) op = [
                op[0] & 2,
                t1.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t1 = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t1 = _.trys, t1 = t1.length > 0 && t1[t1.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t1 || op[1] > t1[0] && op[1] < t1[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t1[1]) {
                        _.label = t1[1];
                        t1 = op;
                        break;
                    }
                    if (t1 && _.label < t1[2]) {
                        _.label = t1[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t1[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t1 = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = function(obj, key, value) {
    return key in obj ? __defProp(obj, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value: value
    }) : obj[key] = value;
};
var __export = function(target, all) {
    for(var name in all)__defProp(target, name, {
        get: all[name],
        enumerable: true
    });
};
var __copyProps = function(to, from, except, desc) {
    if (from && (typeof from === "undefined" ? "undefined" : _type_of(from)) === "object" || typeof from === "function") {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            var _loop = function() {
                var key = _step.value;
                if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
                    get: function() {
                        return from[key];
                    },
                    enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
                });
            };
            for(var _iterator = __getOwnPropNames(from)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    }
    return to;
};
var __toCommonJS = function(mod) {
    return __copyProps(__defProp({}, "__esModule", {
        value: true
    }), mod);
};
var __publicField = function(obj, key, value) {
    return __defNormalProp(obj, (typeof key === "undefined" ? "undefined" : _type_of(key)) !== "symbol" ? key + "" : key, value);
};
// src/index.ts
var index_exports = {};
__export(index_exports, {
    addDisposer: function() {
        return addDisposer;
    },
    addMiddleware: function() {
        return addMiddleware;
    },
    applyAction: function() {
        return applyAction;
    },
    applyPatch: function() {
        return applyPatch;
    },
    applySnapshot: function() {
        return applySnapshot;
    },
    cast: function() {
        return cast;
    },
    castFlowReturn: function() {
        return castFlowReturn;
    },
    castToReferenceSnapshot: function() {
        return castToReferenceSnapshot;
    },
    castToSnapshot: function() {
        return castToSnapshot;
    },
    clone: function() {
        return clone;
    },
    createActionTrackingMiddleware: function() {
        return createActionTrackingMiddleware;
    },
    createActionTrackingMiddleware2: function() {
        return createActionTrackingMiddleware2;
    },
    decorate: function() {
        return decorate;
    },
    destroy: function() {
        return destroy;
    },
    detach: function() {
        return detach;
    },
    escapeJsonPath: function() {
        return escapeJsonPath;
    },
    flow: function() {
        return flow;
    },
    getChildType: function() {
        return getChildType;
    },
    getEnv: function() {
        return getEnv;
    },
    getIdentifier: function() {
        return getIdentifier;
    },
    getLivelinessChecking: function() {
        return getLivelinessChecking;
    },
    getMembers: function() {
        return getMembers;
    },
    getNodeId: function() {
        return getNodeId;
    },
    getParent: function() {
        return getParent;
    },
    getParentOfType: function() {
        return getParentOfType;
    },
    getPath: function() {
        return getPath;
    },
    getPathParts: function() {
        return getPathParts;
    },
    getPropertyMembers: function() {
        return getPropertyMembers;
    },
    getRelativePath: function() {
        return getRelativePath;
    },
    getRoot: function() {
        return getRoot;
    },
    getRunningActionContext: function() {
        return getRunningActionContext;
    },
    getSnapshot: function() {
        return getSnapshot;
    },
    getType: function() {
        return getType;
    },
    hasParent: function() {
        return hasParent;
    },
    hasParentOfType: function() {
        return hasParentOfType;
    },
    isActionContextChildOf: function() {
        return isActionContextChildOf;
    },
    isActionContextThisOrChildOf: function() {
        return isActionContextThisOrChildOf;
    },
    isAlive: function() {
        return isAlive;
    },
    isArrayType: function() {
        return isArrayType;
    },
    isFrozenType: function() {
        return isFrozenType;
    },
    isIdentifierType: function() {
        return isIdentifierType;
    },
    isLateType: function() {
        return isLateType;
    },
    isLiteralType: function() {
        return isLiteralType;
    },
    isMapType: function() {
        return isMapType;
    },
    isModelType: function() {
        return isModelType;
    },
    isOptionalType: function() {
        return isOptionalType;
    },
    isPrimitiveType: function() {
        return isPrimitiveType;
    },
    isProtected: function() {
        return isProtected;
    },
    isReferenceType: function() {
        return isReferenceType;
    },
    isRefinementType: function() {
        return isRefinementType;
    },
    isRoot: function() {
        return isRoot;
    },
    isStateTreeNode: function() {
        return isStateTreeNode;
    },
    isType: function() {
        return isType;
    },
    isUnionType: function() {
        return isUnionType;
    },
    isValidReference: function() {
        return isValidReference;
    },
    joinJsonPath: function() {
        return joinJsonPath;
    },
    onAction: function() {
        return onAction;
    },
    onPatch: function() {
        return onPatch;
    },
    onSnapshot: function() {
        return onSnapshot;
    },
    process: function() {
        return process2;
    },
    protect: function() {
        return protect;
    },
    recordActions: function() {
        return recordActions;
    },
    recordPatches: function() {
        return recordPatches;
    },
    resolveIdentifier: function() {
        return resolveIdentifier;
    },
    resolvePath: function() {
        return resolvePath;
    },
    setLivelinessChecking: function() {
        return setLivelinessChecking;
    },
    setLivelynessChecking: function() {
        return setLivelynessChecking;
    },
    splitJsonPath: function() {
        return splitJsonPath;
    },
    t: function() {
        return types;
    },
    toGenerator: function() {
        return toGenerator;
    },
    toGeneratorFunction: function() {
        return toGeneratorFunction;
    },
    tryReference: function() {
        return tryReference;
    },
    tryResolve: function() {
        return tryResolve;
    },
    typecheck: function() {
        return typecheck;
    },
    types: function() {
        return types;
    },
    unescapeJsonPath: function() {
        return unescapeJsonPath;
    },
    unprotect: function() {
        return unprotect;
    },
    walk: function() {
        return walk;
    }
});
module.exports = __toCommonJS(index_exports);
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
var Hook = /* @__PURE__ */ function(Hook3) {
    Hook3["afterCreate"] = "afterCreate";
    Hook3["afterAttach"] = "afterAttach";
    Hook3["afterCreationFinalization"] = "afterCreationFinalization";
    Hook3["beforeDetach"] = "beforeDetach";
    Hook3["beforeDestroy"] = "beforeDestroy";
    return Hook3;
}(Hook || {});
// src/core/mst-operations.ts
var import_mobx = require("mobx");
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
    assertArg(patch, function(p) {
        return (typeof p === "undefined" ? "undefined" : _type_of(p)) === "object";
    }, "object or array", 2);
    getStateTreeNode(target).applyPatches(asArray(patch));
}
function recordPatches(subject, filter) {
    assertIsStateTreeNode(subject, 1);
    var data = {
        patches: [],
        inversePatches: []
    };
    var publicData = {};
    var disposer;
    var recorder = {
        get recording () {
            return !!disposer;
        },
        get patches () {
            if (!publicData.patches) {
                publicData.patches = data.patches.slice();
            }
            return publicData.patches;
        },
        get reversedInversePatches () {
            if (!publicData.reversedInversePatches) {
                publicData.reversedInversePatches = data.inversePatches.slice().reverse();
            }
            return publicData.reversedInversePatches;
        },
        get inversePatches () {
            if (!publicData.inversePatches) {
                publicData.inversePatches = data.inversePatches.slice();
            }
            return publicData.inversePatches;
        },
        stop: function stop() {
            if (disposer) {
                disposer();
                disposer = void 0;
            }
        },
        resume: function resume() {
            if (disposer) return;
            disposer = onPatch(subject, function(patch, inversePatch) {
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
        replay: function replay(target) {
            applyPatch(target || subject, data.patches);
        },
        undo: function undo(target) {
            applyPatch(target || subject, data.inversePatches.slice().reverse());
        }
    };
    recorder.resume();
    return recorder;
}
function protect(target) {
    assertIsStateTreeNode(target, 1);
    var node = getStateTreeNode(target);
    if (!node.isRoot) throw fail("`protect` can only be invoked on root nodes");
    node.isProtectionEnabled = true;
}
function unprotect(target) {
    assertIsStateTreeNode(target, 1);
    var node = getStateTreeNode(target);
    if (!node.isRoot) throw fail("`unprotect` can only be invoked on root nodes");
    node.isProtectionEnabled = false;
}
function isProtected(target) {
    return getStateTreeNode(target).isProtected;
}
function applySnapshot(target, snapshot) {
    assertIsStateTreeNode(target, 1);
    return getStateTreeNode(target).applySnapshot(snapshot);
}
function getSnapshot(target) {
    var applyPostProcess = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
    assertIsStateTreeNode(target, 1);
    var node = getStateTreeNode(target);
    if (applyPostProcess) return node.snapshot;
    return freeze(node.type.getSnapshot(node, false));
}
function hasParent(target) {
    var depth = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
    assertIsStateTreeNode(target, 1);
    assertIsNumber(depth, 2, 0);
    var parent = getStateTreeNode(target).parent;
    while(parent){
        if (--depth === 0) return true;
        parent = parent.parent;
    }
    return false;
}
function getParent(target) {
    var depth = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
    assertIsStateTreeNode(target, 1);
    assertIsNumber(depth, 2, 0);
    var d = depth;
    var parent = getStateTreeNode(target).parent;
    while(parent){
        if (--d === 0) return parent.storedValue;
        parent = parent.parent;
    }
    throw fail("Failed to find the parent of ".concat(getStateTreeNode(target), " at depth ").concat(depth));
}
function hasParentOfType(target, type) {
    assertIsStateTreeNode(target, 1);
    assertIsType(type, 2);
    var parent = getStateTreeNode(target).parent;
    while(parent){
        if (type.is(parent.storedValue)) return true;
        parent = parent.parent;
    }
    return false;
}
function getParentOfType(target, type) {
    assertIsStateTreeNode(target, 1);
    assertIsType(type, 2);
    var parent = getStateTreeNode(target).parent;
    while(parent){
        if (type.is(parent.storedValue)) return parent.storedValue;
        parent = parent.parent;
    }
    throw fail("Failed to find the parent of ".concat(getStateTreeNode(target), " of a given type"));
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
    var node = resolveNodeByPath(getStateTreeNode(target), path);
    return node ? node.value : void 0;
}
function resolveIdentifier(type, target, identifier2) {
    assertIsType(type, 1);
    assertIsStateTreeNode(target, 2);
    assertIsValidIdentifier(identifier2, 3);
    var node = getStateTreeNode(target).root.identifierCache.resolve(type, normalizeIdentifier(identifier2));
    return node === null || node === void 0 ? void 0 : node.value;
}
function getIdentifier(target) {
    assertIsStateTreeNode(target, 1);
    return getStateTreeNode(target).identifier;
}
function tryReference(getter) {
    var checkIfAlive = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
    try {
        var node = getter();
        if (node === void 0 || node === null) {
            return void 0;
        } else if (isStateTreeNode(node)) {
            if (!checkIfAlive) {
                return node;
            } else {
                return isAlive(node) ? node : void 0;
            }
        } else {
            throw fail("The reference to be checked is not one of node, null or undefined");
        }
    } catch (e) {
        if (_instanceof(e, InvalidReferenceError)) {
            return void 0;
        }
        throw e;
    }
}
function isValidReference(getter) {
    var checkIfAlive = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
    try {
        var node = getter();
        if (node === void 0 || node === null) {
            return false;
        } else if (isStateTreeNode(node)) {
            return checkIfAlive ? isAlive(node) : true;
        } else {
            throw fail("The reference to be checked is not one of node, null or undefined");
        }
    } catch (e) {
        if (_instanceof(e, InvalidReferenceError)) {
            return false;
        }
        throw e;
    }
}
function tryResolve(target, path) {
    assertIsStateTreeNode(target, 1);
    assertIsString(path, 2);
    var node = resolveNodeByPath(getStateTreeNode(target), path, false);
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
    return getRelativePathBetweenNodes(getStateTreeNode(base), getStateTreeNode(target));
}
function clone(source) {
    var keepEnvironment = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
    assertIsStateTreeNode(source, 1);
    var node = getStateTreeNode(source);
    return node.type.create(node.snapshot, keepEnvironment === true ? node.root.environment : keepEnvironment === false ? void 0 : keepEnvironment);
}
function detach(target) {
    assertIsStateTreeNode(target, 1);
    getStateTreeNode(target).detach();
    return target;
}
function destroy(target) {
    assertIsStateTreeNode(target, 1);
    var node = getStateTreeNode(target);
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
    var node = getStateTreeNode(target);
    node.addDisposer(disposer);
    return disposer;
}
function getEnv(target) {
    assertIsStateTreeNode(target, 1);
    var node = getStateTreeNode(target);
    var env = node.root.environment;
    if (!env) return EMPTY_OBJECT;
    return env;
}
function walk(target, processor) {
    assertIsStateTreeNode(target, 1);
    assertIsFunction(processor, 2);
    var node = getStateTreeNode(target);
    node.getChildren().forEach(function(child) {
        if (isStateTreeNode(child.storedValue)) walk(child.storedValue, processor);
    });
    processor(node.storedValue);
}
function getPropertyMembers(typeOrNode) {
    var type;
    if (isStateTreeNode(typeOrNode)) {
        type = getType(typeOrNode);
    } else {
        type = typeOrNode;
    }
    assertArg(type, function(t1) {
        return isModelType(t1);
    }, "model type or model instance", 1);
    return {
        name: type.name,
        properties: _object_spread({}, type.properties)
    };
}
function getMembers(target) {
    var type = getStateTreeNode(target).type;
    var reflected = _object_spread_props(_object_spread({}, getPropertyMembers(type)), {
        actions: [],
        volatile: [],
        views: [],
        flowActions: []
    });
    var props = Object.getOwnPropertyNames(target);
    props.forEach(function(key) {
        if (key in reflected.properties) return;
        var descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (descriptor.get) {
            if ((0, import_mobx.isComputedProp)(target, key)) reflected.views.push(key);
            else reflected.volatile.push(key);
            return;
        }
        if (descriptor.value._isFlowAction === true) {
            reflected.flowActions.push(key);
        }
        if (descriptor.value._isMSTAction === true) {
            reflected.actions.push(key);
        } else if ((0, import_mobx.isObservableProp)(target, key)) {
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
var import_mobx2 = require("mobx");
var BaseNode = /*#__PURE__*/ function() {
    function BaseNode(type, parent, subpath, environment) {
        _class_call_check(this, BaseNode);
        this.type = type;
        this.environment = environment;
        __publicField(this, "_escapedSubpath");
        __publicField(this, "_subpath");
        __publicField(this, "_subpathUponDeath");
        __publicField(this, "_pathUponDeath");
        __publicField(this, "storedValue");
        __publicField(this, "aliveAtom");
        __publicField(this, "_state", 0 /* INITIALIZING */ );
        __publicField(this, "_hookSubscribers");
        __publicField(this, "_parent");
        __publicField(this, "pathAtom");
        this.environment = environment;
        this.baseSetParent(parent, subpath);
    }
    _create_class(BaseNode, [
        {
            key: "subpath",
            get: function get() {
                return this._subpath;
            }
        },
        {
            key: "subpathUponDeath",
            get: function get() {
                return this._subpathUponDeath;
            }
        },
        {
            key: "pathUponDeath",
            get: function get() {
                return this._pathUponDeath;
            }
        },
        {
            key: "value",
            get: // usually the same type as the value, but not always (such as with references)
            function get() {
                return this.type.getValue(this);
            }
        },
        {
            key: "state",
            get: function get() {
                return this._state;
            },
            set: function set(val) {
                var wasAlive = this.isAlive;
                this._state = val;
                var isAlive2 = this.isAlive;
                if (this.aliveAtom && wasAlive !== isAlive2) {
                    this.aliveAtom.reportChanged();
                }
            }
        },
        {
            key: "fireInternalHook",
            value: function fireInternalHook(name) {
                if (this._hookSubscribers) {
                    this._hookSubscribers.emit(name, this, name);
                }
            }
        },
        {
            key: "registerHook",
            value: function registerHook(hook, hookHandler) {
                if (!this._hookSubscribers) {
                    this._hookSubscribers = new EventHandlers();
                }
                return this._hookSubscribers.register(hook, hookHandler);
            }
        },
        {
            key: "parent",
            get: function get() {
                return this._parent;
            }
        },
        {
            key: "getReconciliationType",
            value: function getReconciliationType() {
                return this.type;
            }
        },
        {
            key: "baseSetParent",
            value: function baseSetParent(parent, subpath) {
                this._parent = parent;
                this._subpath = subpath;
                this._escapedSubpath = void 0;
                if (this.pathAtom) {
                    this.pathAtom.reportChanged();
                }
            }
        },
        {
            key: "path",
            get: /*
   * Returns (escaped) path representation as string
   */ function get() {
                return this.getEscapedPath(true);
            }
        },
        {
            key: "getEscapedPath",
            value: function getEscapedPath(reportObserved) {
                if (reportObserved) {
                    if (!this.pathAtom) {
                        this.pathAtom = (0, import_mobx2.createAtom)("path");
                    }
                    this.pathAtom.reportObserved();
                }
                if (!this.parent) return "";
                if (this._escapedSubpath === void 0) {
                    this._escapedSubpath = !this._subpath ? "" : escapeJsonPath(this._subpath);
                }
                return this.parent.getEscapedPath(reportObserved) + "/" + this._escapedSubpath;
            }
        },
        {
            key: "isRoot",
            get: function get() {
                return this.parent === null;
            }
        },
        {
            key: "isAlive",
            get: function get() {
                return this.state !== 4 /* DEAD */ ;
            }
        },
        {
            key: "isDetaching",
            get: function get() {
                return this.state === 3 /* DETACHING */ ;
            }
        },
        {
            key: "observableIsAlive",
            get: function get() {
                if (!this.aliveAtom) {
                    this.aliveAtom = (0, import_mobx2.createAtom)("alive");
                }
                this.aliveAtom.reportObserved();
                return this.isAlive;
            }
        },
        {
            key: "baseFinalizeCreation",
            value: function baseFinalizeCreation(whenFinalized) {
                if (devMode()) {
                    if (!this.isAlive) {
                        throw fail("assertion failed: cannot finalize the creation of a node that is already dead");
                    }
                }
                if (this.state === 1 /* CREATED */ ) {
                    if (this.parent) {
                        if (this.parent.state !== 2 /* FINALIZED */ ) {
                            return;
                        }
                        this.fireHook("afterAttach" /* afterAttach */ );
                    }
                    this.state = 2 /* FINALIZED */ ;
                    if (whenFinalized) {
                        whenFinalized();
                    }
                }
            }
        },
        {
            key: "baseFinalizeDeath",
            value: function baseFinalizeDeath() {
                if (this._hookSubscribers) {
                    this._hookSubscribers.clearAll();
                }
                this._subpathUponDeath = this._subpath;
                this._pathUponDeath = this.getEscapedPath(false);
                this.baseSetParent(null, "");
                this.state = 4 /* DEAD */ ;
            }
        },
        {
            key: "baseAboutToDie",
            value: function baseAboutToDie() {
                this.fireHook("beforeDestroy" /* beforeDestroy */ );
            }
        }
    ]);
    return BaseNode;
}();
// src/core/node/scalar-node.ts
var import_mobx3 = require("mobx");
var ScalarNode = /*#__PURE__*/ function(BaseNode) {
    _inherits(ScalarNode, BaseNode);
    function ScalarNode(simpleType, parent, subpath, environment, initialSnapshot) {
        _class_call_check(this, ScalarNode);
        var _this;
        _this = _call_super(this, ScalarNode, [
            simpleType,
            parent,
            subpath,
            environment
        ]);
        try {
            _this.storedValue = simpleType.createNewInstance(initialSnapshot);
        } catch (e) {
            _this.state = 4 /* DEAD */ ;
            throw e;
        }
        _this.state = 1 /* CREATED */ ;
        _this.finalizeCreation();
        return _this;
    }
    _create_class(ScalarNode, [
        {
            key: "root",
            get: function get() {
                if (!this.parent) throw fail("This scalar node is not part of a tree");
                return this.parent.root;
            }
        },
        {
            key: "setParent",
            value: function setParent(newParent, subpath) {
                var parentChanged = this.parent !== newParent;
                var subpathChanged = this.subpath !== subpath;
                if (!parentChanged && !subpathChanged) {
                    return;
                }
                if (devMode()) {
                    if (!subpath) {
                        throw fail("assertion failed: subpath expected");
                    }
                    if (!newParent) {
                        throw fail("assertion failed: parent expected");
                    }
                    if (parentChanged) {
                        throw fail("assertion failed: scalar nodes cannot change their parent");
                    }
                }
                this.environment = void 0;
                this.baseSetParent(this.parent, subpath);
            }
        },
        {
            key: "snapshot",
            get: function get() {
                return freeze(this.getSnapshot());
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot() {
                return this.type.getSnapshot(this);
            }
        },
        {
            key: "toString",
            value: function toString() {
                var path = (this.isAlive ? this.path : this.pathUponDeath) || "<root>";
                return "".concat(this.type.name, "@").concat(path).concat(this.isAlive ? "" : " [dead]");
            }
        },
        {
            key: "die",
            value: function die() {
                if (!this.isAlive || this.state === 3 /* DETACHING */ ) return;
                this.aboutToDie();
                this.finalizeDeath();
            }
        },
        {
            key: "finalizeCreation",
            value: function finalizeCreation() {
                this.baseFinalizeCreation();
            }
        },
        {
            key: "aboutToDie",
            value: function aboutToDie() {
                this.baseAboutToDie();
            }
        },
        {
            key: "finalizeDeath",
            value: function finalizeDeath() {
                this.baseFinalizeDeath();
            }
        },
        {
            key: "fireHook",
            value: function fireHook(name) {
                this.fireInternalHook(name);
            }
        }
    ]);
    return ScalarNode;
}(BaseNode);
ScalarNode.prototype.die = (0, import_mobx3.action)(ScalarNode.prototype.die);
// src/core/node/object-node.ts
var import_mobx4 = require("mobx");
var nextNodeId = 1;
var snapshotReactionOptions = {
    onError: function onError(e) {
        throw e;
    }
};
var ObjectNode = /*#__PURE__*/ function(BaseNode) {
    _inherits(ObjectNode, BaseNode);
    function ObjectNode(complexType, parent, subpath, environment, initialValue) {
        _class_call_check(this, ObjectNode);
        var _this;
        _this = _call_super(this, ObjectNode, [
            complexType,
            parent,
            subpath,
            environment
        ]);
        __publicField(_this, "nodeId", ++nextNodeId);
        __publicField(_this, "identifierAttribute");
        __publicField(_this, "identifier");
        // Identifier is always normalized to string, even if the identifier property isn't
        __publicField(_this, "unnormalizedIdentifier");
        __publicField(_this, "identifierCache");
        __publicField(_this, "isProtectionEnabled", true);
        __publicField(_this, "middlewares");
        __publicField(_this, "hasSnapshotPostProcessor", false);
        __publicField(_this, "_applyPatches");
        __publicField(_this, "_applySnapshot");
        __publicField(_this, "_autoUnbox", true);
        // unboxing is disabled when reading child nodes
        __publicField(_this, "_isRunningAction", false);
        // only relevant for root
        __publicField(_this, "_hasSnapshotReaction", false);
        __publicField(_this, "_observableInstanceState", 0 /* UNINITIALIZED */ );
        __publicField(_this, "_childNodes");
        __publicField(_this, "_initialSnapshot");
        __publicField(_this, "_cachedInitialSnapshot");
        __publicField(_this, "_cachedInitialSnapshotCreated", false);
        __publicField(_this, "_snapshotComputed");
        __publicField(_this, "_snapshotUponDeath");
        // #region internal event handling
        __publicField(_this, "_internalEvents");
        _this._snapshotComputed = (0, import_mobx4.computed)(function() {
            return freeze(_this.getSnapshot());
        });
        _this.unbox = _this.unbox.bind(_this);
        _this._initialSnapshot = freeze(initialValue);
        _this.identifierAttribute = complexType.identifierAttribute;
        if (!parent) {
            _this.identifierCache = new IdentifierCache();
        }
        _this._childNodes = complexType.initializeChildNodes(_this, _this._initialSnapshot);
        _this.identifier = null;
        _this.unnormalizedIdentifier = null;
        if (_this.identifierAttribute && _this._initialSnapshot) {
            var id = _this._initialSnapshot[_this.identifierAttribute];
            if (id === void 0) {
                var childNode = _this._childNodes[_this.identifierAttribute];
                if (childNode) {
                    id = childNode.value;
                }
            }
            if (typeof id !== "string" && typeof id !== "number") {
                throw fail("Instance identifier '".concat(_this.identifierAttribute, "' for type '").concat(_this.type.name, "' must be a string or a number"));
            }
            _this.identifier = normalizeIdentifier(id);
            _this.unnormalizedIdentifier = id;
        }
        if (!parent) {
            _this.identifierCache.addNodeToCache(_this);
        } else {
            parent.root.identifierCache.addNodeToCache(_this);
        }
        return _this;
    }
    _create_class(ObjectNode, [
        {
            key: "applyPatches",
            value: function applyPatches(patches) {
                this.createObservableInstanceIfNeeded();
                this._applyPatches(patches);
            }
        },
        {
            key: "applySnapshot",
            value: function applySnapshot(snapshot) {
                this.createObservableInstanceIfNeeded();
                this._applySnapshot(snapshot);
            }
        },
        {
            key: "createObservableInstanceIfNeeded",
            value: function createObservableInstanceIfNeeded() {
                var fireHooks = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : true;
                if (this._observableInstanceState === 0 /* UNINITIALIZED */ ) {
                    this.createObservableInstance(fireHooks);
                }
            }
        },
        {
            key: "createObservableInstance",
            value: function createObservableInstance() {
                var fireHooks = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : true;
                if (devMode()) {
                    if (this.state !== 0 /* INITIALIZING */ ) {
                        throw fail("assertion failed: the creation of the observable instance must be done on the initializing phase");
                    }
                }
                this._observableInstanceState = 1 /* CREATING */ ;
                var parentChain = [];
                var parent = this.parent;
                while(parent && parent._observableInstanceState === 0 /* UNINITIALIZED */ ){
                    parentChain.unshift(parent);
                    parent = parent.parent;
                }
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = parentChain[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var p = _step.value;
                        p.createObservableInstanceIfNeeded(false);
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally{
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }
                var type = this.type;
                try {
                    this.storedValue = type.createNewInstance(this._childNodes);
                    this.preboot();
                    this._isRunningAction = true;
                    type.finalizeNewInstance(this, this.storedValue);
                } catch (e) {
                    this.state = 4 /* DEAD */ ;
                    throw e;
                } finally{
                    this._isRunningAction = false;
                }
                this._observableInstanceState = 2 /* CREATED */ ;
                this._snapshotComputed.trackAndCompute();
                if (this.isRoot) this._addSnapshotReaction();
                this._childNodes = EMPTY_OBJECT;
                this.state = 1 /* CREATED */ ;
                if (fireHooks) {
                    this.fireHook("afterCreate" /* afterCreate */ );
                    this.finalizeCreation();
                    var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                    try {
                        for(var _iterator1 = parentChain.reverse()[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                            var p1 = _step1.value;
                            p1.fireHook("afterCreate" /* afterCreate */ );
                            p1.finalizeCreation();
                        }
                    } catch (err) {
                        _didIteratorError1 = true;
                        _iteratorError1 = err;
                    } finally{
                        try {
                            if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                                _iterator1.return();
                            }
                        } finally{
                            if (_didIteratorError1) {
                                throw _iteratorError1;
                            }
                        }
                    }
                }
            }
        },
        {
            key: "root",
            get: function get() {
                var parent = this.parent;
                return parent ? parent.root : this;
            }
        },
        {
            key: "clearParent",
            value: function clearParent() {
                if (!this.parent) return;
                this.fireHook("beforeDetach" /* beforeDetach */ );
                var previousState = this.state;
                this.state = 3 /* DETACHING */ ;
                var root = this.root;
                var newEnv = root.environment;
                var newIdCache = root.identifierCache.splitCache(this);
                try {
                    this.parent.removeChild(this.subpath);
                    this.baseSetParent(null, "");
                    this.environment = newEnv;
                    this.identifierCache = newIdCache;
                } finally{
                    this.state = previousState;
                }
            }
        },
        {
            key: "setParent",
            value: function setParent(newParent, subpath) {
                var parentChanged = newParent !== this.parent;
                var subpathChanged = subpath !== this.subpath;
                if (!parentChanged && !subpathChanged) {
                    return;
                }
                if (devMode()) {
                    if (!subpath) {
                        throw fail("assertion failed: subpath expected");
                    }
                    if (!newParent) {
                        throw fail("assertion failed: new parent expected");
                    }
                    if (this.parent && parentChanged) {
                        throw fail("A node cannot exists twice in the state tree. Failed to add ".concat(this, " to path '").concat(newParent.path, "/").concat(subpath, "'."));
                    }
                    if (!this.parent && newParent.root === this) {
                        throw fail("A state tree is not allowed to contain itself. Cannot assign ".concat(this, " to path '").concat(newParent.path, "/").concat(subpath, "'"));
                    }
                    if (!this.parent && !!this.environment && this.environment !== newParent.root.environment) {
                        throw fail("A state tree cannot be made part of another state tree as long as their environments are different.");
                    }
                }
                if (parentChanged) {
                    this.environment = void 0;
                    newParent.root.identifierCache.mergeCache(this);
                    this.baseSetParent(newParent, subpath);
                    this.fireHook("afterAttach" /* afterAttach */ );
                } else if (subpathChanged) {
                    this.baseSetParent(this.parent, subpath);
                }
            }
        },
        {
            key: "fireHook",
            value: function fireHook(name) {
                var _this = this;
                this.fireInternalHook(name);
                var fn = this.storedValue && _type_of(this.storedValue) === "object" && this.storedValue[name];
                if (typeof fn === "function") {
                    if (import_mobx4._allowStateChangesInsideComputed) {
                        (0, import_mobx4._allowStateChangesInsideComputed)(function() {
                            fn.apply(_this.storedValue);
                        });
                    } else {
                        fn.apply(this.storedValue);
                    }
                }
            }
        },
        {
            key: "snapshot",
            get: // advantage of using computed for a snapshot is that nicely respects transactions etc.
            function get() {
                if (this.hasSnapshotPostProcessor) {
                    this.createObservableInstanceIfNeeded();
                }
                return this._snapshotComputed.get();
            }
        },
        {
            // NOTE: we use this method to get snapshot without creating @computed overhead
            key: "getSnapshot",
            value: function getSnapshot() {
                if (!this.isAlive) return this._snapshotUponDeath;
                return this._observableInstanceState === 2 /* CREATED */  ? this._getActualSnapshot() : this._getCachedInitialSnapshot();
            }
        },
        {
            key: "_getActualSnapshot",
            value: function _getActualSnapshot() {
                return this.type.getSnapshot(this);
            }
        },
        {
            key: "_getCachedInitialSnapshot",
            value: function _getCachedInitialSnapshot() {
                if (!this._cachedInitialSnapshotCreated) {
                    var type = this.type;
                    var childNodes = this._childNodes;
                    var snapshot = this._initialSnapshot;
                    this._cachedInitialSnapshot = type.processInitialSnapshot(childNodes, snapshot);
                    this._cachedInitialSnapshotCreated = true;
                }
                return this._cachedInitialSnapshot;
            }
        },
        {
            key: "isRunningAction",
            value: function isRunningAction() {
                if (this._isRunningAction) return true;
                if (this.isRoot) return false;
                return this.parent.isRunningAction();
            }
        },
        {
            key: "assertAlive",
            value: function assertAlive(context) {
                var livelinessChecking2 = getLivelinessChecking();
                if (!this.isAlive && livelinessChecking2 !== "ignore") {
                    var error = this._getAssertAliveError(context);
                    switch(livelinessChecking2){
                        case "error":
                            throw fail(error);
                        case "warn":
                            warnError(error);
                    }
                }
            }
        },
        {
            key: "_getAssertAliveError",
            value: function _getAssertAliveError(context) {
                var escapedPath = this.getEscapedPath(false) || this.pathUponDeath || "";
                var subpath = context.subpath && escapeJsonPath(context.subpath) || "";
                var actionContext = context.actionContext || getCurrentActionContext();
                if (actionContext && actionContext.type !== "action" && actionContext.parentActionEvent) {
                    actionContext = actionContext.parentActionEvent;
                }
                var actionFullPath = "";
                if (actionContext && actionContext.name != null) {
                    var actionPath = actionContext && actionContext.context && getPath(actionContext.context) || escapedPath;
                    actionFullPath = "".concat(actionPath, ".").concat(actionContext.name, "()");
                }
                return "You are trying to read or write to an object that is no longer part of a state tree. (Object type: '".concat(this.type.name, "', Path upon death: '").concat(escapedPath, "', Subpath: '").concat(subpath, "', Action: '").concat(actionFullPath, "'). Either detach nodes first, or don't use objects after removing / replacing them in the tree.");
            }
        },
        {
            key: "getChildNode",
            value: function getChildNode(subpath) {
                this.assertAlive({
                    subpath: subpath
                });
                this._autoUnbox = false;
                try {
                    return this._observableInstanceState === 2 /* CREATED */  ? this.type.getChildNode(this, subpath) : this._childNodes[subpath];
                } finally{
                    this._autoUnbox = true;
                }
            }
        },
        {
            key: "getChildren",
            value: function getChildren() {
                this.assertAlive(EMPTY_OBJECT);
                this._autoUnbox = false;
                try {
                    return this._observableInstanceState === 2 /* CREATED */  ? this.type.getChildren(this) : convertChildNodesToArray(this._childNodes);
                } finally{
                    this._autoUnbox = true;
                }
            }
        },
        {
            key: "getChildType",
            value: function getChildType(propertyName) {
                return this.type.getChildType(propertyName);
            }
        },
        {
            key: "isProtected",
            get: function get() {
                return this.root.isProtectionEnabled;
            }
        },
        {
            key: "assertWritable",
            value: function assertWritable(context) {
                this.assertAlive(context);
                if (!this.isRunningAction() && this.isProtected) {
                    throw fail("Cannot modify '".concat(this, "', the object is protected and can only be modified by using an action."));
                }
            }
        },
        {
            key: "removeChild",
            value: function removeChild(subpath) {
                this.type.removeChild(this, subpath);
            }
        },
        {
            // bound on the constructor
            key: "unbox",
            value: function unbox(childNode) {
                if (!childNode) return childNode;
                this.assertAlive({
                    subpath: childNode.subpath || childNode.subpathUponDeath
                });
                return this._autoUnbox ? childNode.value : childNode;
            }
        },
        {
            key: "toString",
            value: function toString() {
                var path = (this.isAlive ? this.path : this.pathUponDeath) || "<root>";
                var identifier2 = this.identifier ? "(id: ".concat(this.identifier, ")") : "";
                return "".concat(this.type.name, "@").concat(path).concat(identifier2).concat(this.isAlive ? "" : " [dead]");
            }
        },
        {
            key: "finalizeCreation",
            value: function finalizeCreation() {
                var _this = this;
                this.baseFinalizeCreation(function() {
                    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    try {
                        for(var _iterator = _this.getChildren()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                            var child = _step.value;
                            child.finalizeCreation();
                        }
                    } catch (err) {
                        _didIteratorError = true;
                        _iteratorError = err;
                    } finally{
                        try {
                            if (!_iteratorNormalCompletion && _iterator.return != null) {
                                _iterator.return();
                            }
                        } finally{
                            if (_didIteratorError) {
                                throw _iteratorError;
                            }
                        }
                    }
                    _this.fireInternalHook("afterCreationFinalization" /* afterCreationFinalization */ );
                });
            }
        },
        {
            key: "detach",
            value: function detach() {
                if (!this.isAlive) throw fail("Error while detaching, node is not alive.");
                this.clearParent();
            }
        },
        {
            key: "preboot",
            value: function preboot() {
                var self = this;
                this._applyPatches = createActionInvoker(this.storedValue, "@APPLY_PATCHES", function(patches) {
                    patches.forEach(function(patch) {
                        if (!patch.path) {
                            self.type.applySnapshot(self, patch.value);
                            return;
                        }
                        var parts = splitJsonPath(patch.path);
                        var node = resolveNodeByPathParts(self, parts.slice(0, -1));
                        node.applyPatchLocally(parts[parts.length - 1], patch);
                    });
                });
                this._applySnapshot = createActionInvoker(this.storedValue, "@APPLY_SNAPSHOT", function(snapshot) {
                    if (snapshot === self.snapshot) return;
                    return self.type.applySnapshot(self, snapshot);
                });
                addHiddenFinalProp(this.storedValue, "$treenode", this);
                addHiddenFinalProp(this.storedValue, "toJSON", toJSON);
            }
        },
        {
            key: "die",
            value: function die() {
                if (!this.isAlive || this.state === 3 /* DETACHING */ ) return;
                this.aboutToDie();
                this.finalizeDeath();
            }
        },
        {
            key: "aboutToDie",
            value: function aboutToDie() {
                if (this._observableInstanceState === 0 /* UNINITIALIZED */ ) {
                    return;
                }
                this.getChildren().forEach(function(node) {
                    node.aboutToDie();
                });
                this.baseAboutToDie();
                this._internalEventsEmit("dispose" /* Dispose */ );
                this._internalEventsClear("dispose" /* Dispose */ );
            }
        },
        {
            key: "finalizeDeath",
            value: function finalizeDeath() {
                this.getChildren().forEach(function(node) {
                    node.finalizeDeath();
                });
                this.root.identifierCache.notifyDied(this);
                var snapshot = this.snapshot;
                this._snapshotUponDeath = snapshot;
                this._internalEventsClearAll();
                this.baseFinalizeDeath();
            }
        },
        {
            key: "onSnapshot",
            value: function onSnapshot(onChange) {
                this._addSnapshotReaction();
                return this._internalEventsRegister("snapshot" /* Snapshot */ , onChange);
            }
        },
        {
            key: "emitSnapshot",
            value: function emitSnapshot(snapshot) {
                this._internalEventsEmit("snapshot" /* Snapshot */ , snapshot);
            }
        },
        {
            key: "onPatch",
            value: function onPatch(handler) {
                return this._internalEventsRegister("patch" /* Patch */ , handler);
            }
        },
        {
            key: "emitPatch",
            value: function emitPatch(basePatch, source) {
                if (this._internalEventsHasSubscribers("patch" /* Patch */ )) {
                    var localizedPatch = extend({}, basePatch, {
                        path: source.path.substr(this.path.length) + "/" + basePatch.path
                    });
                    var _splitPatch = _sliced_to_array(splitPatch(localizedPatch), 2), patch = _splitPatch[0], reversePatch = _splitPatch[1];
                    this._internalEventsEmit("patch" /* Patch */ , patch, reversePatch);
                }
                if (this.parent) this.parent.emitPatch(basePatch, source);
            }
        },
        {
            key: "hasDisposer",
            value: function hasDisposer(disposer) {
                return this._internalEventsHas("dispose" /* Dispose */ , disposer);
            }
        },
        {
            key: "addDisposer",
            value: function addDisposer(disposer) {
                if (!this.hasDisposer(disposer)) {
                    this._internalEventsRegister("dispose" /* Dispose */ , disposer, true);
                    return;
                }
                throw fail("cannot add a disposer when it is already registered for execution");
            }
        },
        {
            key: "removeDisposer",
            value: function removeDisposer(disposer) {
                if (!this._internalEventsHas("dispose" /* Dispose */ , disposer)) {
                    throw fail("cannot remove a disposer which was never registered for execution");
                }
                this._internalEventsUnregister("dispose" /* Dispose */ , disposer);
            }
        },
        {
            key: "removeMiddleware",
            value: function removeMiddleware(middleware) {
                if (this.middlewares) {
                    var index = this.middlewares.indexOf(middleware);
                    if (index >= 0) {
                        this.middlewares.splice(index, 1);
                    }
                }
            }
        },
        {
            key: "addMiddleWare",
            value: function addMiddleWare(handler) {
                var _this = this;
                var includeHooks = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
                var middleware = {
                    handler: handler,
                    includeHooks: includeHooks
                };
                if (!this.middlewares) this.middlewares = [
                    middleware
                ];
                else this.middlewares.push(middleware);
                return function() {
                    _this.removeMiddleware(middleware);
                };
            }
        },
        {
            key: "applyPatchLocally",
            value: function applyPatchLocally(subpath, patch) {
                this.assertWritable({
                    subpath: subpath
                });
                this.createObservableInstanceIfNeeded();
                this.type.applyPatchLocally(this, subpath, patch);
            }
        },
        {
            key: "_addSnapshotReaction",
            value: function _addSnapshotReaction() {
                var _this = this;
                if (!this._hasSnapshotReaction) {
                    var snapshotDisposer = (0, import_mobx4.reaction)(function() {
                        return _this.snapshot;
                    }, function(snapshot) {
                        return _this.emitSnapshot(snapshot);
                    }, snapshotReactionOptions);
                    this.addDisposer(snapshotDisposer);
                    this._hasSnapshotReaction = true;
                }
            }
        },
        {
            // we proxy the methods to avoid creating an EventHandlers instance when it is not needed
            key: "_internalEventsHasSubscribers",
            value: function _internalEventsHasSubscribers(event) {
                return !!this._internalEvents && this._internalEvents.hasSubscribers(event);
            }
        },
        {
            key: "_internalEventsRegister",
            value: function _internalEventsRegister(event, eventHandler) {
                var atTheBeginning = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
                if (!this._internalEvents) {
                    this._internalEvents = new EventHandlers();
                }
                return this._internalEvents.register(event, eventHandler, atTheBeginning);
            }
        },
        {
            key: "_internalEventsHas",
            value: function _internalEventsHas(event, eventHandler) {
                return !!this._internalEvents && this._internalEvents.has(event, eventHandler);
            }
        },
        {
            key: "_internalEventsUnregister",
            value: function _internalEventsUnregister(event, eventHandler) {
                if (this._internalEvents) {
                    this._internalEvents.unregister(event, eventHandler);
                }
            }
        },
        {
            key: "_internalEventsEmit",
            value: function _internalEventsEmit(event) {
                for(var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
                    args[_key - 1] = arguments[_key];
                }
                if (this._internalEvents) {
                    var _this__internalEvents;
                    (_this__internalEvents = this._internalEvents).emit.apply(_this__internalEvents, [
                        event
                    ].concat(_to_consumable_array(args)));
                }
            }
        },
        {
            key: "_internalEventsClear",
            value: function _internalEventsClear(event) {
                if (this._internalEvents) {
                    this._internalEvents.clear(event);
                }
            }
        },
        {
            key: "_internalEventsClearAll",
            value: function _internalEventsClearAll() {
                if (this._internalEvents) {
                    this._internalEvents.clearAll();
                }
            }
        }
    ]);
    return ObjectNode;
}(BaseNode);
ObjectNode.prototype.createObservableInstance = (0, import_mobx4.action)(ObjectNode.prototype.createObservableInstance);
ObjectNode.prototype.detach = (0, import_mobx4.action)(ObjectNode.prototype.detach);
ObjectNode.prototype.die = (0, import_mobx4.action)(ObjectNode.prototype.die);
// src/core/type/type.ts
var import_mobx5 = require("mobx");
var cannotDetermineSubtype = "cannotDetermine";
var $type = Symbol("$type");
var _a;
_a = $type;
var BaseType = /*#__PURE__*/ function() {
    function BaseType(name) {
        _class_call_check(this, BaseType);
        __publicField(this, _a);
        // these are just to make inner types avaialable to inherited classes
        __publicField(this, "C");
        __publicField(this, "S");
        __publicField(this, "T");
        __publicField(this, "N");
        __publicField(this, "isType", true);
        __publicField(this, "name");
        this.name = name;
    }
    _create_class(BaseType, [
        {
            key: "create",
            value: function create(snapshot, environment) {
                typecheckInternal(this, snapshot);
                return this.instantiate(null, "", environment, snapshot).value;
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(node, applyPostProcess) {
                throw fail("unimplemented method");
            }
        },
        {
            key: "isAssignableFrom",
            value: function isAssignableFrom(type) {
                return type === this;
            }
        },
        {
            key: "validate",
            value: function validate(value, context) {
                var node = getStateTreeNodeSafe(value);
                if (node) {
                    var valueType = getType(value);
                    return this.isAssignableFrom(valueType) ? typeCheckSuccess() : typeCheckFailure(context, value);
                }
                return this.isValidSnapshot(value, context);
            }
        },
        {
            key: "is",
            value: function is(thing) {
                return this.validate(thing, [
                    {
                        path: "",
                        type: this
                    }
                ]).length === 0;
            }
        },
        {
            key: "Type",
            get: function get() {
                throw fail("Factory.Type should not be actually called. It is just a Type signature that can be used at compile time with Typescript, by using `typeof type.Type`");
            }
        },
        {
            key: "TypeWithoutSTN",
            get: function get() {
                throw fail("Factory.TypeWithoutSTN should not be actually called. It is just a Type signature that can be used at compile time with Typescript, by using `typeof type.TypeWithoutSTN`");
            }
        },
        {
            key: "SnapshotType",
            get: function get() {
                throw fail("Factory.SnapshotType should not be actually called. It is just a Type signature that can be used at compile time with Typescript, by using `typeof type.SnapshotType`");
            }
        },
        {
            key: "CreationType",
            get: function get() {
                throw fail("Factory.CreationType should not be actually called. It is just a Type signature that can be used at compile time with Typescript, by using `typeof type.CreationType`");
            }
        }
    ]);
    return BaseType;
}();
BaseType.prototype.create = (0, import_mobx5.action)(BaseType.prototype.create);
var ComplexType2 = /*#__PURE__*/ function(BaseType) {
    _inherits(ComplexType2, BaseType);
    function ComplexType2(name) {
        _class_call_check(this, ComplexType2);
        var _this;
        _this = _call_super(this, ComplexType2, [
            name
        ]);
        __publicField(_this, "identifierAttribute");
        return _this;
    }
    _create_class(ComplexType2, [
        {
            key: "create",
            value: function create() {
                var snapshot = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.getDefaultSnapshot(), environment = arguments.length > 1 ? arguments[1] : void 0;
                return _get(_get_prototype_of(ComplexType2.prototype), "create", this).call(this, snapshot, environment);
            }
        },
        {
            key: "getValue",
            value: function getValue(node) {
                node.createObservableInstanceIfNeeded();
                return node.storedValue;
            }
        },
        {
            key: "isMatchingSnapshotId",
            value: function isMatchingSnapshotId(current, snapshot) {
                return !current.identifierAttribute || current.identifier === normalizeIdentifier(snapshot[current.identifierAttribute]);
            }
        },
        {
            key: "tryToReconcileNode",
            value: function tryToReconcileNode(current, newValue) {
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
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                var nodeReconciled = this.tryToReconcileNode(current, newValue);
                if (nodeReconciled) {
                    current.setParent(parent, subpath);
                    return current;
                }
                current.die();
                if (isStateTreeNode(newValue) && this.isAssignableFrom(getType(newValue))) {
                    var newNode = getStateTreeNode(newValue);
                    newNode.setParent(parent, subpath);
                    return newNode;
                }
                return this.instantiate(parent, subpath, void 0, newValue);
            }
        },
        {
            key: "getSubTypes",
            value: function getSubTypes() {
                return null;
            }
        }
    ]);
    return ComplexType2;
}(BaseType);
ComplexType2.prototype.create = (0, import_mobx5.action)(ComplexType2.prototype.create);
var SimpleType2 = /*#__PURE__*/ function(BaseType) {
    _inherits(SimpleType2, BaseType);
    function SimpleType2() {
        _class_call_check(this, SimpleType2);
        return _call_super(this, SimpleType2, arguments);
    }
    _create_class(SimpleType2, [
        {
            key: "createNewInstance",
            value: function createNewInstance(snapshot) {
                return snapshot;
            }
        },
        {
            key: "getValue",
            value: function getValue(node) {
                return node.storedValue;
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(node) {
                return node.storedValue;
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                if (!current.isDetaching && current.type === this && current.storedValue === newValue) {
                    return current;
                }
                var res = this.instantiate(parent, subpath, void 0, newValue);
                current.die();
                return res;
            }
        },
        {
            key: "getSubTypes",
            value: function getSubTypes() {
                return null;
            }
        }
    ]);
    return SimpleType2;
}(BaseType);
function isType(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of(value)) === "object" && value && value.isType === true;
}
function assertIsType(type, argNumber) {
    assertArg(type, isType, "mobx-state-tree type", argNumber);
}
// src/middlewares/create-action-tracking-middleware.ts
var runningActions = /* @__PURE__ */ new Map();
function createActionTrackingMiddleware(hooks) {
    return function actionTrackingMiddleware(call, next, abort) {
        switch(call.type){
            case "action":
                {
                    if (!hooks.filter || hooks.filter(call) === true) {
                        var context = hooks.onStart(call);
                        hooks.onResume(call, context);
                        runningActions.set(call.id, {
                            call: call,
                            context: context,
                            async: false
                        });
                        try {
                            var res = next(call);
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
            case "flow_spawn":
                {
                    var root = runningActions.get(call.rootId);
                    root.async = true;
                    return next(call);
                }
            case "flow_resume":
            case "flow_resume_error":
                {
                    var root1 = runningActions.get(call.rootId);
                    hooks.onResume(call, root1.context);
                    try {
                        return next(call);
                    } finally{
                        hooks.onSuspend(call, root1.context);
                    }
                }
            case "flow_throw":
                {
                    var root2 = runningActions.get(call.rootId);
                    runningActions.delete(call.rootId);
                    hooks.onFail(call, root2.context, call.args[0]);
                    return next(call);
                }
            case "flow_return":
                {
                    var root3 = runningActions.get(call.rootId);
                    runningActions.delete(call.rootId);
                    hooks.onSuccess(call, root3.context, call.args[0]);
                    return next(call);
                }
        }
    };
}
// src/middlewares/createActionTrackingMiddleware2.ts
var RunningAction = /*#__PURE__*/ function() {
    function RunningAction(hooks, call) {
        _class_call_check(this, RunningAction);
        this.hooks = hooks;
        this.call = call;
        __publicField(this, "flowsPending", 0);
        __publicField(this, "running", true);
        if (hooks) {
            hooks.onStart(call);
        }
    }
    _create_class(RunningAction, [
        {
            key: "finish",
            value: function finish(error) {
                if (this.running) {
                    this.running = false;
                    if (this.hooks) {
                        this.hooks.onFinish(this.call, error);
                    }
                }
            }
        },
        {
            key: "incFlowsPending",
            value: function incFlowsPending() {
                this.flowsPending++;
            }
        },
        {
            key: "decFlowsPending",
            value: function decFlowsPending() {
                this.flowsPending--;
            }
        },
        {
            key: "hasFlowsPending",
            get: function get() {
                return this.flowsPending > 0;
            }
        }
    ]);
    return RunningAction;
}();
function createActionTrackingMiddleware2(middlewareHooks) {
    var runningActions2 = /* @__PURE__ */ new Map();
    return function actionTrackingMiddleware(call, next) {
        var parentRunningAction = call.parentActionEvent ? runningActions2.get(call.parentActionEvent.id) : void 0;
        if (call.type === "action") {
            var newCall = _object_spread_props(_object_spread({}, call), {
                // make a shallow copy of the parent action env
                env: parentRunningAction && parentRunningAction.call.env,
                parentCall: parentRunningAction && parentRunningAction.call
            });
            var passesFilter = !middlewareHooks.filter || middlewareHooks.filter(newCall);
            var hooks = passesFilter ? middlewareHooks : void 0;
            var runningAction = new RunningAction(hooks, newCall);
            runningActions2.set(call.id, runningAction);
            var res;
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
            switch(call.type){
                case "flow_spawn":
                    {
                        parentRunningAction.incFlowsPending();
                        return next(call);
                    }
                case "flow_resume":
                case "flow_resume_error":
                    {
                        return next(call);
                    }
                case "flow_throw":
                    {
                        var error = call.args[0];
                        try {
                            return next(call);
                        } finally{
                            parentRunningAction.decFlowsPending();
                            if (!parentRunningAction.hasFlowsPending) {
                                runningActions2.delete(call.parentActionEvent.id);
                                parentRunningAction.finish(error);
                            }
                        }
                    }
                case "flow_return":
                    {
                        try {
                            return next(call);
                        } finally{
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
var import_mobx6 = require("mobx");
function serializeArgument(node, actionName, index, arg) {
    if (_instanceof(arg, Date)) return {
        $MST_DATE: arg.getTime()
    };
    if (isPrimitive(arg)) return arg;
    if (isStateTreeNode(arg)) return serializeTheUnserializable("[MSTNode: ".concat(getType(arg).name, "]"));
    if (typeof arg === "function") return serializeTheUnserializable("[function]");
    if ((typeof arg === "undefined" ? "undefined" : _type_of(arg)) === "object" && !isPlainObject(arg) && !isArray(arg)) return serializeTheUnserializable("[object ".concat(arg && arg.constructor && arg.constructor.name || "Complex Object", "]"));
    try {
        JSON.stringify(arg);
        return arg;
    } catch (e) {
        return serializeTheUnserializable("" + e);
    }
}
function deserializeArgument(adm, value) {
    if (value && (typeof value === "undefined" ? "undefined" : _type_of(value)) === "object" && "$MST_DATE" in value) return new Date(value["$MST_DATE"]);
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
    assertArg(actions, function(a) {
        return (typeof a === "undefined" ? "undefined" : _type_of(a)) === "object";
    }, "object or array", 2);
    (0, import_mobx6.runInAction)(function() {
        asArray(actions).forEach(function(action8) {
            return baseApplyAction(target, action8);
        });
    });
}
function baseApplyAction(target, action8) {
    var resolvedTarget = tryResolve(target, action8.path || "");
    if (!resolvedTarget) throw fail("Invalid action path: ".concat(action8.path || ""));
    var node = getStateTreeNode(resolvedTarget);
    if (action8.name === "@APPLY_PATCHES") {
        return applyPatch.call(null, resolvedTarget, action8.args[0]);
    }
    if (action8.name === "@APPLY_SNAPSHOT") {
        return applySnapshot.call(null, resolvedTarget, action8.args[0]);
    }
    if (!(typeof resolvedTarget[action8.name] === "function")) throw fail("Action '".concat(action8.name, "' does not exist in '").concat(node.path, "'"));
    return resolvedTarget[action8.name].apply(resolvedTarget, action8.args ? action8.args.map(function(v) {
        return deserializeArgument(node, v);
    }) : []);
}
function recordActions(subject, filter) {
    assertIsStateTreeNode(subject, 1);
    var actions = [];
    var listener = function(call) {
        var recordThis = filter ? filter(call, getRunningActionContext()) : true;
        if (recordThis) {
            actions.push(call);
        }
    };
    var disposer;
    var recorder = {
        actions: actions,
        get recording () {
            return !!disposer;
        },
        stop: function stop() {
            if (disposer) {
                disposer();
                disposer = void 0;
            }
        },
        resume: function resume() {
            if (disposer) return;
            disposer = onAction(subject, listener);
        },
        replay: function replay(target) {
            applyAction(target, actions);
        }
    };
    recorder.resume();
    return recorder;
}
function onAction(target, listener) {
    var attachAfter = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
    assertIsStateTreeNode(target, 1);
    if (devMode()) {
        if (!isRoot(target)) warnError("Warning: Attaching onAction listeners to non root nodes is dangerous: No events will be emitted for actions initiated higher up in the tree.");
        if (!isProtected(target)) warnError("Warning: Attaching onAction listeners to non protected nodes is dangerous: No events will be emitted for direct modifications without action.");
    }
    return addMiddleware(target, function handler(rawCall, next) {
        if (rawCall.type === "action" && rawCall.id === rawCall.rootId) {
            var sourceNode = getStateTreeNode(rawCall.context);
            var info = {
                name: rawCall.name,
                path: getRelativePathBetweenNodes(getStateTreeNode(target), sourceNode),
                args: rawCall.args.map(function(arg, index) {
                    return serializeArgument(sourceNode, rawCall.name, index, arg);
                })
            };
            if (attachAfter) {
                var res = next(rawCall);
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
var import_mobx7 = require("mobx");
var nextActionId = 1;
var currentActionContext;
function getCurrentActionContext() {
    return currentActionContext;
}
function getNextActionId() {
    return nextActionId++;
}
function runWithActionContext(context, fn) {
    var node = getStateTreeNode(context.context);
    if (context.type === "action") {
        node.assertAlive({
            actionContext: context
        });
    }
    var baseIsRunningAction = node._isRunningAction;
    node._isRunningAction = true;
    var previousContext = currentActionContext;
    currentActionContext = context;
    try {
        return runMiddleWares(node, context, fn);
    } finally{
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
    var res = function res() {
        var id = getNextActionId();
        var parentContext = currentActionContext;
        var parentActionContext = getParentActionContext(parentContext);
        return runWithActionContext({
            type: "action",
            name: name,
            id: id,
            args: argsToArray(arguments),
            context: target,
            tree: getRoot(target),
            rootId: parentContext ? parentContext.rootId : id,
            parentId: parentContext ? parentContext.id : 0,
            allParentIds: parentContext ? _to_consumable_array(parentContext.allParentIds).concat([
                parentContext.id
            ]) : [],
            parentEvent: parentContext,
            parentActionEvent: parentActionContext
        }, fn);
    };
    res._isMSTAction = true;
    res._isFlowAction = fn._isFlowAction;
    return res;
}
function addMiddleware(target, handler) {
    var includeHooks = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
    var node = getStateTreeNode(target);
    if (devMode()) {
        if (!node.isProtectionEnabled) {
            warnError("It is recommended to protect the state tree before attaching action middleware, as otherwise it cannot be guaranteed that all changes are passed through middleware. See `protect`");
        }
    }
    return node.addMiddleWare(handler, includeHooks);
}
function decorate(handler, fn) {
    var includeHooks = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
    var middleware = {
        handler: handler,
        includeHooks: includeHooks
    };
    fn.$mst_middleware = fn.$mst_middleware || [];
    fn.$mst_middleware.push(middleware);
    return fn;
}
var CollectedMiddlewares = /*#__PURE__*/ function() {
    function CollectedMiddlewares(node, fn) {
        _class_call_check(this, CollectedMiddlewares);
        __publicField(this, "arrayIndex", 0);
        __publicField(this, "inArrayIndex", 0);
        __publicField(this, "middlewares", []);
        if (fn.$mst_middleware) {
            this.middlewares.push(fn.$mst_middleware);
        }
        var n = node;
        while(n){
            if (n.middlewares) this.middlewares.push(n.middlewares);
            n = n.parent;
        }
    }
    _create_class(CollectedMiddlewares, [
        {
            key: "isEmpty",
            get: function get() {
                return this.middlewares.length <= 0;
            }
        },
        {
            key: "getNextMiddleware",
            value: function getNextMiddleware() {
                var array2 = this.middlewares[this.arrayIndex];
                if (!array2) return void 0;
                var item = array2[this.inArrayIndex++];
                if (!item) {
                    this.arrayIndex++;
                    this.inArrayIndex = 0;
                    return this.getNextMiddleware();
                }
                return item;
            }
        }
    ]);
    return CollectedMiddlewares;
}();
function runMiddleWares(node, baseCall, originalFn) {
    var middlewares = new CollectedMiddlewares(node, originalFn);
    if (middlewares.isEmpty) return (0, import_mobx7.action)(originalFn).apply(null, baseCall.args);
    var result = null;
    function runNextMiddleware(call) {
        var middleware = middlewares.getNextMiddleware();
        var handler = middleware && middleware.handler;
        if (!handler) {
            return (0, import_mobx7.action)(originalFn).apply(null, call.args);
        }
        if (!middleware.includeHooks && Hook[call.name]) {
            return runNextMiddleware(call);
        }
        var nextInvoked = false;
        function next(call2, callback) {
            nextInvoked = true;
            result = runNextMiddleware(call2);
            if (callback) {
                result = callback(result);
            }
        }
        var abortInvoked = false;
        function abort(value) {
            abortInvoked = true;
            result = value;
        }
        handler(call, next, abort);
        if (devMode()) {
            if (!nextInvoked && !abortInvoked) {
                var node2 = getStateTreeNode(call.tree);
                throw fail("Neither the next() nor the abort() callback within the middleware ".concat(handler.name, ' for the action: "').concat(call.name, '" on the node: ').concat(node2.type.name, " was invoked."));
            } else if (nextInvoked && abortInvoked) {
                var node21 = getStateTreeNode(call.tree);
                throw fail("The next() and abort() callback within the middleware ".concat(handler.name, ' for the action: "').concat(call.name, '" on the node: ').concat(node21.type.name, " were invoked."));
            }
        }
        return result;
    }
    return runNextMiddleware(baseCall);
}
// src/core/actionContext.ts
function getRunningActionContext() {
    var current = getCurrentActionContext();
    while(current && current.type !== "action"){
        current = current.parentActionEvent;
    }
    return current;
}
function _isActionContextThisOrChildOf(actionContext, sameOrParent, includeSame) {
    var parentId = typeof sameOrParent === "number" ? sameOrParent : sameOrParent.id;
    var current = includeSame ? actionContext : actionContext.parentActionEvent;
    while(current){
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
        return "<Unserializable: ".concat(e, ">");
    }
}
function prettyPrintValue(value) {
    return typeof value === "function" ? "<function".concat(value.name ? " " + value.name : "", ">") : isStateTreeNode(value) ? "<".concat(value, ">") : "`".concat(safeStringify(value), "`");
}
function shortenPrintValue(valueInString) {
    return valueInString.length < 280 ? valueInString : "".concat(valueInString.substring(0, 272), "......").concat(valueInString.substring(valueInString.length - 8));
}
function toErrorString(error) {
    var value = error.value;
    var type = error.context[error.context.length - 1].type;
    var fullPath = error.context.map(function(param) {
        var path = param.path;
        return path;
    }).filter(function(path) {
        return path.length > 0;
    }).join("/");
    var pathPrefix = fullPath.length > 0 ? 'at path "/'.concat(fullPath, '" ') : "";
    var currentTypename = isStateTreeNode(value) ? "value of type ".concat(getStateTreeNode(value).type.name, ":") : isPrimitive(value) ? "value" : "snapshot";
    var isSnapshotCompatible = type && isStateTreeNode(value) && type.is(getStateTreeNode(value).snapshot);
    return "".concat(pathPrefix).concat(currentTypename, " ").concat(prettyPrintValue(value), " is not assignable ").concat(type ? "to type: `".concat(type.name, "`") : "") + (error.message ? " (".concat(error.message, ")") : "") + (type ? isPrimitiveType(type) || isPrimitive(value) ? "." : ", expected an instance of `".concat(type.name, "` or a snapshot like `").concat(type.describe(), "` instead.") + (isSnapshotCompatible ? " (Note that a snapshot of the provided value is compatible with the targeted type)" : "") : ".");
}
function getContextForPath(context, path, type) {
    return context.concat([
        {
            path: path,
            type: type
        }
    ]);
}
function typeCheckSuccess() {
    return EMPTY_ARRAY;
}
function typeCheckFailure(context, value, message) {
    return [
        {
            context: context,
            value: value,
            message: message
        }
    ];
}
function flattenTypeErrors(errors) {
    return errors.reduce(function(a, i) {
        return a.concat(i);
    }, []);
}
function typecheckInternal(type, value) {
    if (isTypeCheckingEnabled()) {
        typecheck(type, value);
    }
}
function typecheck(type, value) {
    var errors = type.validate(value, [
        {
            path: "",
            type: type
        }
    ]);
    if (errors.length > 0) {
        throw fail(validationErrorsToString(type, value, errors));
    }
}
function validationErrorsToString(type, value, errors) {
    if (errors.length === 0) {
        return void 0;
    }
    return "Error while converting ".concat(shortenPrintValue(prettyPrintValue(value)), " to `").concat(type.name, "`:\n\n    ") + errors.map(toErrorString).join("\n    ");
}
// src/core/node/identifier-cache.ts
var import_mobx8 = require("mobx");
var identifierCacheId = 0;
var IdentifierCache = /*#__PURE__*/ function() {
    function _IdentifierCache() {
        _class_call_check(this, _IdentifierCache);
        __publicField(this, "cacheId", identifierCacheId++);
        // n.b. in cache all identifiers are normalized to strings
        __publicField(this, "cache", import_mobx8.observable.map());
        // last time the cache (array) for a given time changed
        // n.b. it is not really the time, but just an integer that gets increased after each modification to the array
        __publicField(this, "lastCacheModificationPerId", import_mobx8.observable.map());
    }
    _create_class(_IdentifierCache, [
        {
            key: "updateLastCacheModificationPerId",
            value: function updateLastCacheModificationPerId(identifier2) {
                var lcm = this.lastCacheModificationPerId.get(identifier2);
                this.lastCacheModificationPerId.set(identifier2, lcm === void 0 ? 1 : lcm + 1);
            }
        },
        {
            key: "getLastCacheModificationPerId",
            value: function getLastCacheModificationPerId(identifier2) {
                var modificationId = this.lastCacheModificationPerId.get(identifier2) || 0;
                return "".concat(this.cacheId, "-").concat(modificationId);
            }
        },
        {
            key: "addNodeToCache",
            value: function addNodeToCache(node) {
                var lastCacheUpdate = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
                if (node.identifierAttribute) {
                    var identifier2 = node.identifier;
                    if (!this.cache.has(identifier2)) {
                        this.cache.set(identifier2, import_mobx8.observable.array([], mobxShallow));
                    }
                    var set2 = this.cache.get(identifier2);
                    if (set2.indexOf(node) !== -1) throw fail("Already registered");
                    set2.push(node);
                    if (lastCacheUpdate) {
                        this.updateLastCacheModificationPerId(identifier2);
                    }
                }
            }
        },
        {
            key: "mergeCache",
            value: function mergeCache(node) {
                var _this = this;
                (0, import_mobx8.values)(node.identifierCache.cache).forEach(function(nodes) {
                    return nodes.forEach(function(child) {
                        _this.addNodeToCache(child);
                    });
                });
            }
        },
        {
            key: "notifyDied",
            value: function notifyDied(node) {
                if (node.identifierAttribute) {
                    var id = node.identifier;
                    var set2 = this.cache.get(id);
                    if (set2) {
                        set2.remove(node);
                        if (!set2.length) {
                            this.cache.delete(id);
                        }
                        this.updateLastCacheModificationPerId(node.identifier);
                    }
                }
            }
        },
        {
            key: "splitCache",
            value: function splitCache(splitNode) {
                var _this = this;
                var newCache = new _IdentifierCache();
                var basePath = splitNode.path + "/";
                (0, import_mobx8.entries)(this.cache).forEach(function(param) {
                    var _param = _sliced_to_array(param, 2), id = _param[0], nodes = _param[1];
                    var modified = false;
                    for(var i = nodes.length - 1; i >= 0; i--){
                        var node = nodes[i];
                        if (node === splitNode || node.path.indexOf(basePath) === 0) {
                            newCache.addNodeToCache(node, false);
                            nodes.splice(i, 1);
                            if (!nodes.length) {
                                _this.cache.delete(id);
                            }
                            modified = true;
                        }
                    }
                    if (modified) {
                        _this.updateLastCacheModificationPerId(id);
                    }
                });
                return newCache;
            }
        },
        {
            key: "has",
            value: function has(type, identifier2) {
                var set2 = this.cache.get(identifier2);
                if (!set2) return false;
                return set2.some(function(candidate) {
                    return type.isAssignableFrom(candidate.type);
                });
            }
        },
        {
            key: "resolve",
            value: function resolve(type, identifier2) {
                var set2 = this.cache.get(identifier2);
                if (!set2) return null;
                var matches = set2.filter(function(candidate) {
                    return type.isAssignableFrom(candidate.type);
                });
                switch(matches.length){
                    case 0:
                        return null;
                    case 1:
                        return matches[0];
                    default:
                        throw fail("Cannot resolve a reference to type '".concat(type.name, "' with id: '").concat(identifier2, "' unambigously, there are multiple candidates: ").concat(matches.map(function(n) {
                            return n.path;
                        }).join(", ")));
                }
            }
        }
    ]);
    return _IdentifierCache;
}();
// src/core/node/create-node.ts
function createObjectNode(type, parent, subpath, environment, initialValue) {
    var existingNode = getStateTreeNodeSafe(initialValue);
    if (existingNode) {
        if (existingNode.parent) {
            throw fail("Cannot add an object to a state tree if it is already part of the same or another state tree. Tried to assign an object to '".concat(parent ? parent.path : "", "/").concat(subpath, "', but it lives already at '").concat(existingNode.path, "'"));
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
    return _instanceof(value, ScalarNode) || _instanceof(value, ObjectNode);
}
// src/core/node/node-utils.ts
function isStateTreeNode(value) {
    return !!(value && value.$treenode);
}
function assertIsStateTreeNode(value, argNumber) {
    assertArg(value, isStateTreeNode, "mobx-state-tree node", argNumber);
}
function getStateTreeNode(value) {
    if (!isStateTreeNode(value)) {
        throw fail("Value ".concat(value, " is no MST Node"));
    }
    return value.$treenode;
}
function getStateTreeNodeSafe(value) {
    return value && value.$treenode || null;
}
function toJSON() {
    return getStateTreeNode(this).snapshot;
}
var doubleDot = function(_) {
    return "..";
};
function getRelativePathBetweenNodes(base, target) {
    if (base.root !== target.root) {
        throw fail("Cannot calculate relative path: objects '".concat(base, "' and '").concat(target, "' are not part of the same object tree"));
    }
    var baseParts = splitJsonPath(base.path);
    var targetParts = splitJsonPath(target.path);
    var common = 0;
    for(; common < baseParts.length; common++){
        if (baseParts[common] !== targetParts[common]) break;
    }
    return baseParts.slice(common).map(doubleDot).join("/") + joinJsonPath(targetParts.slice(common));
}
function resolveNodeByPath(base, path) {
    var failIfResolveFails = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
    return resolveNodeByPathParts(base, splitJsonPath(path), failIfResolveFails);
}
function resolveNodeByPathParts(base, pathParts) {
    var failIfResolveFails = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
    var current = base;
    try {
        for(var i = 0; i < pathParts.length; i++){
            var part = pathParts[i];
            if (part === "..") {
                current = current.parent;
                if (current) continue;
            } else if (part === ".") {
                continue;
            } else if (current) {
                if (_instanceof(current, ScalarNode)) {
                    var value = current.value;
                    if (isStateTreeNode(value)) {
                        current = getStateTreeNode(value);
                    }
                }
                if (_instanceof(current, ObjectNode)) {
                    var subType = current.getChildType(part);
                    if (subType) {
                        current = current.getChildNode(part);
                        if (current) continue;
                    }
                }
            }
            throw fail("Could not resolve '".concat(part, "' in path '").concat(joinJsonPath(pathParts.slice(0, i)) || "/", "' while resolving '").concat(joinJsonPath(pathParts), "'"));
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
    var keys = Object.keys(childNodes);
    if (!keys.length) return EMPTY_ARRAY;
    var result = new Array(keys.length);
    keys.forEach(function(key, index) {
        result[index] = childNodes[key];
    });
    return result;
}
// src/core/process.ts
var DEPRECATION_MESSAGE = "See https://github.com/mobxjs/mobx-state-tree/issues/399 for more information. Note that the middleware event types starting with `process` now start with `flow`.";
function process2(asyncAction) {
    deprecated("process", "`process()` has been renamed to `flow()`. " + DEPRECATION_MESSAGE);
    return flow(asyncAction);
}
// src/utils.ts
var import_mobx9 = require("mobx");
var plainObjectString = Object.toString();
var EMPTY_ARRAY = Object.freeze([]);
var EMPTY_OBJECT = Object.freeze({});
var mobxShallow = (0, import_mobx9._getGlobalState)().useProxies ? {
    deep: false
} : {
    deep: false,
    proxy: false
};
Object.freeze(mobxShallow);
function fail() {
    var message = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "Illegal state";
    return new Error("[mobx-state-tree] " + message);
}
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
    return Array.isArray(val) || (0, import_mobx9.isObservableArray)(val);
}
function asArray(val) {
    if (!val) return EMPTY_ARRAY;
    if (isArray(val)) return val;
    return [
        val
    ];
}
function extend(a) {
    for(var _len = arguments.length, b = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
        b[_key - 1] = arguments[_key];
    }
    for(var i = 0; i < b.length; i++){
        var current = b[i];
        for(var key in current)a[key] = current[key];
    }
    return a;
}
function isPlainObject(value) {
    var _proto_constructor;
    if (value === null || (typeof value === "undefined" ? "undefined" : _type_of(value)) !== "object") return false;
    var proto = Object.getPrototypeOf(value);
    if (proto == null) return true;
    return ((_proto_constructor = proto.constructor) === null || _proto_constructor === void 0 ? void 0 : _proto_constructor.toString()) === plainObjectString;
}
function isMutable(value) {
    return value !== null && (typeof value === "undefined" ? "undefined" : _type_of(value)) === "object" && !_instanceof(value, Date) && !_instanceof(value, RegExp);
}
function isPrimitive(value) {
    var includeDate = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
    return value === null || value === void 0 || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || includeDate && _instanceof(value, Date);
}
function freeze(value) {
    if (!devMode()) return value;
    return isPrimitive(value) || (0, import_mobx9.isObservableArray)(value) ? value : Object.freeze(value);
}
function deepFreeze(value) {
    if (!devMode()) return value;
    freeze(value);
    if (isPlainObject(value)) {
        Object.keys(value).forEach(function(propKey) {
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
    (0, import_mobx9.isObservableObject)(object) ? (0, import_mobx9.defineProperty)(object, key, descriptor) : Object.defineProperty(object, key, descriptor);
}
function addHiddenFinalProp(object, propName, value) {
    defineProperty(object, propName, {
        enumerable: false,
        writable: false,
        configurable: true,
        value: value
    });
}
function addHiddenWritableProp(object, propName, value) {
    defineProperty(object, propName, {
        enumerable: false,
        writable: true,
        configurable: true,
        value: value
    });
}
var EventHandler = /*#__PURE__*/ function() {
    function EventHandler() {
        _class_call_check(this, EventHandler);
        __publicField(this, "handlers", []);
    }
    _create_class(EventHandler, [
        {
            key: "hasSubscribers",
            get: function get() {
                return this.handlers.length > 0;
            }
        },
        {
            key: "register",
            value: function register(fn) {
                var _this = this;
                var atTheBeginning = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
                if (atTheBeginning) {
                    this.handlers.unshift(fn);
                } else {
                    this.handlers.push(fn);
                }
                return function() {
                    _this.unregister(fn);
                };
            }
        },
        {
            key: "has",
            value: function has(fn) {
                return this.handlers.indexOf(fn) >= 0;
            }
        },
        {
            key: "unregister",
            value: function unregister(fn) {
                var index = this.handlers.indexOf(fn);
                if (index >= 0) {
                    this.handlers.splice(index, 1);
                }
            }
        },
        {
            key: "clear",
            value: function clear() {
                this.handlers.length = 0;
            }
        },
        {
            key: "emit",
            value: function emit() {
                for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                    args[_key] = arguments[_key];
                }
                var handlers = this.handlers.slice();
                handlers.forEach(function(f) {
                    return f.apply(void 0, _to_consumable_array(args));
                });
            }
        }
    ]);
    return EventHandler;
}();
var EventHandlers = /*#__PURE__*/ function() {
    function EventHandlers() {
        _class_call_check(this, EventHandlers);
        __publicField(this, "eventHandlers");
    }
    _create_class(EventHandlers, [
        {
            key: "hasSubscribers",
            value: function hasSubscribers(event) {
                var handler = this.eventHandlers && this.eventHandlers[event];
                return !!handler && handler.hasSubscribers;
            }
        },
        {
            key: "register",
            value: function register(event, fn) {
                var atTheBeginning = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
                if (!this.eventHandlers) {
                    this.eventHandlers = {};
                }
                var handler = this.eventHandlers[event];
                if (!handler) {
                    handler = this.eventHandlers[event] = new EventHandler();
                }
                return handler.register(fn, atTheBeginning);
            }
        },
        {
            key: "has",
            value: function has(event, fn) {
                var handler = this.eventHandlers && this.eventHandlers[event];
                return !!handler && handler.has(fn);
            }
        },
        {
            key: "unregister",
            value: function unregister(event, fn) {
                var handler = this.eventHandlers && this.eventHandlers[event];
                if (handler) {
                    handler.unregister(fn);
                }
            }
        },
        {
            key: "clear",
            value: function clear(event) {
                if (this.eventHandlers) {
                    delete this.eventHandlers[event];
                }
            }
        },
        {
            key: "clearAll",
            value: function clearAll() {
                this.eventHandlers = void 0;
            }
        },
        {
            key: "emit",
            value: function emit(event) {
                for(var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
                    args[_key - 1] = arguments[_key];
                }
                var handler = this.eventHandlers && this.eventHandlers[event];
                if (handler) {
                    var _handler;
                    ;
                    (_handler = handler).emit.apply(_handler, _to_consumable_array(args));
                }
            }
        }
    ]);
    return EventHandlers;
}();
function argsToArray(args) {
    var res = new Array(args.length);
    for(var i = 0; i < args.length; i++)res[i] = args[i];
    return res;
}
function stringStartsWith(str, beginning) {
    return str.indexOf(beginning) === 0;
}
var deprecated = function deprecated1(id, message) {
    if (!devMode()) return;
    if (deprecated.ids && !deprecated.ids.hasOwnProperty(id)) {
        warnError("Deprecation warning: " + message);
    }
    if (deprecated.ids) deprecated.ids[id] = true;
};
deprecated.ids = {};
function warnError(msg) {
    console.warn(new Error("[mobx-state-tree] ".concat(msg)));
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
            throw fail("expected ".concat(typeName, " as argument ").concat(asArray(argNumber).join(" or "), ", got ").concat(value, " instead"));
        }
    }
}
function assertIsFunction(value, argNumber) {
    assertArg(value, function(fn) {
        return typeof fn === "function";
    }, "function", argNumber);
}
function assertIsNumber(value, argNumber, min, max) {
    assertArg(value, function(n) {
        return typeof n === "number";
    }, "number", argNumber);
    if (min !== void 0) {
        assertArg(value, function(n) {
            return n >= min;
        }, "number greater than ".concat(min), argNumber);
    }
    if (max !== void 0) {
        assertArg(value, function(n) {
            return n <= max;
        }, "number lesser than ".concat(max), argNumber);
    }
}
function assertIsString(value, argNumber) {
    var canBeEmpty = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
    assertArg(value, function(s) {
        return typeof s === "string";
    }, "string", argNumber);
    if (!canBeEmpty) {
        assertArg(value, function(s) {
            return s !== "";
        }, "not empty string", argNumber);
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
    return function() {
        var _len, args, _key;
        var _arguments = arguments;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    for(_len = _arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                        args[_key] = _arguments[_key];
                    }
                    return [
                        4,
                        p.apply(void 0, _to_consumable_array(args))
                    ];
                case 1:
                    return [
                        2,
                        _state.sent()
                    ];
            }
        });
    };
}
function toGenerator(p) {
    return _ts_generator(this, function(_state) {
        switch(_state.label){
            case 0:
                return [
                    4,
                    p
                ];
            case 1:
                return [
                    2,
                    _state.sent()
                ];
        }
    });
}
function createFlowSpawner(name, generator) {
    var spawner = function flowSpawner() {
        var runId = getNextActionId();
        var parentContext = getCurrentActionContext();
        if (!parentContext) {
            throw fail("a mst flow must always have a parent context");
        }
        var parentActionContext = getParentActionContext(parentContext);
        if (!parentActionContext) {
            throw fail("a mst flow must always have a parent action context");
        }
        var contextBase = {
            name: name,
            id: runId,
            tree: parentContext.tree,
            context: parentContext.context,
            parentId: parentContext.id,
            allParentIds: _to_consumable_array(parentContext.allParentIds).concat([
                parentContext.id
            ]),
            rootId: parentContext.rootId,
            parentEvent: parentContext,
            parentActionEvent: parentActionContext
        };
        var args = arguments;
        function wrap(fn, type, arg) {
            fn.$mst_middleware = spawner.$mst_middleware;
            return runWithActionContext(_object_spread_props(_object_spread({}, contextBase), {
                type: type,
                args: [
                    arg
                ]
            }), fn);
        }
        return new Promise(function(resolve, reject) {
            var gen;
            var init = function asyncActionInit() {
                gen = generator.apply(null, arguments);
                onFulfilled(void 0);
            };
            init.$mst_middleware = spawner.$mst_middleware;
            runWithActionContext(_object_spread_props(_object_spread({}, contextBase), {
                type: "flow_spawn",
                args: argsToArray(args)
            }), init);
            function onFulfilled(res) {
                var ret;
                try {
                    var cancelError = wrap(function(r) {
                        ret = gen.next(r);
                    }, "flow_resume", res);
                    if (_instanceof(cancelError, Error)) {
                        ret = gen.throw(cancelError);
                    }
                } catch (e) {
                    setImmediateWithFallback(function() {
                        wrap(function(r) {
                            reject(e);
                        }, "flow_throw", e);
                    });
                    return;
                }
                next(ret);
                return;
            }
            function onRejected(err) {
                var ret;
                try {
                    wrap(function(r) {
                        ret = gen.throw(r);
                    }, "flow_resume_error", err);
                } catch (e) {
                    setImmediateWithFallback(function() {
                        wrap(function(r) {
                            reject(e);
                        }, "flow_throw", e);
                    });
                    return;
                }
                next(ret);
            }
            function next(ret) {
                if (ret.done) {
                    setImmediateWithFallback(function() {
                        wrap(function(r) {
                            resolve(r);
                        }, "flow_return", ret.value);
                    });
                    return;
                }
                if (!ret.value || typeof ret.value.then !== "function") {
                    throw fail("Only promises can be yielded to `async`, got: " + ret);
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
    if (!("oldValue" in patch)) throw fail("Patches without `oldValue` field cannot be inversed");
    return [
        stripPatch(patch),
        invertPatch(patch)
    ];
}
function stripPatch(patch) {
    switch(patch.op){
        case "add":
            return {
                op: "add",
                path: patch.path,
                value: patch.value
            };
        case "remove":
            return {
                op: "remove",
                path: patch.path
            };
        case "replace":
            return {
                op: "replace",
                path: patch.path,
                value: patch.value
            };
    }
}
function invertPatch(patch) {
    switch(patch.op){
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
    var getPathStr = function(p) {
        return p.map(escapeJsonPath).join("/");
    };
    if (path[0] === "." || path[0] === "..") {
        return getPathStr(path);
    } else {
        return "/" + getPathStr(path);
    }
}
function splitJsonPath(path) {
    var parts = path.split("/").map(unescapeJsonPath);
    var valid = path === "" || path === "." || path === ".." || stringStartsWith(path, "/") || stringStartsWith(path, "./") || stringStartsWith(path, "../");
    if (!valid) {
        throw fail("a json path must be either rooted, empty or relative, but got '".concat(path, "'"));
    }
    if (parts[0] === "") {
        parts.shift();
    }
    return parts;
}
// src/types/utility-types/snapshotProcessor.ts
var $preProcessorFailed = Symbol("$preProcessorFailed");
var SnapshotProcessor = /*#__PURE__*/ function(BaseType) {
    _inherits(SnapshotProcessor, BaseType);
    function SnapshotProcessor(_subtype, _processors, name) {
        _class_call_check(this, SnapshotProcessor);
        var _this;
        _this = _call_super(this, SnapshotProcessor, [
            name || _subtype.name
        ]);
        _this._subtype = _subtype;
        _this._processors = _processors;
        return _this;
    }
    _create_class(SnapshotProcessor, [
        {
            key: "flags",
            get: function get() {
                return this._subtype.flags | 524288 /* SnapshotProcessor */ ;
            }
        },
        {
            key: "describe",
            value: function describe() {
                return "snapshotProcessor(".concat(this._subtype.describe(), ")");
            }
        },
        {
            key: "preProcessSnapshot",
            value: function preProcessSnapshot(sn) {
                if (this._processors.preProcessor) {
                    return this._processors.preProcessor.call(null, sn);
                }
                return sn;
            }
        },
        {
            key: "preProcessSnapshotSafe",
            value: function preProcessSnapshotSafe(sn) {
                try {
                    return this.preProcessSnapshot(sn);
                } catch (e) {
                    return $preProcessorFailed;
                }
            }
        },
        {
            key: "postProcessSnapshot",
            value: function postProcessSnapshot(sn, node) {
                if (this._processors.postProcessor) {
                    return this._processors.postProcessor.call(null, sn, node.storedValue);
                }
                return sn;
            }
        },
        {
            key: "_fixNode",
            value: function _fixNode(node) {
                var _this = this;
                proxyNodeTypeMethods(node.type, this, "create");
                if (_instanceof(node, ObjectNode)) {
                    node.hasSnapshotPostProcessor = !!this._processors.postProcessor;
                }
                var oldGetSnapshot = node.getSnapshot;
                node.getSnapshot = function() {
                    return _this.postProcessSnapshot(oldGetSnapshot.call(node), node);
                };
                if (!isUnionType(this._subtype)) {
                    node.getReconciliationType = function() {
                        return _this;
                    };
                }
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                var processedInitialValue = isStateTreeNode(initialValue) ? initialValue : this.preProcessSnapshot(initialValue);
                var node = this._subtype.instantiate(parent, subpath, environment, processedInitialValue);
                this._fixNode(node);
                return node;
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                var node = this._subtype.reconcile(current, isStateTreeNode(newValue) ? newValue : this.preProcessSnapshot(newValue), parent, subpath);
                if (node !== current) {
                    this._fixNode(node);
                }
                return node;
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(node) {
                var applyPostProcess = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
                var sn = this._subtype.getSnapshot(node);
                return applyPostProcess ? this.postProcessSnapshot(sn, node) : sn;
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                var processedSn = this.preProcessSnapshotSafe(value);
                if (processedSn === $preProcessorFailed) {
                    return typeCheckFailure(context, value, "Failed to preprocess value");
                }
                return this._subtype.validate(processedSn, context);
            }
        },
        {
            key: "getSubTypes",
            value: function getSubTypes() {
                return this._subtype;
            }
        },
        {
            key: "is",
            value: function is(thing) {
                var value = isType(thing) ? this._subtype : isStateTreeNode(thing) ? getSnapshot(thing, false) : this.preProcessSnapshotSafe(thing);
                if (value === $preProcessorFailed) {
                    return false;
                }
                return this._subtype.validate(value, [
                    {
                        path: "",
                        type: this._subtype
                    }
                ]).length === 0;
            }
        },
        {
            key: "isAssignableFrom",
            value: function isAssignableFrom(type) {
                return this._subtype.isAssignableFrom(type);
            }
        },
        {
            key: "isMatchingSnapshotId",
            value: function isMatchingSnapshotId(current, snapshot) {
                if (!_instanceof(this._subtype, ComplexType2)) {
                    return false;
                }
                var processedSn = this.preProcessSnapshot(snapshot);
                return this._subtype.isMatchingSnapshotId(current, processedSn);
            }
        }
    ]);
    return SnapshotProcessor;
}(BaseType);
function proxyNodeTypeMethods(nodeType, snapshotProcessorType) {
    for(var _len = arguments.length, methods = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++){
        methods[_key - 2] = arguments[_key];
    }
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = methods[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var method = _step.value;
            nodeType[method] = snapshotProcessorType[method].bind(snapshotProcessorType);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
}
function snapshotProcessor(type, processors, name) {
    assertIsType(type, 1);
    if (devMode()) {
        if (processors.postProcessor && typeof processors.postProcessor !== "function") {
            throw fail("postSnapshotProcessor must be a function");
        }
        if (processors.preProcessor && typeof processors.preProcessor !== "function") {
            throw fail("preSnapshotProcessor must be a function");
        }
    }
    return new SnapshotProcessor(type, processors, name);
}
// src/types/complex-types/map.ts
var import_mobx10 = require("mobx");
var needsIdentifierError = "Map.put can only be used to store complex values that have an identifier type attribute";
function tryCollectModelTypes(type, modelTypes) {
    var subtypes = type.getSubTypes();
    if (subtypes === cannotDetermineSubtype) {
        return false;
    }
    if (subtypes) {
        var subtypesArray = asArray(subtypes);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = subtypesArray[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var subtype = _step.value;
                if (!tryCollectModelTypes(subtype, modelTypes)) return false;
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    }
    if (_instanceof(type, ModelType)) {
        modelTypes.push(type);
    }
    return true;
}
var MSTMap = /*#__PURE__*/ function(_import_mobx10_ObservableMap) {
    _inherits(MSTMap, _import_mobx10_ObservableMap);
    function MSTMap(initialData, name) {
        _class_call_check(this, MSTMap);
        return _call_super(this, MSTMap, [
            initialData,
            import_mobx10.observable.ref.enhancer,
            name
        ]);
    }
    _create_class(MSTMap, [
        {
            key: "get",
            value: function get(key) {
                return _get(_get_prototype_of(MSTMap.prototype), "get", this).call(this, "" + key);
            }
        },
        {
            key: "has",
            value: function has(key) {
                return _get(_get_prototype_of(MSTMap.prototype), "has", this).call(this, "" + key);
            }
        },
        {
            key: "delete",
            value: function _delete(key) {
                return _get(_get_prototype_of(MSTMap.prototype), "delete", this).call(this, "" + key);
            }
        },
        {
            key: "set",
            value: function set(key, value) {
                return _get(_get_prototype_of(MSTMap.prototype), "set", this).call(this, "" + key, value);
            }
        },
        {
            key: "put",
            value: function put(value) {
                if (!value) throw fail("Map.put cannot be used to set empty values");
                if (isStateTreeNode(value)) {
                    var node = getStateTreeNode(value);
                    if (devMode()) {
                        if (!node.identifierAttribute) {
                            throw fail(needsIdentifierError);
                        }
                    }
                    if (node.identifier === null) {
                        throw fail(needsIdentifierError);
                    }
                    this.set(node.identifier, value);
                    return value;
                } else if (!isMutable(value)) {
                    throw fail("Map.put can only be used to store complex values");
                } else {
                    var mapNode = getStateTreeNode(this);
                    var mapType = mapNode.type;
                    if (mapType.identifierMode !== 1 /* YES */ ) {
                        throw fail(needsIdentifierError);
                    }
                    var idAttr = mapType.mapIdentifierAttribute;
                    var id = value[idAttr];
                    if (!isValidIdentifier(id)) {
                        var newNode = this.put(mapType.getChildType().create(value, mapNode.environment));
                        return this.put(getSnapshot(newNode));
                    }
                    var key = normalizeIdentifier(id);
                    this.set(key, value);
                    return this.get(key);
                }
            }
        }
    ]);
    return MSTMap;
}(import_mobx10.ObservableMap);
var MapType = /*#__PURE__*/ function(ComplexType2) {
    _inherits(_MapType, ComplexType2);
    function _MapType(name, _subType) {
        var hookInitializers = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
        _class_call_check(this, _MapType);
        var _this;
        _this = _call_super(this, _MapType, [
            name
        ]);
        _this._subType = _subType;
        __publicField(_this, "identifierMode", 0 /* UNKNOWN */ );
        __publicField(_this, "mapIdentifierAttribute");
        __publicField(_this, "flags", 64 /* Map */ );
        __publicField(_this, "hookInitializers", []);
        _this._determineIdentifierMode();
        _this.hookInitializers = hookInitializers;
        return _this;
    }
    _create_class(_MapType, [
        {
            key: "hooks",
            value: function hooks(hooks) {
                var hookInitializers = this.hookInitializers.length > 0 ? this.hookInitializers.concat(hooks) : [
                    hooks
                ];
                return new _MapType(this.name, this._subType, hookInitializers);
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                this._determineIdentifierMode();
                return createObjectNode(this, parent, subpath, environment, initialValue);
            }
        },
        {
            key: "_determineIdentifierMode",
            value: function _determineIdentifierMode() {
                if (this.identifierMode !== 0 /* UNKNOWN */ ) {
                    return;
                }
                var modelTypes = [];
                if (tryCollectModelTypes(this._subType, modelTypes)) {
                    var identifierAttribute = modelTypes.reduce(function(current, type) {
                        if (!type.identifierAttribute) return current;
                        if (current && current !== type.identifierAttribute) {
                            throw fail("The objects in a map should all have the same identifier attribute, expected '".concat(current, "', but child of type '").concat(type.name, "' declared attribute '").concat(type.identifierAttribute, "' as identifier"));
                        }
                        return type.identifierAttribute;
                    }, void 0);
                    if (identifierAttribute) {
                        this.identifierMode = 1 /* YES */ ;
                        this.mapIdentifierAttribute = identifierAttribute;
                    } else {
                        this.identifierMode = 2 /* NO */ ;
                    }
                }
            }
        },
        {
            key: "initializeChildNodes",
            value: function initializeChildNodes(objNode) {
                var initialSnapshot = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
                var subType = objNode.type._subType;
                var result = {};
                Object.keys(initialSnapshot).forEach(function(name) {
                    result[name] = subType.instantiate(objNode, name, void 0, initialSnapshot[name]);
                });
                return result;
            }
        },
        {
            key: "createNewInstance",
            value: function createNewInstance(childNodes) {
                return new MSTMap(childNodes, this.name);
            }
        },
        {
            key: "finalizeNewInstance",
            value: function finalizeNewInstance(node, instance) {
                (0, import_mobx10._interceptReads)(instance, node.unbox);
                var type = node.type;
                type.hookInitializers.forEach(function(initializer) {
                    var hooks = initializer(instance);
                    Object.keys(hooks).forEach(function(name) {
                        var hook = hooks[name];
                        var actionInvoker = createActionInvoker(instance, name, hook);
                        (!devMode() ? addHiddenFinalProp : addHiddenWritableProp)(instance, name, actionInvoker);
                    });
                });
                (0, import_mobx10.intercept)(instance, this.willChange);
                (0, import_mobx10.observe)(instance, this.didChange);
            }
        },
        {
            key: "describe",
            value: function describe() {
                return this.name;
            }
        },
        {
            key: "getChildren",
            value: function getChildren(node) {
                return (0, import_mobx10.values)(node.storedValue);
            }
        },
        {
            key: "getChildNode",
            value: function getChildNode(node, key) {
                var childNode = node.storedValue.get("" + key);
                if (!childNode) throw fail("Not a child " + key);
                return childNode;
            }
        },
        {
            key: "willChange",
            value: function willChange(change) {
                var node = getStateTreeNode(change.object);
                var key = change.name;
                node.assertWritable({
                    subpath: key
                });
                var mapType = node.type;
                var subType = mapType._subType;
                switch(change.type){
                    case "update":
                        {
                            var newValue = change.newValue;
                            var oldValue = change.object.get(key);
                            if (newValue === oldValue) return null;
                            typecheckInternal(subType, newValue);
                            change.newValue = subType.reconcile(node.getChildNode(key), change.newValue, node, key);
                            mapType.processIdentifier(key, change.newValue);
                        }
                        break;
                    case "add":
                        {
                            typecheckInternal(subType, change.newValue);
                            change.newValue = subType.instantiate(node, key, void 0, change.newValue);
                            mapType.processIdentifier(key, change.newValue);
                        }
                        break;
                }
                return change;
            }
        },
        {
            key: "processIdentifier",
            value: function processIdentifier(expected, node) {
                if (this.identifierMode === 1 /* YES */  && _instanceof(node, ObjectNode)) {
                    var identifier2 = node.identifier;
                    if (identifier2 !== expected) throw fail("A map of objects containing an identifier should always store the object under their own identifier. Trying to store key '".concat(identifier2, "', but expected: '").concat(expected, "'"));
                }
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(node) {
                var res = {};
                node.getChildren().forEach(function(childNode) {
                    res[childNode.subpath] = childNode.snapshot;
                });
                return res;
            }
        },
        {
            key: "processInitialSnapshot",
            value: function processInitialSnapshot(childNodes) {
                var processed = {};
                Object.keys(childNodes).forEach(function(key) {
                    processed[key] = childNodes[key].getSnapshot();
                });
                return processed;
            }
        },
        {
            key: "didChange",
            value: function didChange(change) {
                var node = getStateTreeNode(change.object);
                switch(change.type){
                    case "update":
                        return void node.emitPatch({
                            op: "replace",
                            path: escapeJsonPath(change.name),
                            value: change.newValue.snapshot,
                            oldValue: change.oldValue ? change.oldValue.snapshot : void 0
                        }, node);
                    case "add":
                        return void node.emitPatch({
                            op: "add",
                            path: escapeJsonPath(change.name),
                            value: change.newValue.snapshot,
                            oldValue: void 0
                        }, node);
                    case "delete":
                        var oldSnapshot = change.oldValue.snapshot;
                        change.oldValue.die();
                        return void node.emitPatch({
                            op: "remove",
                            path: escapeJsonPath(change.name),
                            oldValue: oldSnapshot
                        }, node);
                }
            }
        },
        {
            key: "applyPatchLocally",
            value: function applyPatchLocally(node, subpath, patch) {
                var target = node.storedValue;
                switch(patch.op){
                    case "add":
                    case "replace":
                        target.set(subpath, patch.value);
                        break;
                    case "remove":
                        target.delete(subpath);
                        break;
                }
            }
        },
        {
            key: "applySnapshot",
            value: function applySnapshot(node, snapshot) {
                typecheckInternal(this, snapshot);
                var target = node.storedValue;
                var currentKeys = {};
                Array.from(target.keys()).forEach(function(key) {
                    currentKeys[key] = false;
                });
                if (snapshot) {
                    for(var key in snapshot){
                        target.set(key, snapshot[key]);
                        currentKeys["" + key] = true;
                    }
                }
                Object.keys(currentKeys).forEach(function(key) {
                    if (currentKeys[key] === false) target.delete(key);
                });
            }
        },
        {
            key: "getChildType",
            value: function getChildType() {
                return this._subType;
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                var _this = this;
                if (!isPlainObject(value)) {
                    return typeCheckFailure(context, value, "Value is not a plain object");
                }
                return flattenTypeErrors(Object.keys(value).map(function(path) {
                    return _this._subType.validate(value[path], getContextForPath(context, path, _this._subType));
                }));
            }
        },
        {
            key: "getDefaultSnapshot",
            value: function getDefaultSnapshot() {
                return EMPTY_OBJECT;
            }
        },
        {
            key: "removeChild",
            value: function removeChild(node, subpath) {
                node.storedValue.delete(subpath);
            }
        }
    ]);
    return _MapType;
}(ComplexType2);
MapType.prototype.applySnapshot = (0, import_mobx10.action)(MapType.prototype.applySnapshot);
function map(subtype) {
    return new MapType("Map<string, ".concat(subtype.name, ">"), subtype);
}
function isMapType(type) {
    return isType(type) && (type.flags & 64 /* Map */ ) > 0;
}
// src/types/complex-types/array.ts
var import_mobx11 = require("mobx");
var ArrayType = /*#__PURE__*/ function(ComplexType2) {
    _inherits(_ArrayType, ComplexType2);
    function _ArrayType(name, _subType) {
        var hookInitializers = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
        _class_call_check(this, _ArrayType);
        var _this;
        _this = _call_super(this, _ArrayType, [
            name
        ]);
        _this._subType = _subType;
        __publicField(_this, "flags", 32 /* Array */ );
        __publicField(_this, "hookInitializers", []);
        _this.hookInitializers = hookInitializers;
        return _this;
    }
    _create_class(_ArrayType, [
        {
            key: "hooks",
            value: function hooks(hooks) {
                var hookInitializers = this.hookInitializers.length > 0 ? this.hookInitializers.concat(hooks) : [
                    hooks
                ];
                return new _ArrayType(this.name, this._subType, hookInitializers);
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                return createObjectNode(this, parent, subpath, environment, initialValue);
            }
        },
        {
            key: "initializeChildNodes",
            value: function initializeChildNodes(objNode) {
                var snapshot = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : [];
                var subType = objNode.type._subType;
                var result = {};
                snapshot.forEach(function(item, index) {
                    var subpath = "" + index;
                    result[subpath] = subType.instantiate(objNode, subpath, void 0, item);
                });
                return result;
            }
        },
        {
            key: "createNewInstance",
            value: function createNewInstance(childNodes) {
                var options = _object_spread_props(_object_spread({}, mobxShallow), {
                    name: this.name
                });
                return import_mobx11.observable.array(convertChildNodesToArray(childNodes), options);
            }
        },
        {
            key: "finalizeNewInstance",
            value: function finalizeNewInstance(node, instance) {
                (0, import_mobx11._getAdministration)(instance).dehancer = node.unbox;
                var type = node.type;
                type.hookInitializers.forEach(function(initializer) {
                    var hooks = initializer(instance);
                    Object.keys(hooks).forEach(function(name) {
                        var hook = hooks[name];
                        var actionInvoker = createActionInvoker(instance, name, hook);
                        (!devMode() ? addHiddenFinalProp : addHiddenWritableProp)(instance, name, actionInvoker);
                    });
                });
                (0, import_mobx11.intercept)(instance, this.willChange);
                (0, import_mobx11.observe)(instance, this.didChange);
            }
        },
        {
            key: "describe",
            value: function describe() {
                return this.name;
            }
        },
        {
            key: "getChildren",
            value: function getChildren(node) {
                return node.storedValue.slice();
            }
        },
        {
            key: "getChildNode",
            value: function getChildNode(node, key) {
                var index = Number(key);
                if (index < node.storedValue.length) return node.storedValue[index];
                throw fail("Not a child: " + key);
            }
        },
        {
            key: "willChange",
            value: function willChange(change) {
                var node = getStateTreeNode(change.object);
                node.assertWritable({
                    subpath: "" + change.index
                });
                var subType = node.type._subType;
                var childNodes = node.getChildren();
                switch(change.type){
                    case "update":
                        {
                            if (change.newValue === change.object[change.index]) return null;
                            var updatedNodes = reconcileArrayChildren(node, subType, [
                                childNodes[change.index]
                            ], [
                                change.newValue
                            ], [
                                change.index
                            ]);
                            if (!updatedNodes) {
                                return null;
                            }
                            change.newValue = updatedNodes[0];
                        }
                        break;
                    case "splice":
                        {
                            var index = change.index, removedCount = change.removedCount, added = change.added;
                            var addedNodes = reconcileArrayChildren(node, subType, childNodes.slice(index, index + removedCount), added, added.map(function(_, i) {
                                return index + i;
                            }));
                            if (!addedNodes) {
                                return null;
                            }
                            change.added = addedNodes;
                            for(var i = index + removedCount; i < childNodes.length; i++){
                                childNodes[i].setParent(node, "" + (i + added.length - removedCount));
                            }
                        }
                        break;
                }
                return change;
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(node) {
                return node.getChildren().map(function(childNode) {
                    return childNode.snapshot;
                });
            }
        },
        {
            key: "processInitialSnapshot",
            value: function processInitialSnapshot(childNodes) {
                var processed = [];
                Object.keys(childNodes).forEach(function(key) {
                    processed.push(childNodes[key].getSnapshot());
                });
                return processed;
            }
        },
        {
            key: "didChange",
            value: function didChange(change) {
                var node = getStateTreeNode(change.object);
                switch(change.type){
                    case "update":
                        return void node.emitPatch({
                            op: "replace",
                            path: "" + change.index,
                            value: change.newValue.snapshot,
                            oldValue: change.oldValue ? change.oldValue.snapshot : void 0
                        }, node);
                    case "splice":
                        for(var i = change.removedCount - 1; i >= 0; i--)node.emitPatch({
                            op: "remove",
                            path: "" + (change.index + i),
                            oldValue: change.removed[i].snapshot
                        }, node);
                        for(var i1 = 0; i1 < change.addedCount; i1++)node.emitPatch({
                            op: "add",
                            path: "" + (change.index + i1),
                            value: node.getChildNode("" + (change.index + i1)).snapshot,
                            oldValue: void 0
                        }, node);
                        return;
                }
            }
        },
        {
            key: "applyPatchLocally",
            value: function applyPatchLocally(node, subpath, patch) {
                var target = node.storedValue;
                var index = subpath === "-" ? target.length : Number(subpath);
                switch(patch.op){
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
        },
        {
            key: "applySnapshot",
            value: function applySnapshot(node, snapshot) {
                typecheckInternal(this, snapshot);
                var target = node.storedValue;
                target.replace(snapshot);
            }
        },
        {
            key: "getChildType",
            value: function getChildType() {
                return this._subType;
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                var _this = this;
                if (!isArray(value)) {
                    return typeCheckFailure(context, value, "Value is not an array");
                }
                return flattenTypeErrors(value.map(function(item, index) {
                    return _this._subType.validate(item, getContextForPath(context, "" + index, _this._subType));
                }));
            }
        },
        {
            key: "getDefaultSnapshot",
            value: function getDefaultSnapshot() {
                return EMPTY_ARRAY;
            }
        },
        {
            key: "removeChild",
            value: function removeChild(node, subpath) {
                node.storedValue.splice(Number(subpath), 1);
            }
        }
    ]);
    return _ArrayType;
}(ComplexType2);
ArrayType.prototype.applySnapshot = (0, import_mobx11.action)(ArrayType.prototype.applySnapshot);
function array(subtype) {
    assertIsType(subtype, 1);
    return new ArrayType("".concat(subtype.name, "[]"), subtype);
}
function reconcileArrayChildren(parent, childType, oldNodes, newValues, newPaths) {
    var nothingChanged = true;
    for(var i = 0;; i++){
        var hasNewNode = i <= newValues.length - 1;
        var oldNode = oldNodes[i];
        var newValue = hasNewNode ? newValues[i] : void 0;
        var newPath = "" + newPaths[i];
        if (isNode(newValue)) newValue = newValue.storedValue;
        if (!oldNode && !hasNewNode) {
            break;
        } else if (!hasNewNode) {
            nothingChanged = false;
            oldNodes.splice(i, 1);
            if (_instanceof(oldNode, ObjectNode)) {
                oldNode.createObservableInstanceIfNeeded();
            }
            oldNode.die();
            i--;
        } else if (!oldNode) {
            if (isStateTreeNode(newValue) && getStateTreeNode(newValue).parent === parent) {
                throw fail("Cannot add an object to a state tree if it is already part of the same or another state tree. Tried to assign an object to '".concat(parent.path, "/").concat(newPath, "', but it lives already at '").concat(getStateTreeNode(newValue).path, "'"));
            }
            nothingChanged = false;
            var newNode = valueAsNode(childType, parent, newPath, newValue);
            oldNodes.splice(i, 0, newNode);
        } else if (areSame(oldNode, newValue)) {
            oldNodes[i] = valueAsNode(childType, parent, newPath, newValue, oldNode);
        } else {
            var oldMatch = void 0;
            for(var j = i; j < oldNodes.length; j++){
                if (areSame(oldNodes[j], newValue)) {
                    oldMatch = oldNodes.splice(j, 1)[0];
                    break;
                }
            }
            nothingChanged = false;
            var newNode1 = valueAsNode(childType, parent, newPath, newValue, oldMatch);
            oldNodes.splice(i, 0, newNode1);
        }
    }
    return nothingChanged ? null : oldNodes;
}
function valueAsNode(childType, parent, subpath, newValue, oldNode) {
    typecheckInternal(childType, newValue);
    function getNewNode() {
        if (isStateTreeNode(newValue)) {
            var childNode = getStateTreeNode(newValue);
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
    var newNode = getNewNode();
    if (oldNode && oldNode !== newNode) {
        if (_instanceof(oldNode, ObjectNode)) {
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
        var newNode = getStateTreeNode(newValue);
        return newNode.isAlive && newNode === oldNode;
    }
    if (oldNode.snapshot === newValue) {
        return true;
    }
    if (!_instanceof(oldNode, ObjectNode)) {
        return false;
    }
    var oldNodeType = oldNode.getReconciliationType();
    return oldNode.identifier !== null && oldNode.identifierAttribute && isPlainObject(newValue) && oldNodeType.is(newValue) && oldNodeType.isMatchingSnapshotId(oldNode, newValue);
}
function isArrayType(type) {
    return isType(type) && (type.flags & 32 /* Array */ ) > 0;
}
// src/types/complex-types/model.ts
var import_mobx12 = require("mobx");
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
    var keysList = Object.keys(declaredProps);
    var alreadySeenKeys = /* @__PURE__ */ new Set();
    keysList.forEach(function(key) {
        if (alreadySeenKeys.has(key)) {
            throw fail("".concat(key, " is declared twice in the model. Model should not contain the same keys"));
        }
        alreadySeenKeys.add(key);
    });
    return keysList.reduce(function(props, key) {
        if (key in Hook) {
            throw fail("Hook '".concat(key, "' was defined as property. Hooks should be defined as part of the actions"));
        }
        var descriptor = Object.getOwnPropertyDescriptor(declaredProps, key);
        if ("get" in descriptor) {
            throw fail("Getters are not supported as properties. Please use views instead");
        }
        var value = descriptor.value;
        if (value === null || value === void 0) {
            throw fail("The default value of an attribute cannot be null or undefined as the type cannot be inferred. Did you mean `types.maybe(someType)`?");
        } else if (isPrimitive(value)) {
            props[key] = optional(getPrimitiveFactoryFromValue(value), value);
        } else if (_instanceof(value, MapType)) {
            props[key] = optional(value, {});
        } else if (_instanceof(value, ArrayType)) {
            props[key] = optional(value, []);
        } else if (isType(value)) {} else if (devMode() && typeof value === "function") {
            throw fail("Invalid type definition for property '".concat(key, "', it looks like you passed a function. Did you forget to invoke it, or did you intend to declare a view / action?"));
        } else if (devMode() && (typeof value === "undefined" ? "undefined" : _type_of(value)) === "object") {
            throw fail("Invalid type definition for property '".concat(key, "', it looks like you passed an object. Try passing another model type or a types.frozen."));
        } else {
            throw fail("Invalid type definition for property '".concat(key, "', cannot infer a type from a value like '").concat(value, "' (").concat(typeof value === "undefined" ? "undefined" : _type_of(value), ")"));
        }
        return props;
    }, _object_spread({}, declaredProps));
}
var ModelType = /*#__PURE__*/ function(ComplexType2) {
    _inherits(_ModelType, ComplexType2);
    function _ModelType(opts) {
        _class_call_check(this, _ModelType);
        var _this;
        _this = _call_super(this, _ModelType, [
            opts.name || defaultObjectOptions.name
        ]);
        __publicField(_this, "flags", 128 /* Object */ );
        /*
     * The original object definition
     */ __publicField(_this, "initializers");
        __publicField(_this, "properties");
        __publicField(_this, "preProcessor");
        __publicField(_this, "postProcessor");
        __publicField(_this, "propertyNames");
        __publicField(_this, "named", function(name) {
            return _this.cloneAndEnhance({
                name: name
            });
        });
        __publicField(_this, "props", function(properties) {
            return _this.cloneAndEnhance({
                properties: properties
            });
        });
        __publicField(_this, "preProcessSnapshot", function(preProcessor) {
            var currentPreprocessor = _this.preProcessor;
            if (!currentPreprocessor) return _this.cloneAndEnhance({
                preProcessor: preProcessor
            });
            else return _this.cloneAndEnhance({
                preProcessor: function(snapshot) {
                    return currentPreprocessor(preProcessor(snapshot));
                }
            });
        });
        __publicField(_this, "postProcessSnapshot", function(postProcessor) {
            var currentPostprocessor = _this.postProcessor;
            if (!currentPostprocessor) return _this.cloneAndEnhance({
                postProcessor: postProcessor
            });
            else return _this.cloneAndEnhance({
                postProcessor: function(snapshot) {
                    return postProcessor(currentPostprocessor(snapshot));
                }
            });
        });
        Object.assign(_this, defaultObjectOptions, opts);
        _this.properties = toPropertiesObject(_this.properties);
        freeze(_this.properties);
        _this.propertyNames = Object.keys(_this.properties);
        _this.identifierAttribute = _this._getIdentifierAttribute();
        return _this;
    }
    _create_class(_ModelType, [
        {
            key: "_getIdentifierAttribute",
            value: function _getIdentifierAttribute() {
                var identifierAttribute = void 0;
                this.forAllProps(function(propName, propType) {
                    if (propType.flags & 2048 /* Identifier */ ) {
                        if (identifierAttribute) throw fail("Cannot define property '".concat(propName, "' as object identifier, property '").concat(identifierAttribute, "' is already defined as identifier property"));
                        identifierAttribute = propName;
                    }
                });
                return identifierAttribute;
            }
        },
        {
            key: "cloneAndEnhance",
            value: function cloneAndEnhance(opts) {
                return new _ModelType({
                    name: opts.name || this.name,
                    properties: Object.assign({}, this.properties, opts.properties),
                    initializers: this.initializers.concat(opts.initializers || []),
                    preProcessor: opts.preProcessor || this.preProcessor,
                    postProcessor: opts.postProcessor || this.postProcessor
                });
            }
        },
        {
            key: "actions",
            value: function actions(fn) {
                var _this = this;
                var actionInitializer = function(self) {
                    _this.instantiateActions(self, fn(self));
                    return self;
                };
                return this.cloneAndEnhance({
                    initializers: [
                        actionInitializer
                    ]
                });
            }
        },
        {
            key: "instantiateActions",
            value: function instantiateActions(self, actions) {
                if (!isPlainObject(actions)) throw fail("actions initializer should return a plain object containing actions");
                Object.keys(actions).forEach(function(name) {
                    if (name === PRE_PROCESS_SNAPSHOT) throw fail("Cannot define action '".concat(PRE_PROCESS_SNAPSHOT, "', it should be defined using 'type.preProcessSnapshot(fn)' instead"));
                    if (name === POST_PROCESS_SNAPSHOT) throw fail("Cannot define action '".concat(POST_PROCESS_SNAPSHOT, "', it should be defined using 'type.postProcessSnapshot(fn)' instead"));
                    var action22 = actions[name];
                    var baseAction = self[name];
                    if (name in Hook && baseAction) {
                        var specializedAction = action22;
                        action22 = function action22() {
                            baseAction.apply(null, arguments);
                            specializedAction.apply(null, arguments);
                        };
                    }
                    var middlewares = action22.$mst_middleware;
                    var boundAction = action22.bind(actions);
                    boundAction._isFlowAction = action22._isFlowAction || false;
                    boundAction.$mst_middleware = middlewares;
                    var actionInvoker = createActionInvoker(self, name, boundAction);
                    actions[name] = actionInvoker;
                    (!devMode() ? addHiddenFinalProp : addHiddenWritableProp)(self, name, actionInvoker);
                });
            }
        },
        {
            key: "volatile",
            value: function volatile(fn) {
                var _this = this;
                if (typeof fn !== "function") {
                    throw fail("You passed an ".concat(typeof fn === "undefined" ? "undefined" : _type_of(fn), " to volatile state as an argument, when function is expected"));
                }
                var stateInitializer = function(self) {
                    _this.instantiateVolatileState(self, fn(self));
                    return self;
                };
                return this.cloneAndEnhance({
                    initializers: [
                        stateInitializer
                    ]
                });
            }
        },
        {
            key: "instantiateVolatileState",
            value: function instantiateVolatileState(self, state) {
                if (!isPlainObject(state)) throw fail("volatile state initializer should return a plain object containing state");
                (0, import_mobx12.set)(self, state);
            }
        },
        {
            key: "extend",
            value: function extend(fn) {
                var _this = this;
                var initializer = function(self) {
                    var _fn = fn(self), actions = _fn.actions, views = _fn.views, state = _fn.state, rest = _object_without_properties(_fn, [
                        "actions",
                        "views",
                        "state"
                    ]);
                    for(var key in rest)throw fail("The `extend` function should return an object with a subset of the fields 'actions', 'views' and 'state'. Found invalid key '".concat(key, "'"));
                    if (state) _this.instantiateVolatileState(self, state);
                    if (views) _this.instantiateViews(self, views);
                    if (actions) _this.instantiateActions(self, actions);
                    return self;
                };
                return this.cloneAndEnhance({
                    initializers: [
                        initializer
                    ]
                });
            }
        },
        {
            key: "views",
            value: function views(fn) {
                var _this = this;
                var viewInitializer = function(self) {
                    _this.instantiateViews(self, fn(self));
                    return self;
                };
                return this.cloneAndEnhance({
                    initializers: [
                        viewInitializer
                    ]
                });
            }
        },
        {
            key: "instantiateViews",
            value: function instantiateViews(self, views) {
                if (!isPlainObject(views)) throw fail("views initializer should return a plain object containing views");
                Object.getOwnPropertyNames(views).forEach(function(key) {
                    var descriptor = Object.getOwnPropertyDescriptor(views, key);
                    if ("get" in descriptor) {
                        (0, import_mobx12.defineProperty)(self, key, descriptor);
                        (0, import_mobx12.makeObservable)(self, _define_property({}, key, import_mobx12.computed));
                    } else if (typeof descriptor.value === "function") {
                        ;
                        (!devMode() ? addHiddenFinalProp : addHiddenWritableProp)(self, key, descriptor.value);
                    } else {
                        throw fail("A view member should either be a function or getter based property");
                    }
                });
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                var value = isStateTreeNode(initialValue) ? initialValue : this.applySnapshotPreProcessor(initialValue);
                return createObjectNode(this, parent, subpath, environment, value);
            }
        },
        {
            key: "initializeChildNodes",
            value: function initializeChildNodes(objNode) {
                var initialSnapshot = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
                var type = objNode.type;
                var result = {};
                type.forAllProps(function(name, childType) {
                    result[name] = childType.instantiate(objNode, name, void 0, initialSnapshot[name]);
                });
                return result;
            }
        },
        {
            key: "createNewInstance",
            value: function createNewInstance(childNodes) {
                var options = _object_spread_props(_object_spread({}, mobxShallow), {
                    name: this.name
                });
                return import_mobx12.observable.object(childNodes, EMPTY_OBJECT, options);
            }
        },
        {
            key: "finalizeNewInstance",
            value: function finalizeNewInstance(node, instance) {
                addHiddenFinalProp(instance, "toString", objectTypeToString);
                this.forAllProps(function(name) {
                    (0, import_mobx12._interceptReads)(instance, name, node.unbox);
                });
                this.initializers.reduce(function(self, fn) {
                    return fn(self);
                }, instance);
                (0, import_mobx12.intercept)(instance, this.willChange);
                (0, import_mobx12.observe)(instance, this.didChange);
            }
        },
        {
            key: "willChange",
            value: function willChange(chg) {
                var change = chg;
                var node = getStateTreeNode(change.object);
                var subpath = change.name;
                node.assertWritable({
                    subpath: subpath
                });
                var childType = node.type.properties[subpath];
                if (childType) {
                    typecheckInternal(childType, change.newValue);
                    change.newValue = childType.reconcile(node.getChildNode(subpath), change.newValue, node, subpath);
                }
                return change;
            }
        },
        {
            key: "didChange",
            value: function didChange(chg) {
                var change = chg;
                var childNode = getStateTreeNode(change.object);
                var childType = childNode.type.properties[change.name];
                if (!childType) {
                    return;
                }
                var oldChildValue = change.oldValue ? change.oldValue.snapshot : void 0;
                childNode.emitPatch({
                    op: "replace",
                    path: escapeJsonPath(change.name),
                    value: change.newValue.snapshot,
                    oldValue: oldChildValue
                }, childNode);
            }
        },
        {
            key: "getChildren",
            value: function getChildren(node) {
                var _this = this;
                var res = [];
                this.forAllProps(function(name) {
                    res.push(_this.getChildNode(node, name));
                });
                return res;
            }
        },
        {
            key: "getChildNode",
            value: function getChildNode(node, key) {
                var _adm_raw;
                if (!(key in this.properties)) throw fail("Not a value property: " + key);
                var adm = (0, import_mobx12._getAdministration)(node.storedValue, key);
                var childNode = (_adm_raw = adm.raw) === null || _adm_raw === void 0 ? void 0 : _adm_raw.call(adm);
                if (!childNode) throw fail("Node not available for property " + key);
                return childNode;
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(node) {
                var _this = this;
                var applyPostProcess = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
                var res = {};
                this.forAllProps(function(name, type) {
                    try {
                        var atom = (0, import_mobx12.getAtom)(node.storedValue, name);
                        atom.reportObserved();
                    } catch (e) {
                        throw fail("".concat(name, " property is declared twice"));
                    }
                    res[name] = _this.getChildNode(node, name).snapshot;
                });
                if (applyPostProcess) {
                    return this.applySnapshotPostProcessor(res);
                }
                return res;
            }
        },
        {
            key: "processInitialSnapshot",
            value: function processInitialSnapshot(childNodes) {
                var processed = {};
                Object.keys(childNodes).forEach(function(key) {
                    processed[key] = childNodes[key].getSnapshot();
                });
                return this.applySnapshotPostProcessor(processed);
            }
        },
        {
            key: "applyPatchLocally",
            value: function applyPatchLocally(node, subpath, patch) {
                if (!(patch.op === "replace" || patch.op === "add")) {
                    throw fail("object does not support operation ".concat(patch.op));
                }
                ;
                node.storedValue[subpath] = patch.value;
            }
        },
        {
            key: "applySnapshot",
            value: function applySnapshot(node, snapshot) {
                typecheckInternal(this, snapshot);
                var preProcessedSnapshot = this.applySnapshotPreProcessor(snapshot);
                this.forAllProps(function(name) {
                    ;
                    node.storedValue[name] = preProcessedSnapshot[name];
                });
            }
        },
        {
            key: "applySnapshotPreProcessor",
            value: function applySnapshotPreProcessor(snapshot) {
                var processor = this.preProcessor;
                return processor ? processor.call(null, snapshot) : snapshot;
            }
        },
        {
            key: "applySnapshotPostProcessor",
            value: function applySnapshotPostProcessor(snapshot) {
                var postProcessor = this.postProcessor;
                if (postProcessor) return postProcessor.call(null, snapshot);
                return snapshot;
            }
        },
        {
            key: "getChildType",
            value: function getChildType(propertyName) {
                assertIsString(propertyName, 1);
                return this.properties[propertyName];
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                var _this = this;
                var snapshot = this.applySnapshotPreProcessor(value);
                if (!isPlainObject(snapshot)) {
                    return typeCheckFailure(context, snapshot, "Value is not a plain object");
                }
                return flattenTypeErrors(this.propertyNames.map(function(key) {
                    return _this.properties[key].validate(snapshot[key], getContextForPath(context, key, _this.properties[key]));
                }));
            }
        },
        {
            key: "forAllProps",
            value: function forAllProps(fn) {
                var _this = this;
                this.propertyNames.forEach(function(key) {
                    return fn(key, _this.properties[key]);
                });
            }
        },
        {
            key: "describe",
            value: function describe() {
                var _this = this;
                return "{ " + this.propertyNames.map(function(key) {
                    return key + ": " + _this.properties[key].describe();
                }).join("; ") + " }";
            }
        },
        {
            key: "getDefaultSnapshot",
            value: function getDefaultSnapshot() {
                return EMPTY_OBJECT;
            }
        },
        {
            key: "removeChild",
            value: function removeChild(node, subpath) {
                ;
                node.storedValue[subpath] = void 0;
            }
        }
    ]);
    return _ModelType;
}(ComplexType2);
ModelType.prototype.applySnapshot = (0, import_mobx12.action)(ModelType.prototype.applySnapshot);
function model() {
    for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
        args[_key] = arguments[_key];
    }
    if (devMode() && typeof args[0] !== "string" && args[1]) {
        throw fail("Model creation failed. First argument must be a string when two arguments are provided");
    }
    var name = typeof args[0] === "string" ? args.shift() : "AnonymousModel";
    var properties = args.shift() || {};
    return new ModelType({
        name: name,
        properties: properties
    });
}
function compose() {
    for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
        args[_key] = arguments[_key];
    }
    var hasTypename = typeof args[0] === "string";
    var typeName = hasTypename ? args[0] : "AnonymousModel";
    if (hasTypename) {
        args.shift();
    }
    if (devMode()) {
        args.forEach(function(type, i) {
            assertArg(type, isModelType, "mobx-state-tree model type", hasTypename ? i + 2 : i + 1);
        });
    }
    return args.reduce(function(prev, cur) {
        return prev.cloneAndEnhance({
            name: prev.name + "_" + cur.name,
            properties: cur.properties,
            initializers: cur.initializers,
            preProcessor: function(snapshot) {
                return cur.applySnapshotPreProcessor(prev.applySnapshotPreProcessor(snapshot));
            },
            postProcessor: function(snapshot) {
                return cur.applySnapshotPostProcessor(prev.applySnapshotPostProcessor(snapshot));
            }
        });
    }).named(typeName);
}
function isModelType(type) {
    return isType(type) && (type.flags & 128 /* Object */ ) > 0;
}
// src/types/primitives.ts
var CoreType = /*#__PURE__*/ function(SimpleType2) {
    _inherits(CoreType, SimpleType2);
    function CoreType(name, flags, checker) {
        var initializer = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : identity;
        _class_call_check(this, CoreType);
        var _this;
        _this = _call_super(this, CoreType, [
            name
        ]);
        _this.flags = flags;
        _this.checker = checker;
        _this.initializer = initializer;
        _this.flags = flags;
        return _this;
    }
    _create_class(CoreType, [
        {
            key: "describe",
            value: function describe() {
                return this.name;
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                return createScalarNode(this, parent, subpath, environment, initialValue);
            }
        },
        {
            key: "createNewInstance",
            value: function createNewInstance(snapshot) {
                return this.initializer(snapshot);
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                if (isPrimitive(value) && this.checker(value)) {
                    return typeCheckSuccess();
                }
                var typeName = this.name === "Date" ? "Date or a unix milliseconds timestamp" : this.name;
                return typeCheckFailure(context, value, "Value is not a ".concat(typeName));
            }
        }
    ]);
    return CoreType;
}(SimpleType2);
var string = new CoreType("string", 1 /* String */ , function(v) {
    return typeof v === "string";
});
var number = new CoreType("number", 2 /* Number */ , function(v) {
    return typeof v === "number";
});
var integer = new CoreType("integer", 131072 /* Integer */ , function(v) {
    return isInteger(v);
});
var float = new CoreType("float", 4194304 /* Float */ , function(v) {
    return isFloat(v);
});
var finite = new CoreType("finite", 2097152 /* Finite */ , function(v) {
    return isFinite(v);
});
var boolean = new CoreType("boolean", 4 /* Boolean */ , function(v) {
    return typeof v === "boolean";
});
var nullType = new CoreType("null", 32768 /* Null */ , function(v) {
    return v === null;
});
var undefinedType = new CoreType("undefined", 65536 /* Undefined */ , function(v) {
    return v === void 0;
});
var _DatePrimitive = new CoreType("Date", 8 /* Date */ , function(v) {
    return typeof v === "number" || _instanceof(v, Date);
}, function(v) {
    return _instanceof(v, Date) ? v : new Date(v);
});
_DatePrimitive.getSnapshot = function(node) {
    return node.storedValue.getTime();
};
var DatePrimitive = _DatePrimitive;
function getPrimitiveFactoryFromValue(value) {
    switch(typeof value === "undefined" ? "undefined" : _type_of(value)){
        case "string":
            return string;
        case "number":
            return number;
        // In the future, isInteger(value) ? integer : number would be interesting, but would be too breaking for now
        case "boolean":
            return boolean;
        case "object":
            if (_instanceof(value, Date)) return DatePrimitive;
    }
    throw fail("Cannot determine primitive type from value " + value);
}
function isPrimitiveType(type) {
    return isType(type) && (type.flags & (1 /* String */  | 2 /* Number */  | 131072 /* Integer */  | 4 /* Boolean */  | 8 /* Date */ )) > 0;
}
// src/types/utility-types/literal.ts
var Literal = /*#__PURE__*/ function(SimpleType2) {
    _inherits(Literal, SimpleType2);
    function Literal(value) {
        _class_call_check(this, Literal);
        var _this;
        _this = _call_super(this, Literal, [
            JSON.stringify(value)
        ]);
        __publicField(_this, "value");
        __publicField(_this, "flags", 16 /* Literal */ );
        _this.value = value;
        return _this;
    }
    _create_class(Literal, [
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                return createScalarNode(this, parent, subpath, environment, initialValue);
            }
        },
        {
            key: "describe",
            value: function describe() {
                return JSON.stringify(this.value);
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                if (isPrimitive(value) && value === this.value) {
                    return typeCheckSuccess();
                }
                return typeCheckFailure(context, value, "Value is not a literal ".concat(JSON.stringify(this.value)));
            }
        }
    ]);
    return Literal;
}(SimpleType2);
function literal(value) {
    assertArg(value, isPrimitive, "primitive", 1);
    return new Literal(value);
}
function isLiteralType(type) {
    return isType(type) && (type.flags & 16 /* Literal */ ) > 0;
}
// src/types/utility-types/refinement.ts
var Refinement = /*#__PURE__*/ function(BaseType) {
    _inherits(Refinement, BaseType);
    function Refinement(name, _subtype, _predicate, _message) {
        _class_call_check(this, Refinement);
        var _this;
        _this = _call_super(this, Refinement, [
            name
        ]);
        _this._subtype = _subtype;
        _this._predicate = _predicate;
        _this._message = _message;
        return _this;
    }
    _create_class(Refinement, [
        {
            key: "flags",
            get: function get() {
                return this._subtype.flags | 8192 /* Refinement */ ;
            }
        },
        {
            key: "describe",
            value: function describe() {
                return this.name;
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                return this._subtype.instantiate(parent, subpath, environment, initialValue);
            }
        },
        {
            key: "isAssignableFrom",
            value: function isAssignableFrom(type) {
                return this._subtype.isAssignableFrom(type);
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                var subtypeErrors = this._subtype.validate(value, context);
                if (subtypeErrors.length > 0) return subtypeErrors;
                var snapshot = isStateTreeNode(value) ? getStateTreeNode(value).snapshot : value;
                if (!this._predicate(snapshot)) {
                    return typeCheckFailure(context, value, this._message(value));
                }
                return typeCheckSuccess();
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                return this._subtype.reconcile(current, newValue, parent, subpath);
            }
        },
        {
            key: "getSubTypes",
            value: function getSubTypes() {
                return this._subtype;
            }
        }
    ]);
    return Refinement;
}(BaseType);
function refinement() {
    for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
        args[_key] = arguments[_key];
    }
    var name = typeof args[0] === "string" ? args.shift() : isType(args[0]) ? args[0].name : null;
    var type = args[0];
    var predicate = args[1];
    var message = args[2] ? args[2] : function(v) {
        return "Value does not respect the refinement predicate";
    };
    assertIsType(type, [
        1,
        2
    ]);
    assertIsString(name, 1);
    assertIsFunction(predicate, [
        2,
        3
    ]);
    assertIsFunction(message, [
        3,
        4
    ]);
    return new Refinement(name, type, predicate, message);
}
function isRefinementType(type) {
    return (type.flags & 8192 /* Refinement */ ) > 0;
}
// src/types/utility-types/enumeration.ts
function enumeration(name, options) {
    var realOptions = typeof name === "string" ? options : name;
    if (devMode()) {
        realOptions.forEach(function(option, i) {
            assertIsString(option, i + 1);
        });
    }
    var type = union.apply(void 0, _to_consumable_array(realOptions.map(function(option) {
        return literal("" + option);
    })));
    if (typeof name === "string") type.name = name;
    return type;
}
// src/types/utility-types/union.ts
var Union = /*#__PURE__*/ function(BaseType) {
    _inherits(Union, BaseType);
    function Union(name, _types, options) {
        _class_call_check(this, Union);
        var _this;
        _this = _call_super(this, Union, [
            name
        ]);
        _this._types = _types;
        __publicField(_this, "_dispatcher");
        __publicField(_this, "_eager", true);
        options = _object_spread({
            eager: true,
            dispatcher: void 0
        }, options);
        _this._dispatcher = options.dispatcher;
        if (!options.eager) _this._eager = false;
        return _this;
    }
    _create_class(Union, [
        {
            key: "flags",
            get: function get() {
                var result = 16384 /* Union */ ;
                this._types.forEach(function(type) {
                    result |= type.flags;
                });
                return result;
            }
        },
        {
            key: "isAssignableFrom",
            value: function isAssignableFrom(type) {
                return this._types.some(function(subType) {
                    return subType.isAssignableFrom(type);
                });
            }
        },
        {
            key: "describe",
            value: function describe() {
                return "(" + this._types.map(function(factory) {
                    return factory.describe();
                }).join(" | ") + ")";
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                var type = this.determineType(initialValue, void 0);
                if (!type) throw fail("No matching type for union " + this.describe());
                return type.instantiate(parent, subpath, environment, initialValue);
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                var type = this.determineType(newValue, current.getReconciliationType());
                if (!type) throw fail("No matching type for union " + this.describe());
                return type.reconcile(current, newValue, parent, subpath);
            }
        },
        {
            key: "determineType",
            value: function determineType(value, reconcileCurrentType) {
                if (this._dispatcher) {
                    return this._dispatcher(value);
                }
                if (reconcileCurrentType) {
                    if (reconcileCurrentType.is(value)) {
                        return reconcileCurrentType;
                    }
                    return this._types.filter(function(t1) {
                        return t1 !== reconcileCurrentType;
                    }).find(function(type) {
                        return type.is(value);
                    });
                } else {
                    return this._types.find(function(type) {
                        return type.is(value);
                    });
                }
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                if (this._dispatcher) {
                    return this._dispatcher(value).validate(value, context);
                }
                var allErrors = [];
                var applicableTypes = 0;
                for(var i = 0; i < this._types.length; i++){
                    var type = this._types[i];
                    var errors = type.validate(value, context);
                    if (errors.length === 0) {
                        if (this._eager) return typeCheckSuccess();
                        else applicableTypes++;
                    } else {
                        allErrors.push(errors);
                    }
                }
                if (applicableTypes === 1) return typeCheckSuccess();
                return typeCheckFailure(context, value, "No type is applicable for the union").concat(flattenTypeErrors(allErrors));
            }
        },
        {
            key: "getSubTypes",
            value: function getSubTypes() {
                return this._types;
            }
        }
    ]);
    return Union;
}(BaseType);
function union(optionsOrType) {
    for(var _len = arguments.length, otherTypes = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
        otherTypes[_key - 1] = arguments[_key];
    }
    var options = isType(optionsOrType) ? void 0 : optionsOrType;
    var types2 = isType(optionsOrType) ? [
        optionsOrType
    ].concat(_to_consumable_array(otherTypes)) : otherTypes;
    var name = "(" + types2.map(function(type) {
        return type.name;
    }).join(" | ") + ")";
    if (devMode()) {
        if (options) {
            assertArg(options, function(o) {
                return isPlainObject(o);
            }, "object { eager?: boolean, dispatcher?: Function }", 1);
        }
        types2.forEach(function(type, i) {
            assertIsType(type, options ? i + 2 : i + 1);
        });
    }
    return new Union(name, types2, options);
}
function isUnionType(type) {
    return (type.flags & 16384 /* Union */ ) > 0;
}
// src/types/utility-types/optional.ts
var OptionalValue = /*#__PURE__*/ function(BaseType) {
    _inherits(OptionalValue, BaseType);
    function OptionalValue(_subtype, _defaultValue, optionalValues) {
        _class_call_check(this, OptionalValue);
        var _this;
        _this = _call_super(this, OptionalValue, [
            _subtype.name
        ]);
        _this._subtype = _subtype;
        _this._defaultValue = _defaultValue;
        _this.optionalValues = optionalValues;
        return _this;
    }
    _create_class(OptionalValue, [
        {
            key: "flags",
            get: function get() {
                return this._subtype.flags | 512 /* Optional */ ;
            }
        },
        {
            key: "describe",
            value: function describe() {
                return this._subtype.describe() + "?";
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                if (this.optionalValues.indexOf(initialValue) >= 0) {
                    var defaultInstanceOrSnapshot = this.getDefaultInstanceOrSnapshot();
                    return this._subtype.instantiate(parent, subpath, environment, defaultInstanceOrSnapshot);
                }
                return this._subtype.instantiate(parent, subpath, environment, initialValue);
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                return this._subtype.reconcile(current, this.optionalValues.indexOf(newValue) < 0 && this._subtype.is(newValue) ? newValue : this.getDefaultInstanceOrSnapshot(), parent, subpath);
            }
        },
        {
            key: "getDefaultInstanceOrSnapshot",
            value: function getDefaultInstanceOrSnapshot() {
                var defaultInstanceOrSnapshot = typeof this._defaultValue === "function" ? this._defaultValue() : this._defaultValue;
                if (typeof this._defaultValue === "function") {
                    typecheckInternal(this, defaultInstanceOrSnapshot);
                }
                return defaultInstanceOrSnapshot;
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                if (this.optionalValues.indexOf(value) >= 0) {
                    return typeCheckSuccess();
                }
                return this._subtype.validate(value, context);
            }
        },
        {
            key: "isAssignableFrom",
            value: function isAssignableFrom(type) {
                return this._subtype.isAssignableFrom(type);
            }
        },
        {
            key: "getSubTypes",
            value: function getSubTypes() {
                return this._subtype;
            }
        }
    ]);
    return OptionalValue;
}(BaseType);
function checkOptionalPreconditions(type, defaultValueOrFunction) {
    if (typeof defaultValueOrFunction !== "function" && isStateTreeNode(defaultValueOrFunction)) {
        throw fail("default value cannot be an instance, pass a snapshot or a function that creates an instance/snapshot instead");
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
    return new OptionalValue(type, defaultValueOrFunction, optionalValues ? optionalValues : undefinedAsOptionalValues);
}
var undefinedAsOptionalValues = [
    void 0
];
function isOptionalType(type) {
    return isType(type) && (type.flags & 512 /* Optional */ ) > 0;
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
var Late = /*#__PURE__*/ function(BaseType) {
    _inherits(Late, BaseType);
    function Late(name, _definition) {
        _class_call_check(this, Late);
        var _this;
        _this = _call_super(this, Late, [
            name
        ]);
        _this._definition = _definition;
        __publicField(_this, "_subType");
        return _this;
    }
    _create_class(Late, [
        {
            key: "flags",
            get: function get() {
                return (this._subType ? this._subType.flags : 0) | 4096 /* Late */ ;
            }
        },
        {
            key: "getSubType",
            value: function getSubType(mustSucceed) {
                if (!this._subType) {
                    var _$t = void 0;
                    try {
                        _$t = this._definition();
                    } catch (e) {
                        if (_instanceof(e, ReferenceError)) _$t = void 0;
                        else throw e;
                    }
                    if (mustSucceed && _$t === void 0) throw fail("Late type seems to be used too early, the definition (still) returns undefined");
                    if (_$t) {
                        if (devMode() && !isType(_$t)) throw fail("Failed to determine subtype, make sure types.late returns a type definition.");
                        this._subType = _$t;
                    }
                }
                return this._subType;
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                return this.getSubType(true).instantiate(parent, subpath, environment, initialValue);
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                return this.getSubType(true).reconcile(current, newValue, parent, subpath);
            }
        },
        {
            key: "describe",
            value: function describe() {
                var _$t = this.getSubType(false);
                return _$t ? _$t.name : "<uknown late type>";
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                var _$t = this.getSubType(false);
                if (!_$t) {
                    return typeCheckSuccess();
                }
                return _$t.validate(value, context);
            }
        },
        {
            key: "isAssignableFrom",
            value: function isAssignableFrom(type) {
                var _$t = this.getSubType(false);
                return _$t ? _$t.isAssignableFrom(type) : false;
            }
        },
        {
            key: "getSubTypes",
            value: function getSubTypes() {
                var subtype = this.getSubType(false);
                return subtype ? subtype : cannotDetermineSubtype;
            }
        }
    ]);
    return Late;
}(BaseType);
function late(nameOrType, maybeType) {
    var name = typeof nameOrType === "string" ? nameOrType : "late(".concat(nameOrType.toString(), ")");
    var type = typeof nameOrType === "string" ? maybeType : nameOrType;
    if (devMode()) {
        if (!(typeof type === "function" && type.length === 0)) throw fail("Invalid late type, expected a function with zero arguments that returns a type, got: " + type);
    }
    return new Late(name, type);
}
function isLateType(type) {
    return isType(type) && (type.flags & 4096 /* Late */ ) > 0;
}
// src/types/utility-types/lazy.ts
var import_mobx13 = require("mobx");
function lazy(name, options) {
    return new Lazy(name, options);
}
var Lazy = /*#__PURE__*/ function(SimpleType2) {
    _inherits(Lazy, SimpleType2);
    function Lazy(name, options) {
        _class_call_check(this, Lazy);
        var _this;
        _this = _call_super(this, Lazy, [
            name
        ]);
        _this.options = options;
        __publicField(_this, "flags", 1048576 /* Lazy */ );
        __publicField(_this, "loadedType", null);
        __publicField(_this, "pendingNodeList", import_mobx13.observable.array());
        (0, import_mobx13.when)(function() {
            return _this.pendingNodeList.length > 0 && _this.pendingNodeList.some(function(node) {
                return node.isAlive && _this.options.shouldLoadPredicate(node.parent ? node.parent.value : null);
            });
        }, function() {
            _this.options.loadType().then((0, import_mobx13.action)(function(type) {
                _this.loadedType = type;
                _this.pendingNodeList.forEach(function(node) {
                    if (!node.parent) return;
                    if (!_this.loadedType) return;
                    node.parent.applyPatches([
                        {
                            op: "replace",
                            path: "/".concat(node.subpath),
                            value: node.snapshot
                        }
                    ]);
                });
            }));
        });
        return _this;
    }
    _create_class(Lazy, [
        {
            key: "describe",
            value: function describe() {
                return "<lazy ".concat(this.name, ">");
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, value) {
                var _this = this;
                if (this.loadedType) {
                    return this.loadedType.instantiate(parent, subpath, environment, value);
                }
                var node = createScalarNode(this, parent, subpath, environment, deepFreeze(value));
                this.pendingNodeList.push(node);
                (0, import_mobx13.when)(function() {
                    return !node.isAlive;
                }, function() {
                    return _this.pendingNodeList.splice(_this.pendingNodeList.indexOf(node), 1);
                });
                return node;
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                if (this.loadedType) {
                    return this.loadedType.validate(value, context);
                }
                if (!isSerializable(value)) {
                    return typeCheckFailure(context, value, "Value is not serializable and cannot be lazy");
                }
                return typeCheckSuccess();
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, value, parent, subpath) {
                if (this.loadedType) {
                    current.die();
                    return this.loadedType.instantiate(parent, subpath, parent.environment, value);
                }
                return _get(_get_prototype_of(Lazy.prototype), "reconcile", this).call(this, current, value, parent, subpath);
            }
        }
    ]);
    return Lazy;
}(SimpleType2);
// src/types/utility-types/frozen.ts
var Frozen = /*#__PURE__*/ function(SimpleType2) {
    _inherits(Frozen, SimpleType2);
    function Frozen(subType) {
        _class_call_check(this, Frozen);
        var _this;
        _this = _call_super(this, Frozen, [
            subType ? "frozen(".concat(subType.name, ")") : "frozen"
        ]);
        _this.subType = subType;
        __publicField(_this, "flags", 256 /* Frozen */ );
        return _this;
    }
    _create_class(Frozen, [
        {
            key: "describe",
            value: function describe() {
                return "<any immutable value>";
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, value) {
                return createScalarNode(this, parent, subpath, environment, deepFreeze(value));
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                if (!isSerializable(value)) {
                    return typeCheckFailure(context, value, "Value is not serializable and cannot be frozen");
                }
                if (this.subType) return this.subType.validate(value, context);
                return typeCheckSuccess();
            }
        }
    ]);
    return Frozen;
}(SimpleType2);
var untypedFrozenInstance = new Frozen();
function frozen(arg) {
    if (arguments.length === 0) return untypedFrozenInstance;
    else if (isType(arg)) return new Frozen(arg);
    else return optional(untypedFrozenInstance, arg);
}
function isFrozenType(type) {
    return isType(type) && (type.flags & 256 /* Frozen */ ) > 0;
}
// src/types/utility-types/reference.ts
function getInvalidationCause(hook) {
    switch(hook){
        case "beforeDestroy" /* beforeDestroy */ :
            return "destroy";
        case "beforeDetach" /* beforeDetach */ :
            return "detach";
        default:
            return void 0;
    }
}
var StoredReference = /*#__PURE__*/ function() {
    function StoredReference(value, targetType) {
        _class_call_check(this, StoredReference);
        this.targetType = targetType;
        __publicField(this, "identifier");
        __publicField(this, "node");
        __publicField(this, "resolvedReference");
        if (isValidIdentifier(value)) {
            this.identifier = value;
        } else if (isStateTreeNode(value)) {
            var targetNode = getStateTreeNode(value);
            if (!targetNode.identifierAttribute) throw fail("Can only store references with a defined identifier attribute.");
            var id = targetNode.unnormalizedIdentifier;
            if (id === null || id === void 0) {
                throw fail("Can only store references to tree nodes with a defined identifier.");
            }
            this.identifier = id;
        } else {
            throw fail("Can only store references to tree nodes or identifiers, got: '".concat(value, "'"));
        }
    }
    _create_class(StoredReference, [
        {
            key: "updateResolvedReference",
            value: function updateResolvedReference(node) {
                var normalizedId = normalizeIdentifier(this.identifier);
                var root = node.root;
                var lastCacheModification = root.identifierCache.getLastCacheModificationPerId(normalizedId);
                if (!this.resolvedReference || this.resolvedReference.lastCacheModification !== lastCacheModification) {
                    var targetType = this.targetType;
                    var target = root.identifierCache.resolve(targetType, normalizedId);
                    if (!target) {
                        throw new InvalidReferenceError("[mobx-state-tree] Failed to resolve reference '".concat(this.identifier, "' to type '").concat(this.targetType.name, "' (from node: ").concat(node.path, ")"));
                    }
                    this.resolvedReference = {
                        node: target,
                        lastCacheModification: lastCacheModification
                    };
                }
            }
        },
        {
            key: "resolvedValue",
            get: function get() {
                this.updateResolvedReference(this.node);
                return this.resolvedReference.node.value;
            }
        }
    ]);
    return StoredReference;
}();
var InvalidReferenceError = /*#__PURE__*/ function(Error1) {
    _inherits(_InvalidReferenceError, Error1);
    function _InvalidReferenceError(m) {
        _class_call_check(this, _InvalidReferenceError);
        var _this;
        _this = _call_super(this, _InvalidReferenceError, [
            m
        ]);
        Object.setPrototypeOf(_this, _InvalidReferenceError.prototype);
        return _this;
    }
    return _InvalidReferenceError;
}(_wrap_native_super(Error));
var BaseReferenceType = /*#__PURE__*/ function(SimpleType2) {
    _inherits(BaseReferenceType, SimpleType2);
    function BaseReferenceType(targetType, onInvalidated) {
        _class_call_check(this, BaseReferenceType);
        var _this;
        _this = _call_super(this, BaseReferenceType, [
            "reference(".concat(targetType.name, ")")
        ]);
        _this.targetType = targetType;
        _this.onInvalidated = onInvalidated;
        __publicField(_this, "flags", 1024 /* Reference */ );
        return _this;
    }
    _create_class(BaseReferenceType, [
        {
            key: "describe",
            value: function describe() {
                return this.name;
            }
        },
        {
            key: "isAssignableFrom",
            value: function isAssignableFrom(type) {
                return this.targetType.isAssignableFrom(type);
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                return isValidIdentifier(value) ? typeCheckSuccess() : typeCheckFailure(context, value, "Value is not a valid identifier, which is a string or a number");
            }
        },
        {
            key: "fireInvalidated",
            value: function fireInvalidated(cause, storedRefNode, referenceId, refTargetNode) {
                var storedRefParentNode = storedRefNode.parent;
                if (!storedRefParentNode || !storedRefParentNode.isAlive) {
                    return;
                }
                var storedRefParentValue = storedRefParentNode.storedValue;
                if (!storedRefParentValue) {
                    return;
                }
                this.onInvalidated({
                    cause: cause,
                    parent: storedRefParentValue,
                    invalidTarget: refTargetNode ? refTargetNode.storedValue : void 0,
                    invalidId: referenceId,
                    replaceRef: function replaceRef(newRef) {
                        applyPatch(storedRefNode.root.storedValue, {
                            op: "replace",
                            value: newRef,
                            path: storedRefNode.path
                        });
                    },
                    removeRef: function removeRef() {
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
        },
        {
            key: "addTargetNodeWatcher",
            value: function addTargetNodeWatcher(storedRefNode, referenceId) {
                var _this = this;
                var refTargetValue = this.getValue(storedRefNode);
                if (!refTargetValue) {
                    return void 0;
                }
                var refTargetNode = getStateTreeNode(refTargetValue);
                var hookHandler = function(_, refTargetNodeHook) {
                    var cause = getInvalidationCause(refTargetNodeHook);
                    if (!cause) {
                        return;
                    }
                    _this.fireInvalidated(cause, storedRefNode, referenceId, refTargetNode);
                };
                var refTargetDetachHookDisposer = refTargetNode.registerHook("beforeDetach" /* beforeDetach */ , hookHandler);
                var refTargetDestroyHookDisposer = refTargetNode.registerHook("beforeDestroy" /* beforeDestroy */ , hookHandler);
                return function() {
                    refTargetDetachHookDisposer();
                    refTargetDestroyHookDisposer();
                };
            }
        },
        {
            key: "watchTargetNodeForInvalidations",
            value: function watchTargetNodeForInvalidations(storedRefNode, identifier2, customGetSet) {
                var _this = this;
                if (!this.onInvalidated) {
                    return;
                }
                var onRefTargetDestroyedHookDisposer;
                storedRefNode.registerHook("beforeDestroy" /* beforeDestroy */ , function() {
                    if (onRefTargetDestroyedHookDisposer) {
                        onRefTargetDestroyedHookDisposer();
                    }
                });
                var startWatching = function(sync) {
                    if (onRefTargetDestroyedHookDisposer) {
                        onRefTargetDestroyedHookDisposer();
                    }
                    var storedRefParentNode = storedRefNode.parent;
                    var storedRefParentValue = storedRefParentNode && storedRefParentNode.storedValue;
                    if (storedRefParentNode && storedRefParentNode.isAlive && storedRefParentValue) {
                        var refTargetNodeExists;
                        if (customGetSet) {
                            refTargetNodeExists = !!customGetSet.get(identifier2, storedRefParentValue);
                        } else {
                            refTargetNodeExists = storedRefNode.root.identifierCache.has(_this.targetType, normalizeIdentifier(identifier2));
                        }
                        if (!refTargetNodeExists) {
                            if (!sync) {
                                _this.fireInvalidated("invalidSnapshotReference", storedRefNode, identifier2, null);
                            }
                        } else {
                            onRefTargetDestroyedHookDisposer = _this.addTargetNodeWatcher(storedRefNode, identifier2);
                        }
                    }
                };
                if (storedRefNode.state === 2 /* FINALIZED */ ) {
                    startWatching(true);
                } else {
                    if (!storedRefNode.isRoot) {
                        storedRefNode.root.registerHook("afterCreationFinalization" /* afterCreationFinalization */ , function() {
                            if (storedRefNode.parent) {
                                storedRefNode.parent.createObservableInstanceIfNeeded();
                            }
                        });
                    }
                    storedRefNode.registerHook("afterAttach" /* afterAttach */ , function() {
                        startWatching(false);
                    });
                }
            }
        }
    ]);
    return BaseReferenceType;
}(SimpleType2);
var IdentifierReferenceType = /*#__PURE__*/ function(BaseReferenceType) {
    _inherits(IdentifierReferenceType, BaseReferenceType);
    function IdentifierReferenceType(targetType, onInvalidated) {
        _class_call_check(this, IdentifierReferenceType);
        return _call_super(this, IdentifierReferenceType, [
            targetType,
            onInvalidated
        ]);
    }
    _create_class(IdentifierReferenceType, [
        {
            key: "getValue",
            value: function getValue(storedRefNode) {
                if (!storedRefNode.isAlive) return void 0;
                var storedRef = storedRefNode.storedValue;
                return storedRef.resolvedValue;
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(storedRefNode) {
                var ref = storedRefNode.storedValue;
                return ref.identifier;
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                var identifier2 = isStateTreeNode(initialValue) ? getIdentifier(initialValue) : initialValue;
                var storedRef = new StoredReference(initialValue, this.targetType);
                var storedRefNode = createScalarNode(this, parent, subpath, environment, storedRef);
                storedRef.node = storedRefNode;
                this.watchTargetNodeForInvalidations(storedRefNode, identifier2, void 0);
                return storedRefNode;
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                if (!current.isDetaching && current.type === this) {
                    var compareByValue = isStateTreeNode(newValue);
                    var ref = current.storedValue;
                    if (!compareByValue && ref.identifier === newValue || compareByValue && ref.resolvedValue === newValue) {
                        current.setParent(parent, subpath);
                        return current;
                    }
                }
                var newNode = this.instantiate(parent, subpath, void 0, newValue);
                current.die();
                return newNode;
            }
        }
    ]);
    return IdentifierReferenceType;
}(BaseReferenceType);
var CustomReferenceType = /*#__PURE__*/ function(BaseReferenceType) {
    _inherits(CustomReferenceType, BaseReferenceType);
    function CustomReferenceType(targetType, options, onInvalidated) {
        _class_call_check(this, CustomReferenceType);
        var _this;
        _this = _call_super(this, CustomReferenceType, [
            targetType,
            onInvalidated
        ]);
        _this.options = options;
        return _this;
    }
    _create_class(CustomReferenceType, [
        {
            key: "getValue",
            value: function getValue(storedRefNode) {
                if (!storedRefNode.isAlive) return void 0;
                var referencedNode = this.options.get(storedRefNode.storedValue, storedRefNode.parent ? storedRefNode.parent.storedValue : null);
                return referencedNode;
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(storedRefNode) {
                return storedRefNode.storedValue;
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, newValue) {
                var identifier2 = isStateTreeNode(newValue) ? this.options.set(newValue, parent ? parent.storedValue : null) : newValue;
                var storedRefNode = createScalarNode(this, parent, subpath, environment, identifier2);
                this.watchTargetNodeForInvalidations(storedRefNode, identifier2, this.options);
                return storedRefNode;
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                var newIdentifier = isStateTreeNode(newValue) ? this.options.set(newValue, current ? current.storedValue : null) : newValue;
                if (!current.isDetaching && current.type === this && current.storedValue === newIdentifier) {
                    current.setParent(parent, subpath);
                    return current;
                }
                var newNode = this.instantiate(parent, subpath, void 0, newIdentifier);
                current.die();
                return newNode;
            }
        }
    ]);
    return CustomReferenceType;
}(BaseReferenceType);
function reference(subType, options) {
    assertIsType(subType, 1);
    if (devMode()) {
        if (arguments.length === 2 && typeof arguments[1] === "string") {
            throw fail("References with base path are no longer supported. Please remove the base path.");
        }
    }
    var getSetOptions = options ? options : void 0;
    var onInvalidated = options ? options.onInvalidated : void 0;
    if (getSetOptions && (getSetOptions.get || getSetOptions.set)) {
        if (devMode()) {
            if (!getSetOptions.get || !getSetOptions.set) {
                throw fail("reference options must either contain both a 'get' and a 'set' method or none of them");
            }
        }
        return new CustomReferenceType(subType, {
            get: getSetOptions.get,
            set: getSetOptions.set
        }, onInvalidated);
    } else {
        return new IdentifierReferenceType(subType, onInvalidated);
    }
}
function isReferenceType(type) {
    return (type.flags & 1024 /* Reference */ ) > 0;
}
function safeReference(subType, options) {
    var refType = reference(subType, _object_spread_props(_object_spread({}, options), {
        onInvalidated: function onInvalidated(ev) {
            if (options && options.onInvalidated) {
                options.onInvalidated(ev);
            }
            ev.removeRef();
        }
    }));
    if (options && options.acceptsUndefined === false) {
        return refType;
    } else {
        return maybe(refType);
    }
}
// src/types/utility-types/identifier.ts
var BaseIdentifierType = /*#__PURE__*/ function(SimpleType2) {
    _inherits(BaseIdentifierType, SimpleType2);
    function BaseIdentifierType(name, validType) {
        _class_call_check(this, BaseIdentifierType);
        var _this;
        _this = _call_super(this, BaseIdentifierType, [
            name
        ]);
        _this.validType = validType;
        __publicField(_this, "flags", 2048 /* Identifier */ );
        return _this;
    }
    _create_class(BaseIdentifierType, [
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                if (!parent || !_instanceof(parent.type, ModelType)) throw fail("Identifier types can only be instantiated as direct child of a model type");
                return createScalarNode(this, parent, subpath, environment, initialValue);
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, newValue, parent, subpath) {
                if (current.storedValue !== newValue) throw fail("Tried to change identifier from '".concat(current.storedValue, "' to '").concat(newValue, "'. Changing identifiers is not allowed."));
                current.setParent(parent, subpath);
                return current;
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                if ((typeof value === "undefined" ? "undefined" : _type_of(value)) !== this.validType) {
                    return typeCheckFailure(context, value, "Value is not a valid ".concat(this.describe(), ", expected a ").concat(this.validType));
                }
                return typeCheckSuccess();
            }
        }
    ]);
    return BaseIdentifierType;
}(SimpleType2);
var IdentifierType = /*#__PURE__*/ function(BaseIdentifierType) {
    _inherits(IdentifierType, BaseIdentifierType);
    function IdentifierType() {
        _class_call_check(this, IdentifierType);
        var _this;
        _this = _call_super(this, IdentifierType, [
            "identifier",
            "string"
        ]);
        __publicField(_this, "flags", 2048 /* Identifier */ );
        return _this;
    }
    _create_class(IdentifierType, [
        {
            key: "describe",
            value: function describe() {
                return "identifier";
            }
        }
    ]);
    return IdentifierType;
}(BaseIdentifierType);
var IdentifierNumberType = /*#__PURE__*/ function(BaseIdentifierType) {
    _inherits(IdentifierNumberType, BaseIdentifierType);
    function IdentifierNumberType() {
        _class_call_check(this, IdentifierNumberType);
        return _call_super(this, IdentifierNumberType, [
            "identifierNumber",
            "number"
        ]);
    }
    _create_class(IdentifierNumberType, [
        {
            key: "getSnapshot",
            value: function getSnapshot(node) {
                return node.storedValue;
            }
        },
        {
            key: "describe",
            value: function describe() {
                return "identifierNumber";
            }
        }
    ]);
    return IdentifierNumberType;
}(BaseIdentifierType);
var identifier = new IdentifierType();
var identifierNumber = new IdentifierNumberType();
function isIdentifierType(type) {
    return isType(type) && (type.flags & 2048 /* Identifier */ ) > 0;
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
var CustomType = /*#__PURE__*/ function(SimpleType2) {
    _inherits(CustomType, SimpleType2);
    function CustomType(options) {
        _class_call_check(this, CustomType);
        var _this;
        _this = _call_super(this, CustomType, [
            options.name
        ]);
        _this.options = options;
        __publicField(_this, "flags", 262144 /* Custom */ );
        return _this;
    }
    _create_class(CustomType, [
        {
            key: "describe",
            value: function describe() {
                return this.name;
            }
        },
        {
            key: "isValidSnapshot",
            value: function isValidSnapshot(value, context) {
                if (this.options.isTargetType(value)) return typeCheckSuccess();
                var typeError = this.options.getValidationMessage(value);
                if (typeError) {
                    return typeCheckFailure(context, value, "Invalid value for type '".concat(this.name, "': ").concat(typeError));
                }
                return typeCheckSuccess();
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot(node) {
                return this.options.toSnapshot(node.storedValue);
            }
        },
        {
            key: "instantiate",
            value: function instantiate(parent, subpath, environment, initialValue) {
                var valueToStore = this.options.isTargetType(initialValue) ? initialValue : this.options.fromSnapshot(initialValue, parent && parent.root.environment);
                return createScalarNode(this, parent, subpath, environment, valueToStore);
            }
        },
        {
            key: "reconcile",
            value: function reconcile(current, value, parent, subpath) {
                var isSnapshot = !this.options.isTargetType(value);
                if (!current.isDetaching) {
                    var unchanged = current.type === this && (isSnapshot ? value === current.snapshot : value === current.storedValue);
                    if (unchanged) {
                        current.setParent(parent, subpath);
                        return current;
                    }
                }
                var valueToStore = isSnapshot ? this.options.fromSnapshot(value, parent.root.environment) : value;
                var newNode = this.instantiate(parent, subpath, void 0, valueToStore);
                current.die();
                return newNode;
            }
        }
    ]);
    return CustomType;
}(SimpleType2);
// src/types/index.ts
var types = {
    enumeration: enumeration,
    model: model,
    compose: compose,
    custom: custom,
    reference: reference,
    safeReference: safeReference,
    union: union,
    optional: optional,
    literal: literal,
    maybe: maybe,
    maybeNull: maybeNull,
    refinement: refinement,
    string: string,
    boolean: boolean,
    number: number,
    integer: integer,
    float: float,
    finite: finite,
    Date: DatePrimitive,
    map: map,
    array: array,
    frozen: frozen,
    identifier: identifier,
    identifierNumber: identifierNumber,
    late: late,
    lazy: lazy,
    undefined: undefinedType,
    null: nullType,
    snapshotProcessor: snapshotProcessor
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
    addDisposer: addDisposer,
    addMiddleware: addMiddleware,
    applyAction: applyAction,
    applyPatch: applyPatch,
    applySnapshot: applySnapshot,
    cast: cast,
    castFlowReturn: castFlowReturn,
    castToReferenceSnapshot: castToReferenceSnapshot,
    castToSnapshot: castToSnapshot,
    clone: clone,
    createActionTrackingMiddleware: createActionTrackingMiddleware,
    createActionTrackingMiddleware2: createActionTrackingMiddleware2,
    decorate: decorate,
    destroy: destroy,
    detach: detach,
    escapeJsonPath: escapeJsonPath,
    flow: flow,
    getChildType: getChildType,
    getEnv: getEnv,
    getIdentifier: getIdentifier,
    getLivelinessChecking: getLivelinessChecking,
    getMembers: getMembers,
    getNodeId: getNodeId,
    getParent: getParent,
    getParentOfType: getParentOfType,
    getPath: getPath,
    getPathParts: getPathParts,
    getPropertyMembers: getPropertyMembers,
    getRelativePath: getRelativePath,
    getRoot: getRoot,
    getRunningActionContext: getRunningActionContext,
    getSnapshot: getSnapshot,
    getType: getType,
    hasParent: hasParent,
    hasParentOfType: hasParentOfType,
    isActionContextChildOf: isActionContextChildOf,
    isActionContextThisOrChildOf: isActionContextThisOrChildOf,
    isAlive: isAlive,
    isArrayType: isArrayType,
    isFrozenType: isFrozenType,
    isIdentifierType: isIdentifierType,
    isLateType: isLateType,
    isLiteralType: isLiteralType,
    isMapType: isMapType,
    isModelType: isModelType,
    isOptionalType: isOptionalType,
    isPrimitiveType: isPrimitiveType,
    isProtected: isProtected,
    isReferenceType: isReferenceType,
    isRefinementType: isRefinementType,
    isRoot: isRoot,
    isStateTreeNode: isStateTreeNode,
    isType: isType,
    isUnionType: isUnionType,
    isValidReference: isValidReference,
    joinJsonPath: joinJsonPath,
    onAction: onAction,
    onPatch: onPatch,
    onSnapshot: onSnapshot,
    process: process,
    protect: protect,
    recordActions: recordActions,
    recordPatches: recordPatches,
    resolveIdentifier: resolveIdentifier,
    resolvePath: resolvePath,
    setLivelinessChecking: setLivelinessChecking,
    setLivelynessChecking: setLivelynessChecking,
    splitJsonPath: splitJsonPath,
    t: t,
    toGenerator: toGenerator,
    toGeneratorFunction: toGeneratorFunction,
    tryReference: tryReference,
    tryResolve: tryResolve,
    typecheck: typecheck,
    types: types,
    unescapeJsonPath: unescapeJsonPath,
    unprotect: unprotect,
    walk: walk
});
