/**
 * @template T
 * @param {Extract<T, string>} [name]
 */
const createLogger = (name) => {
  name ||= 'Logger'
  let disabled = false
  /** @type {typeof console & { disable: () => void; enable: () => void }} */
  const logger = new Proxy({
    disable: () => {
      disabled = true
    },
    enable: () => {
      disabled = false
    },
  }, {
    get(target, key) {
      if (typeof target[key] === 'function') {
        return target[key]
      }
      if (typeof console[key] !== 'function') {
        key = 'log'
      }
      const func = (...args) => {
        if (disabled) {
          return
        }
        console[key](new Date().toISOString(), `${key.toUpperCase()}`.padEnd(5, ' '), `[${name}]`, ...args)
      }
      target[key] = func
      return func
    }
  })
  return logger
}

module.exports = { createLogger }
