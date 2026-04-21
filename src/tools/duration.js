const pad = (v, s = 2, f = '0') => {
  v = `${v}`
  return v.length >= s ? v : `${f.repeat(s)}${v}`.slice(-s)
}
class Duration {
  /** @param {number} [startMs] */
  constructor(startMs) {
    this.startMs = typeof startMs === 'number' ? startMs : Date.now()
  }

  durationMs() {
    return Date.now() - this.startMs
  }

  format() {
    const duration = this.durationMs()
    if (duration < 1000) {
      return `+${duration}ms`
    }
    if (duration < 60_000) {
      const sec = Math.floor(duration / 1000)
      const ms = duration - sec * 1000
      return `+${pad(sec)}.${pad(ms, 3)}s`
    }
    if (duration < 3600_000) {
      const min = Math.floor(duration / 60_000)
      const sec = Math.floor((duration - min * 60_000) / 1000)
      const ms = Math.floor((duration - min * 60_000 - sec * 1000))
      return `${pad(min)}:${pad(sec)}.${pad(ms, 3)}`
    }
    const hour = Math.floor(duration / 3600_000)
    let rem = duration - hour * 3600_000
    const min = Math.floor(rem / 60_000)
    rem -= min * 60_000
    const sec = Math.floor(rem / 1000)
    rem -= sec * 1000
    const ms = rem
    return `${pad(hour)}:${pad(min)}:${pad(sec)}.${pad(ms, 3)}`
  }
}

module.exports = { Duration }
