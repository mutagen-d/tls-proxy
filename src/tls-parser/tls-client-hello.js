const { getCipherSuite, getExtensionType, getTlsVersion } = require("./constants");
const { TlsExtension } = require("./tls-extension");

/**
 * @typedef {ReturnType<TlsClientHello.parseDto>} ITlsClientHelloDto
 */

class TlsClientHello {
  /** @type {ITlsClientHelloDto['metadata']} */
  metadata
  /** @type {ITlsClientHelloDto['version']} */
  version
  /** @type {ITlsClientHelloDto['random']} */
  random
  /** @type {ITlsClientHelloDto['session']} */
  session
  /** @type {ITlsClientHelloDto['cipherSuites']} */
  cipherSuites
  /** @type {ITlsClientHelloDto['compression']} */
  compression
  /** @type {ITlsClientHelloDto['extensions']} */
  extensions

  /**
   * @param {Partial<TlsClientHello>} [params]
   */
  constructor(params) {
    Object.assign(this, params)
  }

  toJSON() {
    return {
      metadata: this.metadata,
      version: this.version,
      random: {
        gmtUnixTime: this.random.gmtUnixTime,
        randomHex: this.random.randomHex,
      },
      session: this.session.hex,
      cipherSuites: this.cipherSuites.value,
      compression: this.compression.value,
      extensions: this.extensions.value,
    }
  }

  /**
   * @param {string} newSni
   */
  setSni(newSni) {
    const sni = this.extensions.value.find(x => x.type.name === 'server_name')
    if (sni) {
      return sni.setSni(newSni)
    }
    // If no SNI extension exists, create one
    const ext = new TlsExtension({
      type: { value: 0, name: getExtensionType(0) },
      data: {
        value: { server_names: [{ type: 0, host_name: newSni }] }
      }
    })
    this.extensions.value.push(ext)
  }

  getSni() {
    const sni = this.extensions.value.find(x => x.type.name === 'server_name')
    return sni ? sni.getSni() : null
  }

  toBuffer() {
    const { version, random } = this
    let offset = 0
    // legacy_version (2 bytes)
    let buffer = Buffer.alloc(2)
    buffer.writeUint16BE(version.value)
    offset += 2
    // random (32 bytes)
    buffer = Buffer.concat([buffer, random.buffer])
    offset += 32
    // session_id (1 byte lenght + variable)
    const sessionIdBuffer = this.getSessionIdBuffer()
    buffer = Buffer.concat([buffer, sessionIdBuffer])
    offset += sessionIdBuffer.length
    // cipher_suites (2 bytes length + variable)
    const cipherSuitesBuffer = this.getCipherSuitesBuffer()
    buffer = Buffer.concat([buffer, cipherSuitesBuffer])
    offset += cipherSuitesBuffer.length
    // compression_methods (1 byte length + variable)
    const compressionMethodsBuffer = this.getCompressionMethodsBuffer()
    buffer = Buffer.concat([buffer, compressionMethodsBuffer])
    offset += compressionMethodsBuffer.length
    // extensions
    const extensionsBuffer = this.getExtensionsBuffer()
    buffer = Buffer.concat([buffer, extensionsBuffer])
    return buffer
  }

  getSessionIdBuffer() {
    const { session } = this
    const buffer = Buffer.alloc(1 + session.buffer.length)
    buffer.writeUint8(session.buffer.length)
    if (session.buffer.length) {
      session.buffer.copy(buffer, 1)
    }
    return buffer
  }

  getCipherSuitesBuffer() {
    const cipherSuitesLen = this.cipherSuites.buffer.length;
    const buffer = Buffer.alloc(2 + cipherSuitesLen)
    buffer.writeUint16BE(cipherSuitesLen)
    this.cipherSuites.buffer.copy(buffer, 2)
    return buffer
  }

  getCompressionMethodsBuffer() {
    const compressionLen = this.compression.buffer.length;
    const buffer = Buffer.alloc(1 + compressionLen)
    buffer.writeUint8(compressionLen)
    this.compression.buffer.copy(buffer, 1)
    return buffer
  }

  getExtensionsBuffer() {
    const extensionBuffer = Buffer.concat(this.extensions.value.map((e) => e.toBuffer()))
    const extensionsLen = extensionBuffer.length
    const buffer = Buffer.alloc(2 + extensionsLen)
    buffer.writeUInt16BE(extensionsLen)
    extensionBuffer.copy(buffer, 2)
    return buffer
  }

  static parse(msgBody) {
    const clientHello = TlsClientHello.parseDto(msgBody)
    return new TlsClientHello(clientHello)
  }

  /**
   * @protected
   * @param {Buffer} msgBody
   */
  static parseDto(msgBody) {
    let offset = 0;

    // legacy_version (2 bytes)
    const legacyVersion = msgBody.readUInt16BE(offset);
    offset += 2;

    // random (32 bytes)
    const random = msgBody.slice(offset, offset + 32);
    const gmtUnixTime = random.readUInt32BE(0);
    offset += 32;

    // session_id (1 byte length + variable)
    const sessionIdLen = msgBody[offset++];
    const sessionId = msgBody.slice(offset, offset + sessionIdLen);
    offset += sessionIdLen;

    // cipher_suites (2 bytes length + variable)
    const cipherSuitesLen = msgBody.readUInt16BE(offset);
    offset += 2;
    const cipherSuitesBuffer = msgBody.slice(offset, offset + cipherSuitesLen);
    const cipherSuites = [];
    for (let i = 0; i < cipherSuitesLen; i += 2) {
      const value = msgBody.readUInt16BE(offset + i);
      cipherSuites.push({
        value,
        /** @type {`0x${string}`} */
        hex: `0x${value.toString(16).padStart(4, '0')}`,
        name: getCipherSuite(value),
      });
    }
    offset += cipherSuitesLen;

    // compression_methods (1 byte length + variable)
    const compressionLen = msgBody[offset++];
    const compressionBuffer = msgBody.slice(offset, offset + compressionLen);
    const compressionMethods = Array.from(
      msgBody.slice(offset, offset + compressionLen),
    );
    offset += compressionLen;

    // extensions (if data remains)
    const extensionsBuffer = msgBody.slice(offset);
    const extensions = offset < msgBody.length ? TlsExtension.parse(msgBody.slice(offset)) : [];

    // Extract SNI
    const sni = extensions.find((e) => e.type.value === 0)?.data?.value?.server_names?.[0];

    // Extract ALPN protocols
    const alpn = extensions.find((e) => e.type.value === 16)?.data?.value?.protocol_name_list;

    // Extract supported_versions (for TLS 1.3 detection)
    const supportedVersions = extensions.find((e) => e.type.value === 43)?.data?.value?.versions;

    const clientHello = {
      metadata: {
        sni: sni?.host_name,
        alpn,
        supportedVersions,
        isTLS13: supportedVersions?.includes('TLSv1.3'),
      },
      version: {
        value: legacyVersion,
        name: getTlsVersion(legacyVersion),
      },
      random: {
        buffer: random,
        gmtUnixTime: new Date(gmtUnixTime * 1000).toISOString(),
        randomHex: random.slice(4).toString('hex'),
      },
      session: {
        buffer: sessionId,
        hex: sessionId.length ? sessionId.toString('hex') : null,
      },
      cipherSuites: {
        buffer: cipherSuitesBuffer,
        value: cipherSuites,
      },
      compression: {
        buffer: compressionBuffer,
        value: compressionMethods,
      },
      extensions: {
        buffer: extensionsBuffer,
        value: extensions,
      },
    }
    return clientHello;
  }
}

module.exports = { TlsClientHello }