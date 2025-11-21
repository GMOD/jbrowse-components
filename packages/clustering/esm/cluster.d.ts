import type { ClusterOptions, ClusterResult } from './types.js';
export declare function clusterData({ data, sampleLabels, onProgress, stopToken, }: ClusterOptions): Promise<ClusterResult>;
