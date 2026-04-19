const { config } = require('../config')
const { createLogger } = require('./logger')

const logger = createLogger('events')
if (config.appEnv === 'production') {
  logger.disable()
}
class EventEmitter {
  constructor() {
    /** 
     * @protected
     * @type {{ [event: string]: Array<(...args: any) => any>}} */
    this.listeners = {}
  }

  /**
   * @param {string} event 
   * @param  {...any} args 
   */
  emit(event, ...args) {
    logger.log(`emit "${event}"`)
    const listeners = this.listeners[event] || []
    for (const listener of listeners) {
      try {
        const res = listener(...args)
        if (res instanceof Promise) {
          res.catch(e => logger.warn('error', e))
        }
      } catch (e) {
        logger.warn('error', e)
      }
    }
    for (const listener of listeners) {
      if (listener.once) {
        delete listener.once
        this.off(event, listener)
      }
    }
  }

  /**
   * @param {string} event
   * @param {(...args: any) => any} listener
   */
  once(event, listener) {
    return this._on(event, listener, true)
  }
  /**
   * @param {string} event
   * @param {(...args: any) => any} listener
   */
  on(event, listener) {
    return this._on(event, listener)
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

  /**
   * @private
   * @param {string} event
   * @param {(...args: any) => any} listener
   */
  _on(event, listener, once = false) {
    const listeners = this.listeners[event] || []
    listener.once = once
    const index = listeners.indexOf(listener)
    if (index == -1) {
      listeners.push(listener)
    }
    this.listeners[event] = listeners
    const remove = () => this.off(event, listener)
    return { remove }
  }
}

module.exports = { EventEmitter }
