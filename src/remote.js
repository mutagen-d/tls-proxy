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
/**
 * @param {IProxyOptions} opts
 * @param {(err?: null) => void} callback
 */
const createProxyConnection = async (opts, callback) => {
  const key = sites.setOption(opts, opts)
  wss.events.emit(`waitWS:${key}`)
  logger.log(`on-proxy ${JSON.stringify({ key, opts })}`)
  const socket = net.createConnection(opts.dstPort, opts.dstHost)
  socket.on('connect', () => {
    logger.log('proxy-connected', key)
    wss.events.emit(`connectWS:${key}`)
    callback()
  })
  socket.on('error', (err) => {
    logger.log('proxy-error', err)
    wss.events.emit(`errorWS:${key}`)
    callback(err && err.message || 'failed')
  })
  // const fakeTls = new FakeTls(socket, {
  //   fakeSni: opts.dstHost,
  //   realSni: config.fakeHost,
  // })
  // sites[key].socket = fakeTls
  sites[key].socket = socket
}

wss.events.onConnect((socket, logger) => {
  socket.on('proxy-connection', createProxyConnection)
})

server.on('connection', async (socket) => {
  socket.setTimeout(10_000, () => socket.destroy())
  const address = getAddress(socket)
  const key = sites.getKey(address.remote)
  logger.log(`connected ${key} ${JSON.stringify(address)}`)
  const waitWS = async (address, timeoutMs) => {
    const defer = new Defer()
    const eventName = `waitWS:${key}`
    const timer = setTimeout(() => {
      defer.reject('timeout')
      wss.events.off(eventName, onConnect)
    }, timeoutMs)
    var onConnect = () => {
      clearTimeout(timer)
      defer.resolve()
    }
    wss.events.once(eventName, onConnect)
    return defer.promise
  }
  try {
    await waitWS(address.remote, 500)
    logger.log(`---- waitWS ${key}`)
  } catch (e) {
    const sock = net.createConnection(443, config.fakeHost)
    sock.on('connect', () => {
      sock.pipe(socket)
      socket.pipe(sock)
    })
    sock.on('error', () => socket.destroy()) 
    return
  }
  const connectWS = async () => {
    logger.log(`--- connectWS ${key}`)
    const opts = sites.getOptions(address.remote)
    opts.socket.pipe(socket)
    socket.pipe(opts.socket)
    wss.events.off(`errorWS:${key}`, errorWS)
  }
  const errorWS = async () => {
    logger.log(`--- errorWS ${key}`)
    socket.destroy()
    wss.events.off(`connectWS:${key}`, connectWS)
  }
  wss.events.once(`connectWS:${key}`, connectWS)
  wss.events.once(`errorWS:${key}`, errorWS)
})

server.listen(config.remote.port, '127.0.0.1', () => logger.log('server listening port', config.remote.port))