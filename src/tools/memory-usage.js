const v8 = require('v8');

function formatMemory(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const memoryUsage = () => {
  const mem = process.memoryUsage();
  return {
    rss: formatMemory(mem.rss),
    heapTotal: formatMemory(mem.heapTotal),
    heapUsed: formatMemory(mem.heapUsed),
    external: formatMemory(mem.external),
    arrayBuffers: formatMemory(mem.arrayBuffers),
  };
}

const heapStats = () => {
  const stats = v8.getHeapStatistics();
  return {
    total_heap_size: formatMemory(stats.total_heap_size),
    total_heap_size_executable: formatMemory(stats.total_heap_size_executable), // CODE
    total_physical_size: formatMemory(stats.total_physical_size),
    total_available_size: formatMemory(stats.total_available_size),
    used_heap_size: formatMemory(stats.used_heap_size),
    heap_size_limit: formatMemory(stats.heap_size_limit),
    malloced_memory: formatMemory(stats.malloced_memory), // Native allocations
    peak_malloced_memory: formatMemory(stats.peak_malloced_memory),
  }
}

module.exports = { memoryUsage, heapStats }
