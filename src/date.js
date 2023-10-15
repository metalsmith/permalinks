function toDate(maybeDate) {
  if (!(maybeDate instanceof Date)) return new Date(maybeDate)
  return maybeDate
}

function getWeekOfYear(date) {
  const d = toDate(date)
  const firstOfYear = new Date(d.getUTCFullYear(), 0, 1, 0 - d.getTimezoneOffset() / 60)
  const week = 7 * 24 * 60 * 60 * 1000
  return ((d - firstOfYear) / week).toFixed(0)
}

// important: keys must be sorted from longest to shortest for matching
const dateTokens = {
  // year (full)
  YYYY(date) {
    return toDate(date).getUTCFullYear()
  },
  MMMM(date, locale = 'en-US') {
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(toDate(date))
  },
  MMM(date, locale = 'en-US') {
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(toDate(date))
  },
  dddd(date, locale = 'en-US') {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(toDate(date))
  },
  ddd(date, locale = 'en-US') {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(toDate(date))
  },
  dd(date, locale = 'en-US') {
    return this.ddd(date, locale).slice(0, 2)
  },
  // year (2 last digits)
  YY(date) {
    const y = this.YYYY(date).toFixed(0)
    if (y.length > 2) return y.slice(-2)
    return y
  },
  // date num (zero-padded)
  DD(date) {
    const d = toDate(date).getUTCDate()
    return d.toString().padStart(2, '0')
  },
  // month num (zero-padded)
  MM(date) {
    const m = toDate(date).getUTCMonth() + 1
    return (m > 9 ? '' : '0') + m
  },
  // week of year (zero-padded)
  WW(date) {
    const w = getWeekOfYear(date)
    return w.padStart(2, '0')
  },
  // unix ms timestamp
  x(date) {
    return toDate(date).valueOf()
  },
  // unix timestamp
  X(date) {
    return (this.x(date) / 1000).toFixed(0)
  },
  // date num
  D(date) {
    return toDate(date).getUTCDate()
  },
  // day of week
  d(date) {
    return toDate(date).getUTCDay()
  },
  // week of year
  W: getWeekOfYear,
  // month num
  M(date) {
    return toDate(date).getUTCMonth() + 1
  },
  // quarter
  Q(date) {
    return Math.ceil(this.M(date) / 4)
  }
}

const dateTokenKeys = Object.keys(dateTokens)

export function dateFormatter(format, locale) {
  return function formatDate(date) {
    const result = []
    while (format.length) {
      let token
      for (const tokenKey of dateTokenKeys) {
        const match = format.match(tokenKey)
        if (match && match.index === 0) {
          token = match[0]
          break
        }
      }
      const mappable = !!token
      if (!token) token = format.slice(0, 1)
      format = format.slice(token.length)
      if (mappable) token = dateTokens[token](date, locale)
      result.push(token)
    }
    return result.join('')
  }
}
