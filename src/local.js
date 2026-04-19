const net = require('net')
const { createProxyServer } = require('@mutagen-d/node-proxy-server')
const { config } = require('./config')
const { connect } = require('./socket.io/io-client')
const { getAddress } = require('./tools/get-address')
const { Defer } = require('./tools/defer')
const { FakeTls } = require('./tls-parser/fake-tls')
const { createLogger } = require('./tools/logger')
const { fetchIP } = require('./tools/fetch-ip')

const logger = createLogger('local')
const ws = connect()
const server = createProxyServer({
  createProxyConnection: async (opts, req) => {
    const { dstHost, dstPort } = opts
    const isTls = req && req.method.toLowerCase() === 'connect' && dstPort !== 80;
    const socket = net.createConnection(config.remote.port, config.remote.host)
    logger.log(`proxy: ${dstHost}:${dstPort}`)
    const conn = new Defer()
    socket.on('connect', () => conn.resolve())
    socket.on('error', (err) => conn.reject(err))
    await conn.promise
    const address = getAddress(socket)
    const srcPort = address.local.port
    const srcHost = await fetchIP()
    const defer = new Defer()
    ws.emit('proxy-connection', { dstHost, dstPort, srcHost, srcPort }, (err) => {
      if (err) {
        logger.log('proxy-error', err)
        defer.reject(err)
        socket.destroy()
      } else {
        logger.log('proxy-connected', err)
        defer.resolve()
      }
    })
    await defer.promise
    if (!isTls) {
      return socket
    }
    logger.log(`fakeTLS: ${JSON.stringify({ fakeSni: config.fakeHost, realSni: dstHost })}`)
    return socket
    const fakeTls = new FakeTls(socket, {
      fakeSni: config.fakeHost,
      realSni: dstHost,
    })
    return fakeTls
  }
})

server.listen(config.local.port, '127.0.0.1', () => logger.log('server listening port', config.local.port))