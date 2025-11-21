"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hierarchicalClusterWasm = hierarchicalClusterWasm;
const distance_js_1 = __importDefault(require("./distance.js"));
let moduleInstance = null;
async function getModule() {
    if (!moduleInstance) {
        moduleInstance = await (0, distance_js_1.default)();
    }
    return moduleInstance;
}
async function hierarchicalClusterWasm(options) {
    var _a, _b;
    const { data, sampleLabels, statusCallback, checkCancellation } = options;
    const module = await getModule();
    const numSamples = data.length;
    const vectorSize = (_b = (_a = data[0]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    const flatData = new Float32Array(numSamples * vectorSize);
    for (let i = 0; i < numSamples; i++) {
        for (let j = 0; j < vectorSize; j++) {
            flatData[i * vectorSize + j] = data[i][j];
        }
    }
    const dataPtr = module._malloc(flatData.length * 4);
    const heightsPtr = module._malloc((numSamples - 1) * 4);
    const mergeAPtr = module._malloc((numSamples - 1) * 4);
    const mergeBPtr = module._malloc((numSamples - 1) * 4);
    const orderPtr = module._malloc(numSamples * 4);
    let callbackPtr = null;
    try {
        module.HEAPF32.set(flatData, dataPtr / 4);
        if (statusCallback || checkCancellation) {
            const progressCallback = (iteration, totalIterations) => {
                if (checkCancellation === null || checkCancellation === void 0 ? void 0 : checkCancellation()) {
                    return 0;
                }
                if (statusCallback) {
                    if (iteration < 0) {
                        const distancesDone = -iteration;
                        const progress = Math.round((distancesDone / totalIterations) * 100);
                        statusCallback(`Computing distance matrix: ${progress}%`);
                    }
                    else {
                        const progress = Math.round((iteration / totalIterations) * 100);
                        statusCallback(`Clustering samples: ${progress}%`);
                    }
                }
                return 1;
            };
            callbackPtr = module.addFunction(progressCallback, 'iii');
            module._setProgressCallback(callbackPtr);
        }
        const result = module._hierarchicalCluster(dataPtr, numSamples, vectorSize, heightsPtr, mergeAPtr, mergeBPtr, orderPtr);
        if (result === -1) {
            throw new Error('Clustering cancelled');
        }
        const heights = new Float32Array(numSamples - 1);
        heights.set(module.HEAPF32.subarray(heightsPtr / 4, heightsPtr / 4 + numSamples - 1));
        const mergeA = new Int32Array(numSamples - 1);
        mergeA.set(module.HEAP32.subarray(mergeAPtr / 4, mergeAPtr / 4 + numSamples - 1));
        const mergeB = new Int32Array(numSamples - 1);
        mergeB.set(module.HEAP32.subarray(mergeBPtr / 4, mergeBPtr / 4 + numSamples - 1));
        const order = new Int32Array(numSamples);
        order.set(module.HEAP32.subarray(orderPtr / 4, orderPtr / 4 + numSamples));
        const tree = rebuildTree(numSamples, heights, mergeA, mergeB, sampleLabels);
        const merges = [];
        for (let i = 0; i < numSamples - 1; i++) {
            merges.push([mergeA[i], mergeB[i]]);
        }
        return {
            tree,
            order: Array.from(order),
            heights,
            merges,
        };
    }
    finally {
        if (callbackPtr !== null) {
            module.removeFunction(callbackPtr);
            module._setProgressCallback(0);
        }
        module._free(dataPtr);
        module._free(heightsPtr);
        module._free(mergeAPtr);
        module._free(mergeBPtr);
        module._free(orderPtr);
    }
}
function rebuildTree(numSamples, heights, mergeA, mergeB, sampleLabels) {
    var _a;
    const nodes = [];
    for (let i = 0; i < numSamples; i++) {
        nodes.push({
            name: (_a = sampleLabels === null || sampleLabels === void 0 ? void 0 : sampleLabels[i]) !== null && _a !== void 0 ? _a : `Sample ${i}`,
            height: 0,
        });
    }
    for (let i = 0; i < numSamples - 1; i++) {
        const leftIdx = mergeA[i];
        const rightIdx = mergeB[i];
        const leftNode = nodes[leftIdx];
        const rightNode = nodes[rightIdx];
        const newNode = {
            name: `Cluster ${i}`,
            height: heights[i],
            children: [leftNode, rightNode],
        };
        const removeFirst = Math.max(leftIdx, rightIdx);
        const removeSecond = Math.min(leftIdx, rightIdx);
        nodes.splice(removeFirst, 1);
        nodes.splice(removeSecond, 1);
        nodes.push(newNode);
    }
    return nodes[0];
}
