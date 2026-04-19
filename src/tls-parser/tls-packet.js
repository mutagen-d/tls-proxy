const { getContentType, getTlsVersion, TLS_VERSIONS } = require('./constants')
const { TlsHandshake } = require('./tls-handshake')

/**
 * @typedef {ReturnType<TlsPacket.parseDto>} ITlsPacketDto
 */

class TlsPacket {
  /** @type {ITlsPacketDto['contentType']} */
  contentType
  /** @type {ITlsPacketDto['version']} */
  version
  /** @type {ITlsPacketDto['body']} */
  body
  /** @type {ITlsPacketDto['timestamp']} */
  timestamp
  /** @type {ITlsPacketDto['buffer']} */
  buffer
  /**
   * @param {Partial<ITlsPacketDto>} [params]
   */
  constructor(params) {
    Object.assign(this, params)
  }

  toJSON() {
    return {
      contentType: this.contentType,
      version: this.version,
      body: this.body.value,
      bodyLen: this.body.buffer.length,
    }
  }

  toBuffer(bodyOnly = false) {
    if (!this.isClientHello()) {
      if (bodyOnly) {
        return this.body.buffer
      }
      if (this.buffer) {
        return this.buffer
      }
      const buffer = Buffer.concat([Buffer.alloc(5), this.body.buffer])
      buffer.writeUint8(this.contentType.value)
      buffer.writeUint16BE(this.version.value, 1)
      buffer.writeUint16BE(this.body.buffer.length, 3)
      return buffer
    }
    const body = Buffer.concat(this.body.value.map(h => h.toBuffer()))
    if (bodyOnly) {
      return body
    }
    const length = body.length
    const buffer = Buffer.concat([Buffer.alloc(5), body])
    buffer.writeUint8(this.contentType.value)
    buffer.writeUint16BE(this.version.value, 1)
    buffer.writeUint16BE(length, 3)
    return buffer
  }

  isClientHello() {
    return this.contentType.name === 'Handshake' && this.body.value?.some(h => h.type.name === 'ClientHello')
  }

  isServerHello() {
    return this.contentType.name === 'Handshake' && this.body.value?.some(h => h.type.name === 'ServerHello')
  }

  getSni() {
    const ext = this.getExtension('server_name')
    return ext ? ext.getSni() : null
  }

  /** @param {string} newSni */
  setSni(newSni) {
    const ext = this.getExtension('server_name')
    return ext ? ext.setSni(newSni) : false
  }

  /**
   * @param {Parameters<TlsHandshake['getExtension']>[0]} type
   */
  getExtension(type) {
    const hello = this.body.value?.find(v => ['ServerHello', 'ClientHello'].includes(v.type.name))
    return hello ? hello.getExtension(type) : null
  }

  /**
   * @param {Buffer} buffer
   */
  static isClientHello(buffer) {
    if (!buffer || buffer.length < 6) {
      return false
    }
    const version = buffer.readUInt16BE(1);
    return Boolean(TLS_VERSIONS[version]) &&
      buffer[0] === 22 && // Handshake
      buffer[5] === 1;    // ClientHello
  }

  /**
   * @param {Buffer} buffer
   */
  static isServerHello(buffer) {
    if (!buffer || buffer.length < 6) {
      return false
    }
    const version = buffer.readUInt16BE(1);
    return Boolean(TLS_VERSIONS[version]) &&
      buffer[0] === 22 && // Handshake
      buffer[5] === 2;    // ServerHello
  }

  /**
   * @param {Buffer} buffer
   */
  static parse(buffer) {
    const packetDto = TlsPacket.parseDto(buffer)
    return new TlsPacket(packetDto)
  }

  /**
   * @protected
   * @param {Buffer} buffer
   */
  static parseDto(buffer) {
    const contentType = buffer[0];
    const version = buffer.readUInt16BE(1);
    const length = buffer.readUInt16BE(3);

    const fragment = buffer.slice(5, 5 + length);
    const contentTypeName = getContentType(contentType)
    const packetDto = {
      contentType: {
        value: contentType,
        name: contentTypeName,
      },
      version: {
        value: version,
        name: getTlsVersion(version),
        hex: `0x${version.toString(16).toUpperCase()}`,
      },
      body: {
        buffer: fragment,
        value: contentTypeName === 'Handshake' ? TlsHandshake.parse(fragment) : undefined,
      },
      timestamp: Date.now(),
      buffer: buffer.slice(0, 5 + length),
    }
    return packetDto
  }
}

module.exports = { TlsPacket }
