const fs = require('fs')
const path = require('path')
const net = require('net')
const tls = require('tls')
const { time } = require('./tools/time')

const file = fs.createWriteStream(path.join(__dirname, 'www.google.com.txt'), { flags: 'w' })
file.on('open', (fd) => {
  console.log(time(), 'file opened fd', fd);
  const interval = setInterval(() => {
    // fd might be -1 if closed; guard just in case
    if (fd >= 0) {
      fs.fsync(fd, (err) => {
        if (err) console.log(time(), 'fsync error', err.code || err);
      });
    }
  }, 250);
  file.on('close', () => {
    clearInterval(interval);
    console.log(time(), 'file closed, stopped fsync');
  })
})
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
    console.log(time(), 'secureConnected');
    // Send the HTTP request immediately after TLS is established.
    // Previously there was a 5s delay here which could cause the
    // proxy's socket timeout to fire before the request was sent.
    request();

    // Pipe decrypted application data into the file and add a few
    // debug listeners so we can see progress when running client
    // in a separate terminal.
    tlsSocket.pipe(file);
    // Ensure data is flushed periodically to the OS (and visible to other
    // processes/editors). Some editors (VSCode) may not refresh open files
    // until the writer closes the descriptor or the OS flushes buffers.
    // Call fs.fsync on the underlying fd while the stream is open.

    tlsSocket.on('data', (chunk) =>
      console.log(time(), 'tls data:', chunk.length, 'bytes'),
    );
    tlsSocket.on('error', (err) =>
      console.log(time(), 'tls error:', err && err.code ? err.code : err),
    );
    tlsSocket.on('close', () => console.log(time(), 'tls closed'));
  });
});
