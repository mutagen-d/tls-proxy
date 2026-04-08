const { CIPHER_SUITES } = require("./constants");
const { TlsExtension } = require("./tls-extensions");

class TlsClientHello {
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
    const cipherSuites = [];
    for (let i = 0; i < cipherSuitesLen; i += 2) {
      const cs = msgBody.readUInt16BE(offset + i);
      cipherSuites.push({
        id: `0x${cs.toString(16).padStart(4, '0')}`,
        /** @type {CIPHER_SUITES[keyof typeof CIPHER_SUITES]} */
        name: CIPHER_SUITES[cs] || 'Unknown',
      });
    }
    offset += cipherSuitesLen;

    // compression_methods (1 byte length + variable)
    const compressionLen = msgBody[offset++];
    const compressionMethods = Array.from(
      msgBody.slice(offset, offset + compressionLen),
    );
    offset += compressionLen;

    // extensions (if data remains)
    const extensions = offset < msgBody.length ? TlsExtension.from(msgBody.slice(offset)) : [];

    // Extract SNI
    const sni = extensions.find((e) => e.type === 0)?.server_names?.[0];

    // Extract ALPN protocols
    const alpn = extensions.find((e) => e.type === 16)?.protocol_name_list;

    // Extract supported_versions (for TLS 1.3 detection)
    const supportedVersions = extensions.find((e) => e.type === 43)?.versions;

    return {
      legacyVersion: TlsExtension.parseVersion(legacyVersion),
      random: {
        gmtUnixTime: new Date(gmtUnixTime * 1000).toISOString(),
        randomBytes: random.slice(4).toString('hex'),
      },
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
    };
  }
}

module.exports = { TlsClientHello }