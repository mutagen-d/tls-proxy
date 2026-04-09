const { CIPHER_SUITES } = require("./constants");
const { TlsExtension } = require("./tls-extensions");

class TlsServerHello {
  /** @param {Buffer} msgBody */
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

    // cipher_suite (2 bytes)
    const cipherSuite = msgBody.readUInt16BE(offset);
    offset += 2;

    // compression_method (1 byte)
    const compressionMethod = msgBody[offset++];

    // extensions
    const extensions = offset < msgBody.length ? TlsExtension.from(msgBody.slice(offset)) : [];

    // Extract supported_versions
    const supportedVersion = extensions.find((e) => e.type === 43)?.versions?.[0];

    return {
      legacyVersion: TlsExtension.parseVersion(legacyVersion),
      random: {
        gmtUnixTime: new Date(gmtUnixTime * 1000).toISOString(),
        randomBytes: random.slice(4).toString('hex'),
      },
      sessionId: sessionId.length ? sessionId.toString('hex') : null,
      cipherSuite: {
        id: `0x${cipherSuite.toString(16).padStart(4, '0')}`,
        name: CIPHER_SUITES[cipherSuite] || 'Unknown',
      },
      compressionMethod,
      extensions,
      metadata: {
        negotiatedVersion: supportedVersion,
        isTLS13: supportedVersion === 'TLSv1.3',
      },
    };
  }
}

module.exports = { TlsServerHello }
