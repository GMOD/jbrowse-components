/**
 * High-performance distance calculations for hierarchical clustering
 * Compiled to WebAssembly using Emscripten
 */

#include <math.h>
#include <emscripten.h>

/**
 * Compute Euclidean distance between two vectors
 * Uses float (f32) for better performance and memory efficiency
 *
 * @param a Pointer to first vector
 * @param b Pointer to second vector
 * @param size Number of elements in each vector
 * @return Euclidean distance
 */
EMSCRIPTEN_KEEPALIVE
float euclideanDistance(const float* a, const float* b, int size) {
  float sum = 0.0f;

  // Unroll loop by 4 for better performance
  int i = 0;
  for (; i + 3 < size; i += 4) {
    float diff0 = a[i] - b[i];
    float diff1 = a[i+1] - b[i+1];
    float diff2 = a[i+2] - b[i+2];
    float diff3 = a[i+3] - b[i+3];

    sum += diff0 * diff0;
    sum += diff1 * diff1;
    sum += diff2 * diff2;
    sum += diff3 * diff3;
  }

  // Handle remaining elements
  for (; i < size; i++) {
    float diff = a[i] - b[i];
    sum += diff * diff;
  }

  return sqrtf(sum);
}

/**
 * Compute full distance matrix for all samples
 * This is the main performance bottleneck - O(n^2 * m) where n=numSamples, m=vectorSize
 *
 * @param data Flattened 2D array of sample data (numSamples * vectorSize elements)
 * @param distances Output array for distance matrix (numSamples * numSamples elements)
 * @param numSamples Number of samples
 * @param vectorSize Number of dimensions per sample
 */
EMSCRIPTEN_KEEPALIVE
void computeDistanceMatrix(
  const float* data,
  float* distances,
  int numSamples,
  int vectorSize
) {
  for (int i = 0; i < numSamples; i++) {
    const float* vecA = data + (i * vectorSize);

    for (int j = 0; j < numSamples; j++) {
      const float* vecB = data + (j * vectorSize);
      float dist = euclideanDistance(vecA, vecB, vectorSize);
      distances[i * numSamples + j] = dist;
    }
  }
}

/**
 * Compute average distance between two sets of sample indexes
 * Used during hierarchical clustering to determine which clusters to merge
 *
 * @param setA Array of sample indexes for first cluster
 * @param lenA Number of elements in setA
 * @param setB Array of sample indexes for second cluster
 * @param lenB Number of elements in setB
 * @param distances Pre-computed distance matrix (numSamples * numSamples)
 * @param numSamples Total number of samples (for indexing into distances)
 * @return Average distance between all pairs in setA and setB
 */
EMSCRIPTEN_KEEPALIVE
float averageDistance(
  const int* setA,
  int lenA,
  const int* setB,
  int lenB,
  const float* distances,
  int numSamples
) {
  float distance = 0.0f;

  for (int i = 0; i < lenA; i++) {
    int rowIdx = setA[i];
    const float* distRow = distances + (rowIdx * numSamples);

    for (int j = 0; j < lenB; j++) {
      distance += distRow[setB[j]];
    }
  }

  return distance / (float)(lenA * lenB);
}
