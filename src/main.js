const net = require('net');
const { TLSRecordParser } = require('./tls/tls-record-parser');
const { time } = require('./tools/time');

const proxy = net.createServer((socket) => {
  console.log(time(), 'connected')
  socket.setTimeout(10_000, () => socket.destroy())
  socket.on('close', () => console.log(time(), 'disconnected'))
  socket.pause()
  const upstream = net.createConnection(443, 'www.google.com');

  const parserC2S = new TLSRecordParser();
  const parserS2C = new TLSRecordParser();

  upstream.on('connect', () => {
    socket.resume()
    socket.pipe(parserC2S).pipe(upstream);
    upstream.pipe(parserS2C).pipe(socket);
  })
  
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
proxy.listen(port, '0.0.0.0', () => console.log(time(), 'server listening port', port));