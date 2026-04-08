const fs = require('fs')
const path = require('path')
const net = require('net')
const tls = require('tls')
const { time } = require('./tools/time')

const file = fs.createWriteStream(path.join(__dirname, 'www.google.com.txt'), { flags: 'w' })
const port = 8075
const socket = net.createConnection(port, 'localhost')
socket.on('connect', () => {
  console.log(time(), 'connected')
  const tlsSocket = tls.connect({ socket, servername: 'www.google.com', port: 443 })
  const request = () => {
    const SEP = '\r\n'
    tlsSocket.write([
      'GET / HTTP/1.1',
      'Host: www.google.com',
      'User-Agent: GeminiBot 0.1',
      SEP,
    ].join(SEP))
  }
  tlsSocket.on('secureConnect', () => {
    console.log(time(), 'secureConnected')
    setTimeout(() => request(), 5_000)
    tlsSocket.pipe(file)
  })
})