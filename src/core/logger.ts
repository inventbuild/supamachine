export const LogLevel = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

const PREFIX = '[Supamachine]'

export function createLogger(
  subsystem: string,
  level: LogLevel
): {
  error: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
} {
  const prefix = `${PREFIX}[${subsystem}]`
  return {
    error:
      level >= LogLevel.ERROR
        ? (msg: string, ...a: unknown[]) => console.error(prefix, msg, ...a)
        : () => {},
    warn:
      level >= LogLevel.WARN
        ? (msg: string, ...a: unknown[]) => console.warn(prefix, msg, ...a)
        : () => {},
    info:
      level >= LogLevel.INFO
        ? (msg: string, ...a: unknown[]) => console.log(prefix, msg, ...a)
        : () => {},
    debug:
      level >= LogLevel.DEBUG
        ? (msg: string, ...a: unknown[]) => console.log(prefix, msg, ...a)
        : () => {},
  }
}

export function parseLogLevel(
  value: string | undefined
): LogLevel {
  if (!value) return LogLevel.WARN
  const v = value.toLowerCase()
  if (v === 'none') return LogLevel.NONE
  if (v === 'error') return LogLevel.ERROR
  if (v === 'warn') return LogLevel.WARN
  if (v === 'info') return LogLevel.INFO
  if (v === 'debug') return LogLevel.DEBUG
  return LogLevel.WARN
}
