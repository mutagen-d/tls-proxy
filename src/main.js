const net = require('net');
const { TLSRecordParser } = require('./tls/tls-record-parser');
const { time } = require('./tools/time');
const { TlsPacket } = require('./tls/tls-packet');

const midelProxy = net.createServer((socket) => {
  console.log(time(), 'connected')
  socket.setTimeout(10_000, () => socket.destroy())
  socket.on('close', () => console.log(time(), 'disconnected'))
  socket.on('error', (e) => console.log(time(), 'socket error', e))

  // const parser = new TLSRecordParser()
  socket.once('data', (data) => {
    socket.pause()
    // parser.write(data)
    const [length, [packet]] = TlsPacket.from(data)
    let hostname;
    if (packet) {
      hostname = packet.getSni()
    }
    if (hostname) {
      handleConnect(hostname, data)
    }
  })
  const parserC2S = new TLSRecordParser();
  const parserS2C = new TLSRecordParser();
  var handleConnect = (hostname, data) => {
    hostname = hostname || 'www.google.com'
    if (hostname === 'mc.yandex.ru') {
      return socket.destroy()
    }
    const upstream = net.createConnection(443, hostname)
    upstream.on('error', (e) => {
      console.log(time(), 'upstream error', e)
      socket.destroy()
    })

    upstream.on('connect', () => {
      socket.resume()
      socket.pipe(parserC2S).pipe(upstream);
      upstream.pipe(parserS2C).pipe(socket);
      upstream.write(data)
    })
  }
  
  // parserC2S.on('data', (record) => {
  //   console.log('Client→Server:', record.contentTypeName, {
  //     version: record.version,
  //     length: record.length
  //   });
  // });
  
  // parserS2C.on('data', (record) => {
  //   console.log('Server→Client:', record.contentTypeName);
  // });
  
});

const port = 8075
midelProxy.listen(port, '0.0.0.0', () => console.log(time(), 'server listening port', port));
midelProxy.on('error', (err) => console.error(time(), 'server error', err));