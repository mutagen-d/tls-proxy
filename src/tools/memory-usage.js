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

module.exports = { memoryUsage }
