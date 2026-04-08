const { sha256 } = require("../tools/sha256")
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

  getSni() {
    const ext = this.getExtension('server_name')
    if (!ext) {
      return null
    }
    const sni = ext.server_names?.[0]?.host_name
    return sni
  }

  /**
   * 
   * @param {number | import('./constants')['EXTENSION_TYPES'][keyof typeof import('./constants')['EXTENSION_TYPES']]} type 
   * @returns 
   */
  getExtension(type) {
    const hello = this.handshakes?.find(h => ['ServerHello', 'ClientHello'].includes(h.msgTypeName))
    if (!hello) {
      return null
    }
    /** @type {import('./tls-extensions').TlsExtension[]} */
    const extensions = hello.parsed?.extensions
    if (!extensions) {
      return null
    }
    const ext = extensions.find(ext => {
      return typeof type === 'string' ? ext.typeName === type : type === ext.type
    })
    return ext ? ext : null
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
      const FE0D = packet.getExtension(0xFE0D)
      const sni = packet.getExtension('server_name')
      // if (sni && sni.server_names?.[0]?.host_name === 'www.google.com') {
      //   console.log(time(), `TLS_PACKET: ${JSON.stringify([sni, FE0D], null, 2)}`)
      // }
      if (sni && FE0D) {
        const hash = sha256(FE0D?.raw_data)?.toString('hex').slice(0, 8)
        const handshake = packet.handshakes?.find(h => h.msgTypeName === 'ClientHello' || h.msgTypeName === 'ServerHello')
        console.log(time(), `TLS: FE0D=${FE0D?.length}, hash=${hash}, type=${handshake?.msgTypeName}, host=${sni.server_names[0].host_name}`)
      }
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
