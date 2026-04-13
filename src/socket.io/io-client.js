const { io } = require('socket.io-client')
const { config } = require('../config')

const fns = {}
/** @type {typeof console} */
const logger = new Proxy({}, {
  get(target, key) {
    if (!console[key]) {
      key = 'log'
    }
    fns[key] = fns[key] || console[key].bind(console, new Date().toISOString(), '[Socket.IO-Client]')
    return fns[key]
  }
})
const url = config.appEnv === 'production'
  ? `https://${config.host}/chat`
  : `http://localhost:${config.port}/chat`
/**
 * @param {(socket: import('socket.io-client').Socket) => void} [callback]
 * @returns 
 */
const connect = (callback) => {
  const socket = io(url, {
    path: '/10chat.io',
    auth: { token: config.authToken }
  })
  socket.on('connect', () => {
    logger.log(config.host, 'connected')
    if (typeof callback === 'function') {
      try {
        callback(socket)
      } catch (e) {
        logger.warn(config.host, e)
      }
    }
  })
  socket.on('disconnect', (reason) => {
    logger.log(config.host, 'disconnected', reason)
  })
  socket.on('connect_error', (err) => {
    logger.error(config.host, 'connect_error', err.message)
  })
  return socket
}

module.exports = { connect }
