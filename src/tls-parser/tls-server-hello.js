const { getCipherSuite, getTlsVersion } = require("./constants");
const { TlsExtension } = require("./tls-extension");

/**
 * @typedef {ReturnType<TlsServerHello.parseDto>} ITlsServerHello
 */

class TlsServerHello {
  /** @type {ITlsServerHello['metadata']} */
  metadata
  /** @type {ITlsServerHello['random']} */
  random
  /** @type {ITlsServerHello['session']} */
  session
  /** @type {ITlsServerHello['cipherSuite']} */
  cipherSuite
  /** @type {ITlsServerHello['compression']} */
  compression
  /** @type {ITlsServerHello['extensions']} */
  extensions
  /** @type {ITlsServerHello['buffer']} */
  buffer
  /**
   * @param {Partial<ITlsServerHello>} [params]
   */
  constructor(params) {
    Object.assign(this, params)
  }

  toJSON() {
    return {
      metadata: this.metadata,
      random: {
        gmtUnixTime: this.random.gmtUnixTime,
        randomHex: this.random.randomHex,
      },
      session: this.session.hex,
      cipherSuite: this.cipherSuite,
      compression: this.compression.value,
      extensions: this.extensions.value,
    }
  }

  toBuffer() {
    return this.buffer
  }

  /**
   * @param {Buffer} msgBody 
   */
  static parse(msgBody) {
    const serverHello = TlsServerHello.parseDto(msgBody)
    return new TlsServerHello(serverHello)
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

    // cipher_suite (2 bytes)
    const cipherSuite = msgBody.readUInt16BE(offset);
    offset += 2;

    // compression_method (1 byte)
    const compressionMethod = msgBody[offset++];

    // extensions
    const extensionBuffer = msgBody.slice(offset)
    const extensions = offset < msgBody.length ? TlsExtension.parse(msgBody.slice(offset)) : [];

    // Extract supported_versions
    const supportedVersion = extensions.find((e) => e.type.value === 43)?.data.value?.versions?.[0];

    const serverHello = {
      metadata: {
        negotiatedVersion: supportedVersion,
        isTLS13: supportedVersion === 'TLSv1.3',
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
      cipherSuite: {
        value: cipherSuite,
        name: getCipherSuite(cipherSuite),
      },
      compression: {
        value: compressionMethod,
      },
      extensions: {
        buffer: extensionBuffer,
        value: extensions,
      },
      buffer: msgBody,
    }
    return serverHello
  }
}

module.exports = { TlsServerHello }
