const { Transform } = require('stream');
const { TlsPacket } = require('./tls-packet');

class TLSRecordParser extends Transform {
  constructor(options = {}, sni) {
    options = options || {}
    super(options);
    this.buffer = Buffer.alloc(0);
    this.sni = sni;
    this.handshakeComplete = false
  }

  _transform(chunk, encoding, callback) {
    if (this.handshakeComplete) {
      this.push(chunk, encoding)
      callback()
      return
    }
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const [leftoverBytes, packets] = TlsPacket.from(this.buffer);
    const consumed = this.buffer.length - leftoverBytes;
    if (consumed >= 0) {
      this.buffer = this.buffer.slice(consumed);
    }
    const isServerHelloDone = packets
      .filter(p => p.contentTypeName === 'Handshake')
      .some(p => p.handshakes?.some(h => h.msgTypeName === 'ServerHelloDone'))
    const isApplicationData = packets.some(p => p.contentTypeName === 'ApplicationData')
    if (isServerHelloDone || isApplicationData) {
      this.handshakeComplete = true
    }
    const packet = packets.find(p => p.isClientHello())
    if (packet && this.sni && this.sni !== packet.getSni()) {
      packet.changeSni(sni)
      this.push(packet.toBuffer())
    } else {
      // Forward raw chunk downstream immediately (passthrough behavior).
      this.push(chunk, encoding);
    }
    callback();
  }

  _flush(callback) {
    if (this.buffer.length > 0) {
      this.push(this.buffer);
      this.buffer = Buffer.alloc(0);
    }
    callback();
  }
}

module.exports = { TLSRecordParser };
