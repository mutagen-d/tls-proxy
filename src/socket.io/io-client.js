const EventEmitter = require('events')
const { io } = require('socket.io-client')
const { config } = require('../config')
const { getAddress } = require('./get-address')

/**
 * @type {EventEmitter & {
 *  onConnect: (callback: (socket: import('socket.io-client').Socket, logger: typeof console) => void) => { remove: () => void }
 * }}
 */
const events = new EventEmitter()
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
const connect = () => {
  const socket = io(url, {
    path: '/10chat.io',
    auth: { token: config.authToken },
    transports: ['websocket', 'polling'],
  })
  socket.on('connect', () => {
    logger.log(config.host, `connected ${getAddress(socket)}`)
    events.emit('connect', socket, logger)
  })
  socket.on('disconnect', (reason) => {
    logger.log(config.host, 'disconnected', reason)
  })
  socket.on('connect_error', (err) => {
    logger.error(config.host, 'connect_error', err.message)
  })
  return socket
}

events.onConnect = (callback) => {
  events.off('connect', callback)
  events.on('connect', callback)
  const remove = () => events.off('connect', callback)
  return { remove }
}

module.exports = { connect, events }
