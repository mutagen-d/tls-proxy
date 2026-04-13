const http = require('http')
const EventEmitter = require('events')
const { Server } = require('socket.io')
const { config } = require('../config')
const { getAddress } = require('./get-address')

/**
 * @type {EventEmitter & {
 *  onConnect: (callback: (socket: import('socket.io').Socket, logger: typeof console) => void) => { remove: () => void }
 * }}
 */
const events = new EventEmitter()

const fns = {}
/**
 * @type {typeof console}
 */
const logger = new Proxy({}, {
  get(target, key) {
    if (!console[key]) {
      key = 'log'
    }
    fns[key] = fns[key] || console[key].bind(console, new Date().toISOString(), '[Socket.IO]')
    return fns[key]
  },
})
const server = http.createServer()
const io = new Server(server, { path: '/10chat.io' })

io.of('/chat').use((socket, next) => {
  const auth = socket.handshake.auth
  if (auth.token === config.authToken) {
    return next()
  }
  const err = new Error('unauthorized')
  err.data = { message: 'unauthorized' }
  next(err)
})
const EVENTS = Object.freeze({
  connect: 'connect',
})
io.of('/chat').on('connect', (socket) => {
  const address = getAddress(socket)
  const ip = address.remote.ip
  logger.log(ip, `connected ${address}`)
  events.emit(EVENTS.connect, socket, logger)
  socket.on('disconnect', (reason) => {
    logger.log(ip, 'disconnected', reason)
  })
})

events.onConnect = (callback) => {
  const remove = () => events.off(EVENTS.connect, callback)
  events.off(EVENTS.connect, callback)
  events.on(EVENTS.connect, callback)
  return { remove }
}

server.listen(config.port, '127.0.0.1', () => logger.log('server listening port', config.port))

module.exports = { events }