const { getExtensionType, getTlsVersion } = require('./constants');

/**
 * @typedef {{
 *  type: {
 *    value: number;
 *    hex: `0x${string}`,
 *    name: ReturnType<getExtensionType>
 *  }
 *  data: {
 *    buffer: Buffer
 *    value: ReturnType<TlsExtension.parseData>
 *  }
 * }} TlsExtensionDto
 */

class TlsExtension {
  /** @type {TlsExtensionDto['type']} */
  type
  /** @type {TlsExtensionDto['data']} */
  data

  /** @param {Partial<TlsExtensionDto>} [params] */
  constructor(params) {
    Object.assign(this, params)
  }

  /** @param {Partial<TlsExtensionDto>} [params] */
  merge(params) {
    Object.assign(this, params)
    return this
  }

  toJSON() {
    const self = this;
    /** @type {'TlsExtension'} */
    const name = 'TlsExtension'
    return {
      name,
      type: this.type,
      data: {
        len: this.data.buffer.length,
        get value() {
          return self.data.value
        },
        buffer: this.data.buffer.toString('hex'),
      },
    }
  }

  toBuffer() {
    const { value } = this.data
    const server_names = value?.server_names
    if (!server_names) {
      const payload = this.data.buffer
      const buffer = Buffer.alloc(4 + payload.length);
      buffer.writeUInt16BE(this.type.value, 0);
      buffer.writeUInt16BE(payload.length, 2);
      payload.copy(buffer, 4);
      return buffer;
    }
    // server_names
    const names = server_names.map((n) => {
      const nameBuf = Buffer.from(n.host_name, 'ascii');
      const buf = Buffer.alloc(3 + nameBuf.length);
      buf[0] = n.type;
      buf.writeUInt16BE(nameBuf.length, 1);
      nameBuf.copy(buf, 3);
      return buf;
    });
    const nameList = Buffer.concat([
      Buffer.alloc(2), // Placeholder for list length
      ...names,
    ]);
    nameList.writeUInt16BE(nameList.length - 2, 0); // Write list length
    const buffer = Buffer.concat([
      Buffer.alloc(4), // Placeholder for type and length
      nameList,
    ]);
    buffer.writeUint16BE(this.type.value, 0)
    buffer.writeUint16BE(nameList.length, 2)
    return buffer
  }

  getSni() {
    if (this.type.name === 'server_name') {
      const sni = this.data.value.server_names?.find(s => s.host_name)
      return sni?.host_name
    }
    return
  }

  /**
   * @param {string} newSni
   */
  setSni(newSni) {
    if (this.type.name === 'server_name') {
      const sni = this.data.value.server_names?.find(s => s.host_name)
      if (sni) {
        sni.host_name = newSni
        return true
      }
    }
    return false
  }

  /**
   * @param {Buffer} buffer
   * @returns
   */
  static parse(buffer) {
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
      const extensionDto = {
        type: {
          value: extType,
          hex: `0x${extType.toString(16).toUpperCase()}`,
          name: getExtensionType(extType),
        },
        data: {
          buffer: extData,
          /** @type {ReturnType<TlsExtension.parseData>} */
          get value() {
            if (!extensionDto.data._value) {
              const value = TlsExtension.parseData(extensionDto.type.value, extensionDto.data.buffer)
              extensionDto.data._value = value
            }
            return extensionDto.data._value
          },
          set value(value) {
            extensionDto.data._value = value
          }
        },
      }
      const extension = new TlsExtension(extensionDto)
      offset += extLen
      extensions.push(extension)
    }
    return extensions
  }

  /**
   * @protected
   * @param {number} extType
   * @param {Buffer} extData
   */
  static parseData(extType, extData) {
    const extLen = extData.length
    let server_names
    // Parse specific extensions
    if (extType === 0 && extLen >= 5) {
      // server_name
      server_names = this.parseServerNames(extData);
    }
    let groups
    if (extType === 10) {
      // supported_groups
      groups = this.parseNamedGroups(extData);
    }
    let formats
    if (extType === 11) {
      // ec_point_formats
      formats = Array.from(extData.slice(1));
    }
    let algorithms
    if (extType === 13) {
      // signature_algorithms
      algorithms = this.parseSignatureAlgorithms(extData);
    }
    let protocol_name_list
    if (extType === 16) {
      // ALPN
      protocol_name_list = this.parseALPN(extData);
    }
    let versions
    if (extType === 43) {
      // supported_versions
      versions = this.parseSupportedVersions(extData);
    }
    let key_share
    if (extType === 51) {
      // key_share (simplified)
      key_share = extData.toString('hex').slice(0, 64) + '...';
    }
    return {
      server_names,
      groups,
      formats,
      algorithms,
      protocol_name_list,
      versions,
      key_share,
    }
  }

  /**
   * @param {Buffer} buffer
   */
  static parseServerNames(buffer) {
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
  static parseNamedGroups(buffer) {
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
    /** @type {ReturnType<getTlsVersion>[]} */
    const versions = [];
    for (let i = 1; i < 1 + len; i += 2) {
      if (i + 1 < buffer.length) {
        const v = buffer.readUInt16BE(i);
        versions.push(getTlsVersion(v))
      }
    }
    return versions;
  }
}

module.exports = { TlsExtension }
