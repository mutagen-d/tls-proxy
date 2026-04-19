const TLS_VERSIONS = Object.freeze({
  0x0301: 'TLSv1.0',
  0x0302: 'TLSv1.1',
  0x0303: 'TLSv1.2',
  0x0304: 'TLSv1.3',
  0x7f00: 'DTLSv1.0',
  0xfefd: 'DTLSv1.2',
  0xfeff: 'DTLSv1.3'
})
const getTlsVersion = (version) => {
  const major = (version >> 8) & 0xff;
  const minor = version & 0xff;
  /** @type {TLS_VERSIONS[keyof TLS_VERSIONS] | `0x${string} (${number}.${number})`} */
  const name = TLS_VERSIONS[version] || `0x${version.toString(16)} (${major}.${minor})`;
  return name
}

/**
 * RFC 8446 / RFC 5246 constants
 */
const CONTENT_TYPES = Object.freeze({
  20: 'ChangeCipherSpec',
  21: 'Alert',
  22: 'Handshake',
  23: 'ApplicationData',
  24: 'Heartbeat',
});

const getContentType = (contentType) => {
  /** @type {CONTENT_TYPES[keyof CONTENT_TYPES] | `Unknown${number}`} */
  const name = CONTENT_TYPES[contentType]
  return name || `Unknown${contentType}`
}

const HANDSHAKE_TYPES = Object.freeze({
  0: 'HelloRequest',
  1: 'ClientHello',
  2: 'ServerHello',
  3: 'HelloVerifyRequest',
  4: 'NewSessionTicket',
  8: 'EncryptedExtensions',
  11: 'Certificate',
  12: 'ServerKeyExchange',
  13: 'CertificateRequest',
  14: 'ServerHelloDone',
  15: 'CertificateVerify',
  16: 'ClientKeyExchange',
  20: 'Finished',
  24: 'EndOfEarlyData',
  25: 'KeyUpdate',
  26: 'CompressedCertificate'
});
const getHandshakeType = (type) => {
  /** @type {HANDSHAKE_TYPES[keyof HANDSHAKE_TYPES] | `Unknown`} */
  const name = HANDSHAKE_TYPES[type] || `Unknown`
  return name
}

const EXTENSION_TYPES = Object.freeze({
  0: 'server_name',
  1: 'max_fragment_length',
  5: 'status_request',
  10: 'supported_groups',
  11: 'ec_point_formats',
  13: 'signature_algorithms',
  16: 'application_layer_protocol_negotiation', // ALPN
  18: 'signed_certificate_timestamp',
  21: 'encrypt_then_mac',
  22: 'extended_master_secret',
  23: 'token_binding',
  27: 'compress_certificate',
  28: 'record_size_limit',
  35: 'session_ticket',
  41: 'pre_shared_key',
  42: 'early_data',
  43: 'supported_versions',
  44: 'cookie',
  45: 'psk_key_exchange_modes',
  46: 'certificate_authorities',
  47: 'oid_filters',
  48: 'post_handshake_auth',
  49: 'signature_algorithms_cert',
  51: 'key_share',
  57: 'quic_transport_parameters',
  65281: 'renegotiation_info'
});
const getExtensionType = (type) => {
  /** @type {EXTENSION_TYPES[keyof EXTENSION_TYPES] | `Unknown`} */
  const name = EXTENSION_TYPES[type] || `Unknown`
  return name
}

const CIPHER_SUITES = Object.freeze({
  0x1301: 'TLS_AES_128_GCM_SHA256',
  0x1302: 'TLS_AES_256_GCM_SHA384',
  0x1303: 'TLS_CHACHA20_POLY1305_SHA256',
  0x1304: 'TLS_AES_128_CCM_SHA256',
  0x1305: 'TLS_AES_128_CCM_8_SHA256',
  0xc02b: 'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
  0xc02c: 'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
  0xc02f: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
  0xc030: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
  0xcca8: 'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256',
  0xcca9: 'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
  // Add more as needed
});
const getCipherSuite = (type) => {
  /** @type {CIPHER_SUITES[keyof CIPHER_SUITES] | `Unknown`} */
  const name = CIPHER_SUITES[type] || `Unknown`
  return name
}

module.exports = {
  TLS_VERSIONS,
  CONTENT_TYPES,
  HANDSHAKE_TYPES,
  EXTENSION_TYPES,
  CIPHER_SUITES,
  getContentType,
  getTlsVersion,
  getHandshakeType,
  getExtensionType,
  getCipherSuite,
}