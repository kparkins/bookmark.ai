class PriorityQueue {
  constructor(compareFn) {
    this.compare = compareFn;
    this.items = [];
  }

  get length() {
    return this.items.length;
  }

  peek() {
    return this.items.length ? this.items[0] : null;
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return null;
    }

    const top = this.items[0];
    const last = this.items.pop();

    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return top;
  }

  bubbleUp(index) {
    const item = this.items[index];

    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      const parent = this.items[parentIndex];

      if (this.compare(item, parent) >= 0) {
        break;
      }

      this.items[index] = parent;
      index = parentIndex;
    }

    this.items[index] = item;
  }

  bubbleDown(index) {
    const length = this.items.length;
    const item = this.items[index];

    while (true) {
      const leftIndex = (index << 1) + 1;
      const rightIndex = leftIndex + 1;
      let smallest = index;

      if (
        leftIndex < length &&
        this.compare(this.items[leftIndex], this.items[smallest]) < 0
      ) {
        smallest = leftIndex;
      }

      if (
        rightIndex < length &&
        this.compare(this.items[rightIndex], this.items[smallest]) < 0
      ) {
        smallest = rightIndex;
      }

      if (smallest === index) {
        break;
      }

      this.items[index] = this.items[smallest];
      index = smallest;
    }

    this.items[index] = item;
  }

  toArray() {
    return this.items.slice();
  }
}

export class HNSWIndex {
  constructor(dimensions, options = {}) {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error("HNSW index requires a positive integer dimension");
    }

    this.dimensions = dimensions;
    this.M = options.M || 16;
    this.efConstruction = options.efConstruction || 200;
    this.efSearch = options.efSearch || 64;
    this.levelProbability = options.levelProbability || 1 / Math.E;

    this.maxLevel = -1;
    this.entryPoint = null;

    this.nodes = new Map(); // id -> { vector, norm, level }
    this.graph = new Map(); // id -> Array<Set<neighborId>>
    this.layers = []; // Array<Set<nodeId>>
  }

  addItem(id, vectorInput) {
    if (this.nodes.has(id)) {
      throw new Error(`Node with id ${id} already exists in HNSW index`);
    }

    const vector = this.asVector(vectorInput);
    if (vector.length !== this.dimensions) {
      throw new Error("Vector dimensions do not match HNSW index");
    }

    const norm = this.vectorNorm(vector);
    const level = this.sampleLevel();

    this.nodes.set(id, { vector, norm, level });
    this.ensureNodeStructure(id, level);

    if (this.entryPoint === null) {
      this.entryPoint = id;
      this.maxLevel = level;
      for (let l = 0; l <= level; l++) {
        this.ensureLevel(l);
        this.layers[l].add(id);
      }
      return;
    }

    for (let l = 0; l <= level; l++) {
      this.ensureLevel(l);
      const neighbors = this.selectNeighbors(id, vector, norm, l);
      for (const neighborId of neighbors) {
        this.linkNodes(id, neighborId, l);
      }
      this.layers[l].add(id);
    }

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPoint = id;
    }
  }

  search(queryVector, topK = 5) {
    if (!this.entryPoint) {
      return [];
    }

    if (!Array.isArray(queryVector) && !(queryVector instanceof Float32Array)) {
      throw new Error("Query vector must be an array or Float32Array");
    }

    if (queryVector.length !== this.dimensions) {
      throw new Error("Query vector dimensions do not match HNSW index");
    }

    const query = this.asVector(queryVector);
    const queryNorm = this.vectorNorm(query);
    const distanceTo = (id) => this.cosineDistance(query, queryNorm, id);

    let current = this.entryPoint;
    let currentDist = distanceTo(current);

    for (let level = this.maxLevel; level > 0; level--) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const neighborId of this.getNeighbors(current, level)) {
          const dist = distanceTo(neighborId);
          if (dist < currentDist) {
            currentDist = dist;
            current = neighborId;
            changed = true;
          }
        }
      }
    }

    return this.searchBaseLayer(current, distanceTo, Math.max(1, topK));
  }

  searchBaseLayer(entryId, distanceTo, topK) {
    const ef = Math.max(this.efSearch, topK);

    const visited = new Set([entryId]);
    const entryDist = distanceTo(entryId);

    const candidates = new PriorityQueue((a, b) => a.dist - b.dist);
    const topCandidates = new PriorityQueue((a, b) => b.dist - a.dist);
    candidates.push({ id: entryId, dist: entryDist });
    topCandidates.push({ id: entryId, dist: entryDist });

    while (candidates.length > 0) {
      const current = candidates.pop();
      const worstTop = topCandidates.peek();

      if (
        worstTop &&
        current.dist > worstTop.dist &&
        topCandidates.length >= ef
      ) {
        break;
      }

      for (const neighborId of this.getNeighbors(current.id, 0)) {
        if (visited.has(neighborId)) {
          continue;
        }

        visited.add(neighborId);
        const dist = distanceTo(neighborId);

        candidates.push({ id: neighborId, dist });
        topCandidates.push({ id: neighborId, dist });

        if (topCandidates.length > ef) {
          topCandidates.pop();
        }
      }
    }

    return topCandidates
      .toArray()
      .sort((a, b) => a.dist - b.dist)
      .slice(0, topK)
      .map(({ id, dist }) => ({
        id,
        distance: dist,
        similarity: 1 - dist,
      }));
  }

  selectNeighbors(id, vector, norm, level) {
    const candidates = [];

    for (const otherId of this.layers[level]) {
      if (otherId === id) {
        continue;
      }

      const node = this.nodes.get(otherId);
      if (!node) {
        continue;
      }

      const dist = this.cosineDistanceBetween(
        vector,
        norm,
        node.vector,
        node.norm,
      );
      candidates.push({ id: otherId, dist });
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, this.M).map((item) => item.id);
  }

  linkNodes(sourceId, targetId, level) {
    this.ensureNodeLevel(sourceId, level);
    this.ensureNodeLevel(targetId, level);

    const sourceNeighbors = this.graph.get(sourceId)[level];
    const targetNeighbors = this.graph.get(targetId)[level];

    sourceNeighbors.add(targetId);
    targetNeighbors.add(sourceId);

    this.pruneNeighbors(sourceId, level, sourceNeighbors);
    this.pruneNeighbors(targetId, level, targetNeighbors);
  }

  pruneNeighbors(id, level, neighborSet) {
    if (neighborSet.size <= this.M) {
      return;
    }

    const node = this.nodes.get(id);
    if (!node) {
      return;
    }

    const vector = node.vector;
    const norm = node.norm;

    const sorted = Array.from(neighborSet)
      .map((neighborId) => {
        const neighbor = this.nodes.get(neighborId);
        return {
          id: neighborId,
          dist: this.cosineDistanceBetween(
            vector,
            norm,
            neighbor.vector,
            neighbor.norm,
          ),
        };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, this.M)
      .map((entry) => entry.id);

    this.graph.get(id)[level] = new Set(sorted);
  }

  getNeighbors(id, level) {
    const neighborLayers = this.graph.get(id);
    if (!neighborLayers || level >= neighborLayers.length) {
      return [];
    }
    return Array.from(neighborLayers[level]);
  }

  ensureLevel(level) {
    while (this.layers.length <= level) {
      this.layers.push(new Set());
    }
  }

  ensureNodeStructure(id, level) {
    if (!this.graph.has(id)) {
      this.graph.set(id, []);
    }
    this.ensureNodeLevel(id, level);
  }

  ensureNodeLevel(id, level) {
    const neighborLayers = this.graph.get(id);
    while (neighborLayers.length <= level) {
      neighborLayers.push(new Set());
    }
  }

  sampleLevel() {
    let level = 0;
    while (Math.random() < this.levelProbability) {
      level++;
    }
    return level;
  }

  asVector(vectorInput) {
    if (vectorInput instanceof Float32Array) {
      return vectorInput;
    }
    return Float32Array.from(vectorInput);
  }

  vectorNorm(vector) {
    let sumSquares = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSquares += vector[i] * vector[i];
    }
    return Math.sqrt(sumSquares);
  }

  cosineDistance(queryVector, queryNorm, nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return 1;
    }
    return this.cosineDistanceBetween(
      queryVector,
      queryNorm,
      node.vector,
      node.norm,
    );
  }

  cosineDistanceBetween(vecA, normA, vecB, normB) {
    if (normA === 0 || normB === 0) {
      return 1;
    }

    let dot = 0;
    for (let i = 0; i < this.dimensions; i++) {
      dot += vecA[i] * vecB[i];
    }

    const similarity = dot / (normA * normB);
    return 1 - similarity;
  }
}
