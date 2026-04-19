const EventEmitter = require('events')
const { io } = require('socket.io-client')
const { config } = require('../config')
const { getAddress } = require('../tools/get-address')
const { createSpamer } = require('./io-spam')
const { createLogger } = require('../tools/logger')
const { fetchIP } = require('../tools/fetch-ip')

/**
 * @type {EventEmitter & {
 *  onConnect: (callback: (socket: import('socket.io-client').Socket, logger: typeof console) => void) => { remove: () => void }
 * }}
 */
const events = new EventEmitter()
const spamer = createSpamer()
const logger = createLogger(`Socket.IO-Client`)
/**
 * @param {(socket: import('socket.io-client').Socket) => void} [callback]
 * @returns 
 */
const connect = () => {
  const socket = io(config.ws.url, {
    path: config.ws.path,
    auth: async (cb) => {
      const ip = await fetchIP()
      cb({ token: config.ws.token, ip })
    },
    transports: ['websocket', 'polling'],
  })
  socket.on('connect', () => {
    logger.log(`connected ${getAddress(socket)}`)
    logger.log(`config:`, { url: config.ws.url, path: config.ws.path })
    events.emit('connect', socket, logger)
    spamer.start(socket)
  })
  socket.on('disconnect', (reason) => {
    spamer.stop()
    logger.log('disconnected', reason)
  })
  socket.on('connect_error', (err) => {
    logger.error('connect_error', err.message)
  })
  socket.onAny((event, ...args) => {
    if (config.appEnv !== 'production') {
      logger.log('event:', event)
    }
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
