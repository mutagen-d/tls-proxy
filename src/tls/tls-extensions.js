const { TLS_VERSIONS, EXTENSION_TYPES } = require("./constants");

class TlsExtension {
  /** @type {number} */
  type
  /** @type {EXTENSION_TYPES[keyof typeof EXTENSION_TYPES] | `Unknown${number}`} */
  typeName
  /** @type {number} */
  length
  /** @type {ReturnType<typeof TlsExtension.parseServerNameList>} */
  server_names
  /** @type {ReturnType<typeof TlsExtension.parseNamedGroupList>} */
  groups
  /** @type {number[]} */
  formats
  /** @type {ReturnType<typeof TlsExtension.parseSignatureAlgorithms>} */
  algorithms
  /** @type {ReturnType<typeof TlsExtension.parseALPN>} */
  protocol_name_list
  /** @type {ReturnType<typeof TlsExtension.parseSupportedVersions>} */
  versions
  /** @type {string} */
  key_share

  /**
   * @param {Partial<TlsExtension>} [params]
   */
  constructor(params) {
    Object.assign(this, params)
  }

  toJSON() {
    return {
      type: this.type,
      typeName: this.typeName,
      length: this.length,
      server_names: this.server_names,
      groups: this.groups,
      formats: this.formats,
      algorithms: this.algorithms,
      protocol_name_list: this.protocol_name_list,
      versions: this.versions,
      key_share: this.key_share,
    }
  }
  /**
   * @param {Buffer} buffer
   * @returns
   */
  static from(buffer) {
    if (buffer.length < 2) return [];

    let offset = 0;
    // First 2 bytes = total extensions length (sometimes omitted in fragmented records)
    const extListLen = buffer.readUInt16BE(offset);
    offset += 2;

    const extensions = [];

    while (offset + 4 <= buffer.length) {
      const extType = buffer.readUInt16BE(offset);
      const extLen = buffer.readUInt16BE(offset + 2);
      offset += 4;

      if (offset + extLen > buffer.length) break;

      const extData = buffer.slice(offset, offset + extLen);
      const ext = {
        type: extType,
        typeName: EXTENSION_TYPES[extType] || `Unknown(${extType})`,
        length: extLen,
      };

      // Parse specific extensions
      if (extType === 0 && extLen >= 5) {
        // server_name
        ext.server_names = this.parseServerNameList(extData);
      } else if (extType === 10) {
        // supported_groups
        ext.groups = this.parseNamedGroupList(extData);
      } else if (extType === 11) {
        // ec_point_formats
        ext.formats = Array.from(extData.slice(1));
      } else if (extType === 13) {
        // signature_algorithms
        ext.algorithms = this.parseSignatureAlgorithms(extData);
      } else if (extType === 16) {
        // ALPN
        ext.protocol_name_list = this.parseALPN(extData);
      } else if (extType === 43) {
        // supported_versions
        ext.versions = this.parseSupportedVersions(extData);
      } else if (extType === 51) {
        // key_share (simplified)
        ext.key_share = extData.toString('hex').slice(0, 64) + '...';
      }

      extensions.push(new TlsExtension(ext));
      offset += extLen;
    }

    return extensions;
  }

  /**
   * @param {Buffer} buffer
   */
  static parseServerNameList(buffer) {
    const names = [];
    let offset = 2; // Skip list length
    while (offset + 3 <= buffer.length) {
      const nameType = buffer[offset++];
      const nameLen = buffer.readUInt16BE(offset);
      offset += 2;
      if (offset + nameLen <= buffer.length) {
        names.push({
          type: nameType,
          host_name: buffer.slice(offset, offset + nameLen).toString('ascii'),
        });
        offset += nameLen;
      } else break;
    }
    return names;
  }

  /**
   * @param {Buffer} buffer
   */
  static parseALPN(buffer) {
    const protocols = [];
    let offset = 2; // Skip list length
    while (offset < buffer.length) {
      const len = buffer[offset++];
      if (offset + len <= buffer.length) {
        protocols.push(buffer.slice(offset, offset + len).toString('ascii'));
        offset += len;
      } else break;
    }
    return protocols;
  }

  /**
   * @param {Buffer} buffer
   */
  static parseNamedGroupList(buffer) {
    if (buffer.length < 2) return [];
    const len = buffer.readUInt16BE(0);
    const groups = [];
    for (let i = 2; i < 2 + len; i += 2) {
      if (i + 1 < buffer.length) {
        groups.push(`0x${buffer.readUInt16BE(i).toString(16)}`);
      }
    }
    return groups;
  }

  /**
   * @param {Buffer} buffer
   */
  static parseSignatureAlgorithms(buffer) {
    if (buffer.length < 2) return [];
    const len = buffer.readUInt16BE(0);
    const algs = [];
    for (let i = 2; i < 2 + len; i += 2) {
      if (i + 1 < buffer.length) {
        algs.push(`0x${buffer.readUInt16BE(i).toString(16)}`);
      }
    }
    return algs;
  }

  /**
   * @param {Buffer} buffer
   */
  static parseSupportedVersions(buffer) {
    if (buffer.length < 1) return [];
    const len = buffer[0];
    const versions = [];
    for (let i = 1; i < 1 + len; i += 2) {
      if (i + 1 < buffer.length) {
        const v = buffer.readUInt16BE(i);
        versions.push(this.parseVersion(v));
      }
    }
    return versions;
  }

  static parseVersion(bytes) {
    const major = (bytes >> 8) & 0xff;
    const minor = bytes & 0xff;
    /** @type {TLS_VERSIONS[keyof typeof TLS_VERSIONS] | `0x${string} (${number}.${number})`} */
    const versionName = TLS_VERSIONS[bytes] || `0x${bytes.toString(16)} (${major}.${minor})`;
    return versionName
  }
}

module.exports = { TlsExtension }
