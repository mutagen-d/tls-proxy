const { time } = require("../tools/time")
const { TLS_VERSIONS } = require("./constants")
const { TlsExtension } = require("./tls-extensions")
const { TlsHandshake } = require("./tls-handshake")

class TlsPacket {
  /** @type {number} */
  contentType
  /** @type {ReturnType<typeof TlsPacket.getContentTypeName>} */
  contentTypeName
  /** @type {string} */
  version
  /** @type {TLS_VERSIONS[keyof typeof TLS_VERSIONS] | `$0x${string} (${number}.${number})`} */
  versionName
  /** @type {number} */
  length
  /** @type {Buffer} */
  fragment
  /** @type {TlsHandshake[]} */
  handshakes
  /**
   * @param {Partial<TlsPacket>} [params]
   */
  constructor(params) {
    Object.assign(this, params)
  }

  toJSON() {
    return {
      contentType: this.contentType,
      contentTypeName: this.contentTypeName,
      version: this.version,
      versionName: this.versionName,
      fragmentLength: this.fragment.length,
      handshakes: this.handshakes,
    }
  }

  /**
   * @param {Buffer} buffer 
   */
  static from(buffer) {
    /** @type {TlsPacket[]} */
    const records = []
    while (buffer.length >= 5) {
      const contentType = buffer[0];
      const version = buffer.readUInt16BE(1);
      const length = buffer.readUInt16BE(3);
      
      if (buffer.length < 5 + length) {
        break; // Wait for more data
      }
      
      const fragment = buffer.slice(5, 5 + length);
      
      const packet = new TlsPacket({
        contentType,
        contentTypeName: TlsPacket.getContentTypeName(contentType),
        version: `0x${version.toString(16)}`,
        versionName: TlsExtension.parseVersion(version),
        length,
        fragment,
        timestamp: Date.now(),
      });
      if (packet.contentTypeName === 'Handshake') {
        packet.handshakes = TlsHandshake.from(packet.fragment)
      }
      console.log(time(), `TLS_PACKET: ${JSON.stringify(packet, null, 2)}`)
      records.push(packet)

      buffer = buffer.slice(5 + length);
    }
    /** @type {[number, typeof records]} */
    const res = [buffer.length, records]
    return res
  }

  /**
   * @param {number} contentType 
   */
  static getContentTypeName(contentType) {
    switch (contentType) {
      case 20:
        return 'ChangeCipherSpec'
      case 21:
        return 'Alert'
      case 22:
        return 'Handshake'
      case 23:
        return 'ApplicationData'
      case 24:
        return 'Heartbeat'
      default:
        /** @type {`Unknown${number}`} */
        const type = `Unknown${contentType}`
        return type
    }
  }
}

module.exports = { TlsPacket }
