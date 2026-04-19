const http = require('http')
const { EventEmitter } = require('../tools/events')
const { Server } = require('socket.io')
const { config } = require('../config')
const { getAddress } = require('../tools/get-address')
const { createLogger } = require('../tools/logger')
const { createSpamer } = require('./io-spam')

/**
 * @type {EventEmitter & {
 *  onConnect: (callback: (socket: import('socket.io').Socket, logger: typeof console) => void) => { remove: () => void }
 * }}
 */
const events = new EventEmitter()

const logger = createLogger('Socket.IO')
const server = http.createServer()
const io = new Server(server, { path: config.ws.path })


io.of(config.ws.namespace).use((socket, next) => {
  const auth = socket.handshake.auth
  if (auth.token === config.ws.token) {
    socket.data ||= {}
    socket.data.ip = auth.ip;
    return next()
  }
  const err = new Error('unauthorized')
  err.data = { message: 'unauthorized' }
  next(err)
})
const EVENTS = Object.freeze({
  connect: 'connect',
})
io.of(config.ws.namespace).on('connect', (socket) => {
  const address = getAddress(socket)
  const ip = socket.data.ip || address.remote.ip
  logger.log(ip, `connected ${address}`)
  events.emit(EVENTS.connect, socket, logger)
  const spamer = createSpamer()
  spamer.start(socket)
  socket.onAny((event, ...args) => {
    logger.log(ip, 'event:', event, ...args)
  })
  socket.on('disconnect', (reason) => {
    logger.log(ip, 'disconnected', reason)
    spamer.stop()
  })
})

events.onConnect = (callback) => {
  const remove = () => events.off(EVENTS.connect, callback)
  events.off(EVENTS.connect, callback)
  events.on(EVENTS.connect, callback)
  return { remove }
}

server.listen(config.ws.port, '127.0.0.1', () => {
  logger.log('server listening port', config.ws.port)
  logger.log('server namespace', {
    url: config.ws.url,
    port: config.ws.port,
    namespace: config.ws.namespace,
    path: config.ws.path,
  })
})

module.exports = { events }