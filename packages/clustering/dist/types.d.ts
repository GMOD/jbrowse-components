export interface ClusterNode {
    name: string;
    height: number;
    children?: ClusterNode[];
}
export interface ClusterResult {
    tree: ClusterNode;
    distances: Float32Array;
    order: number[];
    clustersGivenK: number[][][];
}
export interface ClusterOptions {
    data: number[][];
    sampleLabels?: string[];
    onProgress?: (message: string) => void;
    stopToken?: string;
}
