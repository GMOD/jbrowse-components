import { hierarchicalClusterWasm } from './wasm-wrapper.js';
import { checkStopToken } from './stopToken.js';
export async function clusterData({ data, sampleLabels, onProgress, stopToken, }) {
    onProgress === null || onProgress === void 0 ? void 0 : onProgress('Running hierarchical clustering in WASM...');
    const result = await hierarchicalClusterWasm({
        data,
        sampleLabels,
        statusCallback: onProgress,
        checkCancellation: stopToken
            ? () => {
                try {
                    checkStopToken(stopToken);
                    return false;
                }
                catch (e) {
                    return true;
                }
            }
            : undefined,
    });
    const numSamples = data.length;
    const clustersGivenK = [[]];
    const clusterSets = Array.from({ length: numSamples }, (_, i) => [i]);
    for (let i = 0; i < numSamples - 1; i++) {
        const [mergeA, mergeB] = result.merges[i];
        clustersGivenK.push(clusterSets.map(s => [...s]));
        const newCluster = [...clusterSets[mergeA], ...clusterSets[mergeB]];
        const removeFirst = Math.max(mergeA, mergeB);
        const removeSecond = Math.min(mergeA, mergeB);
        clusterSets.splice(removeFirst, 1);
        clusterSets.splice(removeSecond, 1);
        clusterSets.push(newCluster);
    }
    clustersGivenK.push(clusterSets.map(s => [...s]));
    const distances = new Float32Array(numSamples * numSamples);
    return {
        tree: result.tree,
        distances,
        order: result.order,
        clustersGivenK: clustersGivenK.reverse(),
    };
}
