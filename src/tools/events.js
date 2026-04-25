const { config } = require('../config')
const { createLogger } = require('./logger')

const logger = createLogger('events')
if (config.appEnv === 'production') {
  logger.disable()
}
let count = 0
class EventEmitter {
  constructor() {
    /** @private */
    this.id = ++count
    /** 
     * @protected
     * @type {{ [event: string]: Array<(...args: any) => any>}} */
    this.listeners = {}
    /** @protected */
    this.onceListeners = new WeakMap()
  }

  /**
   * @param {string} event 
   * @param  {...any} args 
   */
  emit(event, ...args) {
    logger.log(`emit[${this.id}] "${event}" [${args.map(v => typeof v).join(', ')}]`)
    const listeners = this.listeners[event] || []
    for (const listener of listeners) {
      try {
        const res = listener(...args)
        if (res instanceof Promise) {
          res.catch(e => logger.warn('error', e))
        }
      } catch (e) {
        logger.warn(`error[${this.id}]`, e)
      }
    }
    for (const listener of listeners) {
      if (this.onceListeners.get(listener)) {
        this.off(event, listener)
        this.onceListeners.delete(listener)
      }
    }
  }

  /**
   * @param {string} event
   * @param {(...args: any) => any} listener
   */
  once(event, listener) {
    this.onceListeners.set(listener, true)
    return this.on(event, listener)
  }

  /**
   * @param {string} event
   * @param {(...args: any) => any} listener
   */
  on(event, listener) {
    const listeners = this.listeners[event] || []
    const index = listeners.indexOf(listener)
    if (index == -1) {
      listeners.push(listener)
    }
    this.listeners[event] = listeners
    const remove = () => this.off(event, listener)
    return { remove }
  }

  /**
   * @param {string} [event]
   * @param {(...args: any) => any} [listener]
   */
  off(event, listener) {
    if (typeof event !== 'string' && !event) {
      const events = Object.keys(this.listeners)
      for (const key of events) {
        this.listeners[key].length = 0
        delete this.listeners[key]
      }
      return
    }
    const listeners = this.listeners[event]
    if (!listeners) {
      return
    }
    if (!listener) {
      listeners.length = 0
      delete this.listeners[event]
      return
    }
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
    if (!listeners.length) {
      delete this.listeners[event]
    }
  }
}

module.exports = { EventEmitter }
