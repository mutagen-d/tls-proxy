const { CIPHER_SUITES } = require("./constants");
const { TlsExtension } = require("./tls-extensions");

class TlsClientHello {
  /** @type {number} */
  version
  /** @type {ReturnType<typeof TlsExtension.parseVersion>} */
  legacyVersion
  /**
   * @type {{
   *  buffer: Buffer
   *  gmtUnixTime: string
   *  randomBytes: string
   * }}
   */
  random
  /** @type {string | null} */
  sessionId
  /** @type {number} */
  sessionIdLen
  /** @type {{ id: `0x${string}`; cs: number; name: CIPHER_SUITES[keyof typeof CIPHER_SUITES] | 'Unknown' }[]} */
  cipherSuites
  /** @type {number[]} */
  compressionMethods
  /** @type {TlsExtension[]} */
  extensions

  /**
   * @param {Partial<TlsClientHello>} [params]
   */
  constructor(params) {
    Object.assign(this, params)
  }

  changeSni(newSni) {
    const sniExtension = this.extensions.find((e) => e.type === 0)
    if (sniExtension) {
      sniExtension.server_names[0].host_name = newSni
    } else {
      // If no SNI extension exists, create one
      this.extensions.push(new TlsExtension({
        type: 0,
        server_names: [{ host_name: newSni }],
      }))
    }
  }

  toBuffer() {
    const { version, random } = this
    let offset = 0
    // legacy_version (2 bytes)
    let buffer = Buffer.alloc(2)
    buffer.writeUint16BE(version)
    offset += 2
    // random (32 bytes)
    buffer = Buffer.concat([buffer, random.buffer])
    offset += 32
    // session_id (1 byte lenght + variable)
    const { sessionId, sessionIdLen } = this
    buffer = Buffer.concat([buffer, Buffer.alloc(1)])
    buffer.writeUint8(sessionIdLen, offset)
    offset += 1
    if (sessionIdLen) {
      buffer = Buffer.concat([buffer, Buffer.from(sessionId, 'hex')])
    }
    offset += sessionIdLen
    // cipher_suites (2 bytes length + variable)
    const cipherSuitesBuffer = this.getCipherSuitesRaw()
    {
      if (!cipherSuitesBuffer.equals(this.cipherSuitesRaw)) {
        console.warn('Cipher suites buffer does not match original')
        console.log('Original     :', this.cipherSuitesRaw.toString('hex'))
        console.log('Re-serialized:', cipherSuitesBuffer.toString('hex'))
      }
    }
    const { cipherSuites } = this
    const cipherSuitesLen = cipherSuites.length * 2
    buffer = Buffer.concat([buffer, Buffer.alloc(2 + cipherSuitesLen)])
    buffer.writeUint16BE(cipherSuitesLen, offset)
    offset += 2
    for (let i = 0; i < cipherSuites.length; i += 1) {
      const cs = cipherSuites[i].cs
      buffer.writeUint16BE(cs, offset + i * 2)
    }
    offset += cipherSuitesLen
    // compression_methods (1 byte length + variable)
    const compressionBuffer = this.getCompressionMethodsRaw()
    {
      if (!compressionBuffer.equals(this.compressionMethodsRaw)) {
        console.warn('Compression methods buffer does not match original')
        console.log('Original     :', this.compressionMethodsRaw.toString('hex'))
        console.log('Re-serialized:', compressionBuffer.toString('hex'))
      }
    }
    const { compressionMethods } = this
    const compressionLen = compressionMethods.length
    buffer = Buffer.concat([buffer, Buffer.from([compressionLen]), compressionBuffer])
    offset += 1 + compressionLen
    // extensions
    const extensionsBuffer = this.getExtensionsRaw()
    {
      if (!extensionsBuffer.equals(this.extensionsRaw)) {
        console.warn('Extensions buffer does not match original')
        console.log('Original     :', this.extensionsRaw.toString('hex'))
        console.log('Re-serialized:', extensionsBuffer.toString('hex'))
      }
    }
    buffer = Buffer.concat([buffer, extensionsBuffer])
    return buffer
  }

  getExtensionsRaw() {
    const buffer = Buffer.concat(this.extensions.map((e) => e.toBuffer()))
    const extensionsLen = buffer.length
    const extLenBuffer = Buffer.alloc(2)
    extLenBuffer.writeUInt16BE(extensionsLen, 0)
    return Buffer.concat([extLenBuffer, buffer])
  }

  getCipherSuitesRaw() {
    const { cipherSuites } = this
    const cipherSuitesLen = cipherSuites.length * 2
    const buffer = Buffer.alloc(cipherSuitesLen)
    for (let i = 0; i < cipherSuites.length; i += 1) {
      const cs = cipherSuites[i].cs
      buffer.writeUint16BE(cs, i * 2)
    }
    return buffer
  }

  getCompressionMethodsRaw() {
    const { compressionMethods } = this
    const compressionLen = compressionMethods.length
    const buffer = Buffer.alloc(compressionLen)
    for (let i = 0; i < compressionMethods.length; i += 1) {
      buffer.writeUint8(compressionMethods[i], i)
    }
    return buffer
  }

  /**
   * @param {Buffer} msgBody
   */
  static from(msgBody) {
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
      const cs = msgBody.readUInt16BE(offset + i);
      cipherSuites.push({
        cs,
        /** @type {`0x${string}`} */
        id: `0x${cs.toString(16).padStart(4, '0')}`,
        /** @type {CIPHER_SUITES[keyof typeof CIPHER_SUITES]} */
        name: CIPHER_SUITES[cs] || 'Unknown',
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
    const extensions = offset < msgBody.length ? TlsExtension.from(msgBody.slice(offset)) : [];

    // Extract SNI
    const sni = extensions.find((e) => e.type === 0)?.server_names?.[0];

    // Extract ALPN protocols
    const alpn = extensions.find((e) => e.type === 16)?.protocol_name_list;

    // Extract supported_versions (for TLS 1.3 detection)
    const supportedVersions = extensions.find((e) => e.type === 43)?.versions;

    const clientHello = new TlsClientHello({
      version: legacyVersion,
      legacyVersion: TlsExtension.parseVersion(legacyVersion),
      random: {
        buffer: random,
        gmtUnixTime: new Date(gmtUnixTime * 1000).toISOString(),
        randomBytes: random.slice(4).toString('hex'),
      },
      sessionIdLen,
      sessionId: sessionId.length ? sessionId.toString('hex') : null,
      cipherSuites,
      compressionMethods,
      extensions,
      metadata: {
        sni: sni?.host_name,
        alpn,
        supportedVersions,
        isTLS13: supportedVersions?.includes('TLSv1.3'),
      },
      cipherSuitesRaw: cipherSuitesBuffer,
      compressionMethodsRaw: compressionBuffer,
      extensionsRaw: extensionsBuffer,
    });
    {
      const buffer = clientHello.toBuffer()
      if (!buffer.equals(msgBody)) {
        console.warn('Re-serialized ClientHello does not match original buffer')
        console.log('Original     :', msgBody.toString('hex'))
        console.log('Re-serialized:', buffer.toString('hex'))
      }
    }
    return clientHello
  }
}

module.exports = { TlsClientHello }