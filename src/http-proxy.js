const net = require('net')
const { createProxyServer } = require('@mutagen-d/node-proxy-server')
const { time } = require('./tools/time')

const port = 8065
const server = createProxyServer({
  createProxyConnection: async (info) => {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(8075, 'localhost')
      sock.on('connect', () => resolve(sock))
      sock.on('error', e => reject(e))
    })
  },
})

server.listen(port, '0.0.0.0', () => console.log(time(), 'server listening port', port))
server.on('error', (e) => console.log(time(), 'server error', e))

