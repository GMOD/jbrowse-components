import type { ClusterResult, ClusterOptions } from './types.js';
export declare function clusterData({ data, sampleLabels, onProgress, stopToken, }: ClusterOptions): Promise<ClusterResult>;
