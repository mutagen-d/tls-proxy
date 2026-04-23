const net = require('net')
const ss = require('socket.io-stream')
const wss = require('./socket.io/io-server')
const { getAddress } = require('./tools/get-address')
const { config } = require('./config')
const { createLogger } = require('./tools/logger')
const { FakeTls } = require('./tls-parser/fake-tls')
const { Defer } = require('./tools/defer')
const { EventEmitter } = require('./tools/events')
const { Duration } = require('./tools/duration')
const { memoryUsage } = require('./tools/memory-usage')

const logger = createLogger('remote')
const server = net.createServer()
const localEmitter = new EventEmitter()

/**
 * @type {{
 *  [id: string]: {
 *    id: string
 *    host: string;
 *    port: number;
 *    duration: Duration
 *    socket: FakeTls
 *    srcPort?: number
 *  }
 * }}
 */
const PROXIES = {}
/**
 * @type {{
 *  [port: string]: net.Socket
 * }}
 */
const SOCKETS = {}

/**
 * @type {{
 *  [port: string]: {
 *    id: string
 *    port: number
 *  }
 * }}
 */
const ATTACHES = {}

const createFakeTls = (socket, dstHost) => {
  const stream = new FakeTls(socket, { fakeSni: dstHost, realSni: config.fakeHost })
  stream.once('error', (err) => {
    logger.log('fake-tls Error:', dstHost, err)
    stream.destroy()
  })
  return stream
}
/**
 * @param {{ dstHost: string; dstPort: number; id: string }} opts
 * @param {(err?: null) => void} callback
 */
const connectProxy = async (opts, callback) => {
  const { dstHost, dstPort, id } = opts
  const duration = new Duration()

  const socket = net.createConnection(dstPort, dstHost)
  socket.setTimeout(30_000, () => socket.destroy())
  PROXIES[id] = { id, host: dstHost, port: dstPort, duration }
  const data = PROXIES[id]

  const dstKey = `${dstHost}:${dstPort}`
  logger.log(`proxy-request ${id} ${dstKey}`)

  socket.once('connect', () => {
    logger.log(`proxy-connected ${id} ${dstKey} ${duration.format()}`)
    data.socket = createFakeTls(socket, dstHost)
    data.socket.once('close', () => socket.destroy())
    callback()
    localEmitter.emit(`proxy:${id}`)
  })
  socket.once('error', (err) => {
    logger.log(`proxy-error ${id} ${dstKey}`, err)
    callback(err && err.message || 'failed')
  })
  socket.once('close', () => {
    delete PROXIES[id]
    if (data.socket) {
      data.socket.destroy()
    }
  })
}

/**
 * @param {{ id: string; srcHost: string; srcPort: number }} opts 
 * @param {(err?: any) => any} callback 
 */
async function attachProxy(opts, callback) {
  const { srcHost, srcPort, id } = opts
  const att = ATTACHES[srcPort] = { id, port: srcPort }
  if (!PROXIES[id] || !PROXIES[id].socket) {
    const def = new Defer()
    const sub = localEmitter.once(`proxy:${id}`, () => def.resolve())
    const timer = setTimeout(() => def.resolve('timeout'), 10_000)
    const res = await def.promise
    clearTimeout(timer)
    sub.remove()
    if (res === 'timeout') {
      logger.log('proxy-attach-failed', res)
      return callback('timeout')
    }
  }
  try {
    const proxy = PROXIES[id]
    const socket = SOCKETS[srcPort]
    proxy.srcPort = srcPort
    proxy.socket.pipe(socket)
    socket.pipe(proxy.socket)

    socket.once('close', () => proxy.socket.destroy())
    proxy.socket.once('close', () => socket.destroy())
    const info = { ...att, host: `${proxy.host}:${proxy.port}` }
    logger.log(`proxy-attached ${JSON.stringify(info)} ${proxy.duration.format()}`)
    callback()
  } catch (err) {
    logger.log(`proxy-attach-error ${id}:`, err)
    callback(err && err.message || err)
  }
}

wss.events.onConnect((socket, logger) => {
  socket.on('proxy-connect', connectProxy)
  socket.on('proxy-attach', attachProxy)
  ss(socket).on('proxy-stream', (stream, opts, callback) => {
    const socket = net.createConnection(opts.dstPort, opts.dstHost)
    socket.on('connect', () => callback())
    socket.on('error', (err) => callback(err && (err.message || err)))
    socket.pipe(stream).pipe(socket)
  })
})

const connectFakeHost = (socket, data, duration) => {
  duration = duration || new Duration()
  const fake = net.createConnection(443, config.fakeHost)
  fake.setTimeout(config.keepAliveMs, () => fake.destroy())
  fake.once('connect', () => {
    logger.log(`active-probe connected ${config.fakeHost}:443 ${duration.format()}`)
    if (data) {
      fake.write(data)
    }
    fake.pipe(socket)
    socket.pipe(fake)
  })
  fake.once('error', (err) => {
    logger.log(`active-probe error ${config.fakeHost}:443:`, err)
    socket.destroy()
  })
  fake.once('close', () => socket.destroy())
  socket.once('close', () => fake.destroy())
}

function removeSocket(srcPort) {
  delete SOCKETS[srcPort]
  const att = ATTACHES[srcPort]
  delete ATTACHES[srcPort]
  if (!att) {
    return
  }
  const proxy = PROXIES[att.id]
  delete PROXIES[att.id]
  if (proxy && proxy.socket) {
    proxy.socket.destroy()
  }
}

server.on('connection', async (socket) => {
  const duration = new Duration()
  socket.setTimeout(config.keepAliveMs, () => socket.destroy())
  const address = getAddress(socket)
  /** @type {number} */
  const srcPort = address.remote.port
  SOCKETS[srcPort] = socket
  socket.once('close', () => {
    const att = ATTACHES[srcPort]
    removeSocket(srcPort)
    logger.log(`SOCKET[${srcPort}] closed ${duration.format()}${att ? ' (attached)' : ''}`)
  })
  socket.once('error', (err) => {
    const att = ATTACHES[srcPort]
    logger.log(`SOCKET[${srcPort}] Error:${att ? ` (id = ${att.id})` : ''}`, err)
    socket.destroy()
  })
  socket.once('data', (data) => {
    if (!ATTACHES[srcPort]) {
      connectFakeHost(socket, data, duration)
    }
  })
})

server.on('error', (err) => logger.log('ERROR:', err))
server.listen(config.remote.port, '0.0.0.0', () => logger.log('server listening port', config.remote.port))


const clear = () => {
  if (global.gc) {
    global.gc()
    logger.log(`GC triggered manually`)
  }
  }
setInterval(() => {
  const mem = memoryUsage()
  logger.log(`memory: ${JSON.stringify(mem)}`)
}, 5000)
setInterval(() => clear(), 10_000);