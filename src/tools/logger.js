/**
 * @template T
 * @param {Extract<T, string>} [name]
 */
const createLogger = (name) => {
  name ||= 'Logger'
  /** @type {typeof console} */
  const logger = new Proxy({}, {
    get(target, key) {
      if (typeof target[key] === 'function') {
        return target[key]
      }
      if (typeof console[key] !== 'function') {
        key = 'log'
      }
      const func = (...args) => {
        console[key](new Date().toISOString(), `${key.toUpperCase()}`.padEnd(5, ' '), `[${name}]`, ...args)
      }
      target[key] = func
      return func
    }
  })
  return logger
}

module.exports = { createLogger }
