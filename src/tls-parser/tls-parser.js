const EventEmitter = require('events')
const { TlsPacket } = require('./tls-packet')
const { createLogger } = require('../tools/logger')

let index = 0
class TlsParser extends EventEmitter {
  constructor() {
    super()
    index += 1
    this.id = index.toString().padStart(6, '0')
    this.logger = createLogger(`TLS:${this.id}`)
    /** @type {Buffer} */
    this.buffer = Buffer.alloc(0)
    this.handshakeComplete = false
    /** @private */
    this.handshakeTypes = [
      'Handshake',
      'ChangeCipherSpec',
    ]
    this.on('handshake_complete', () => {
      this.logger.log('Handshake Complete')
    })
  }

  /**
   * @private
   * @param {TlsPacket} packet
   */
  onPacket(packet) {
    if (!packet) {
      return
    }
    this.emit('packet', packet)
    const prev = this.handshakeComplete
    this.handshakeComplete = !this.handshakeTypes.includes(packet.contentType.name)
    if (!prev && this.handshakeComplete) {
      this.emit('handshake_complete')
    }
  }

  parse(chunk) {
    let buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk
    while (buffer.length >= 5) {
      // const contentType = buffer[0];
      // const version = buffer.readUInt16BE(1);
      const length = buffer.readUInt16BE(3);
      
      if (buffer.length < 5 + length) {
        break; // Wait for more data
      }
      const packet = TlsPacket.parse(buffer.slice(0, 5 + length))
      const i = records.length
      records.push(packet)
      this.onPacket(packet)
      console.log(this.id, `[${i}] packet`, packet.contentType.name, packet.body.value?.map(h => h.type.name), packet.body.buffer.length)

      buffer = buffer.slice(5 + length);
    }
    this.buffer = buffer
    const i = records.length
    console.log(this.id, `[${i}] leftOverLen`, this.buffer.length)
    return records
  }
}

module.exports = { TlsParser }
