import type { ClusterNode } from './types.js';
export declare function printTree(node: ClusterNode, indent?: string, isLast?: boolean): string;
export declare function toNewick(node: ClusterNode): string;
export declare function treeToJSON(node: ClusterNode): {
    name: string;
    height: number;
    children?: ReturnType<typeof treeToJSON>[];
};
