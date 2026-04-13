const http = require('http')
const EventEmitter = require('events')
const { Server } = require('socket.io')
const { config } = require('../config')

const emitter = new EventEmitter()

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
io.of('/chat').on('connect', (socket) => {
  const ip = socket.request.socket.remoteAddress
  logger.log(ip, 'connected')
  socket.on('disconnect', (reason) => {
    logger.log(ip, 'disconnected', reason)
  })
  emitter.emit('connected', socket)
})

/**
 * @param {(socket: import('socket.io').Socket) => void} callback
 */
const onConnect = (callback) => {
  const remove = () => emitter.off('connect', callback)
  remove()
  emitter.on('connect', callback)
  return { remove }
}

server.listen(config.port, '127.0.0.1', () => logger.log('server listening port', config.port))

module.exports = { onConnect }