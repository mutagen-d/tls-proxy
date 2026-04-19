const net = require('net')
const wss = require('./socket.io/io-server')
const { getAddress } = require('./tools/get-address')
const { config } = require('./config')
const { createLogger } = require('./tools/logger')
const { FakeTls } = require('./tls-parser/fake-tls')
const { Defer } = require('./tools/defer')

const logger = createLogger('remote')
const server = net.createServer()
/**
 * @typedef {{
 *  dstHost: string
 *  dstPort: string | number
 *  srcHost: string
 *  srcPort: string | number
 * }} IProxyOptions
 */
/**
 * @typedef {IProxyOptions & { socket?: import('net').Socket} } ISiteOptions
 */
/**
 * @type {{
 *  [address: string]: ISiteOptions
 *  getOptions: (address: { ip: string; port: string }) => ISiteOptions | undefined
 *  getKey: (address: { ip: string; port: string }) => string
 *  setOption: (address: { ip: string; port: string } | { srcHost: string; srcPort: string }, opts: ISiteOptions) => string
 * }}
 */
const sites = {
  setOption: (address, opts) => {
    const ip = address.ip || address.srcHost
    const port = address.port || address.srcPort
    const key = sites.getKey({ ip, port })
    sites[key] = opts
    return key
  },
  getOptions: (address) => {
    const key = sites.getKey(address)
    return sites[key]
  },
  getKey: (address) => {
    return `${address.ip}:${address.port}`
  },
}
const WAIT = {
  minMs: 100_000,
  maxMs: 0,
}
/**
 * @param {IProxyOptions} opts
 * @param {(err?: null) => void} callback
 */
const createProxyConnection = async (opts, callback) => {
  const srcKey = sites.setOption(opts, opts)
  const wait = {}
  wss.events.emit(`waitWS:${srcKey}`, wait)
  const dstKey = `${opts.dstHost}:${opts.dstPort}`
  logger.log(`proxy_request ${srcKey} ${dstKey} +${wait.ms}ms (min = +${wait.minMs}ms, max = +${wait.maxMs}ms)`)
  const socket = net.createConnection(opts.dstPort, opts.dstHost)
  socket.setTimeout(30_000, () => socket.destroy())
  socket.on('connect', () => {
    logger.log(`proxy_connected ${srcKey} ${dstKey}`)
    wss.events.emit(`connectWS:${srcKey}`)
    callback()
  })
  socket.on('error', (err) => {
    logger.log(`proxy_error ${srcKey} ${dstKey}`, err)
    wss.events.emit(`errorWS:${srcKey}`)
    callback(err && err.message || 'failed')
  })
  const fakeTls = new FakeTls(socket, {
    fakeSni: opts.dstHost,
    realSni: config.fakeHost,
  })
  sites[srcKey].socket = fakeTls
}

wss.events.onConnect((socket, logger) => {
  socket.on('proxy-connection', createProxyConnection)
})

server.on('connection', async (socket) => {
  socket.setTimeout(10_000, () => socket.destroy())
  const address = getAddress(socket)
  const key = sites.getKey(address.remote)
  logger.log(`connected ${key}`)
  socket.once('close', () => {
    delete sites[key]
    logger.log(`disconnected ${key}`)
  })
  let startTime
  const waitWS = async (timeoutMs) => {
    startTime = Date.now()
    const defer = new Defer()
    const eventName = `waitWS:${key}`
    const timer = setTimeout(() => {
      defer.reject('timeout')
      wss.events.off(eventName, onConnect)
    }, timeoutMs)
    var onConnect = (obj) => {
      clearTimeout(timer)
      const ms = Date.now() - startTime
      WAIT.minMs = Math.min(ms, WAIT.minMs)
      WAIT.maxMs = Math.max(ms, WAIT.maxMs)
      if (obj) {
        obj.ms = ms
        obj.minMs = WAIT.minMs
        obj.maxMs = WAIT.maxMs
      }
      defer.resolve()
    }
    wss.events.once(eventName, onConnect)
    return defer.promise
  }
  try {
    await waitWS(config.remote.waitMs)
  } catch (e) {
    const sock = net.createConnection(443, config.fakeHost)
    sock.setTimeout(30_000, () => sock.destroy())
    sock.on('connect', () => {
      sock.pipe(socket)
      socket.pipe(sock)
    })
    sock.on('error', () => socket.destroy()) 
    return
  }
  const connectWS = async () => {
    const opts = sites.getOptions(address.remote)
    opts.socket.pipe(socket)
    socket.pipe(opts.socket)
    wss.events.off(`errorWS:${key}`, errorWS)
  }
  const errorWS = async () => {
    socket.destroy()
    wss.events.off(`connectWS:${key}`, connectWS)
  }
  wss.events.once(`connectWS:${key}`, connectWS)
  wss.events.once(`errorWS:${key}`, errorWS)
})

server.listen(config.remote.port, '0.0.0.0', () => logger.log('server listening port', config.remote.port))