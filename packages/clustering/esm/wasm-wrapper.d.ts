import type { ClusterNode } from './types.js';
export interface ClusteringResult {
    tree: ClusterNode;
    order: number[];
    heights: Float32Array;
    merges: Array<[number, number]>;
}
export interface ClusteringOptions {
    data: number[][];
    sampleLabels?: string[];
    statusCallback?: (message: string) => void;
    checkCancellation?: () => boolean;
}
export declare function hierarchicalClusterWasm(options: ClusteringOptions): Promise<ClusteringResult>;
