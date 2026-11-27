/**
 * Logger estructurado para Grafana Loki.
 * Encola logs en memoria y los envía en lotes cada 2000 ms a {LOKI_URL}/loki/api/v1/push.
 */

const FLUSH_INTERVAL_MS = 2000;

/**
 * Serializa un Error (incluyendo errores de OracleDB, causas encadenadas y stack trace).
 * @param {unknown} err
 * @returns {Record<string, unknown>}
 */
export function serializeError(err) {
  if (!err) return undefined;
  if (typeof err === 'string') return { message: err };
  if (typeof err !== 'object') return { value: String(err) };

  const serialized = {
    name: err.name || 'Error',
    message: err.message || String(err),
    stack: err.stack || undefined,
  };

  // Propiedades comunes de errores Node / HTTP / OracleDB
  const extraKeys = ['code', 'statusCode', 'status', 'errorNum', 'offset', 'sql', 'isOperational', 'retryAfter'];
  for (const key of extraKeys) {
    if (err[key] !== undefined) {
      serialized[key] = err[key];
    }
  }

  if (err.cause) {
    serialized.cause = serializeError(err.cause);
  }

  return serialized;
}

class LokiLogger {
  constructor() {
    this.queue = [];
    this.timer = null;
    this.flushing = false;

    if (process.env.NODE_ENV !== 'test') {
      this.startTimer();
    }
  }

  get enabled() {
    return process.env.LOKI_ENABLED === 'true';
  }

  get lokiPushUrl() {
    const raw = (process.env.LOKI_URL || 'http://localhost:3100').replace(/\/+$/, '');
    return raw.endsWith('/loki/api/v1/push') ? raw : `${raw}/loki/api/v1/push`;
  }

  get appSlug() {
    return process.env.APP_SLUG || 'proyecto-portal';
  }

  get env() {
    return process.env.NODE_ENV || 'development';
  }

  startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /**
   * Registra un log en consola local y lo encola para Loki.
   * @param {'info'|'warn'|'error'|'debug'|'verbose'} level
   * @param {string} message
   * @param {string} [context]
   * @param {Record<string, unknown>} [metadata]
   * @param {string} [job='backend']
   * @param {number} [timestamp]
   */
  log(level, message, context, metadata, job = 'backend', timestamp = Date.now()) {
    const normalizedLevel = String(level || 'info').toLowerCase();

    let resolvedContext = context;
    let resolvedMetadata = metadata;
    if (resolvedContext instanceof Error) {
      resolvedMetadata = { error: serializeError(resolvedContext) };
      resolvedContext = undefined;
    } else if (resolvedMetadata instanceof Error) {
      resolvedMetadata = { error: serializeError(resolvedMetadata) };
    }

    const safeMetadata =
      resolvedMetadata && typeof resolvedMetadata === 'object'
        ? { ...resolvedMetadata }
        : undefined;

    if (safeMetadata?.error) {
      const errObj = safeMetadata.error instanceof Error
        ? serializeError(safeMetadata.error)
        : (typeof safeMetadata.error === 'object' ? safeMetadata.error : null);

      if (errObj) {
        if (errObj.stack && !safeMetadata.stack) {
          safeMetadata.stack = errObj.stack;
        }
        safeMetadata.error = JSON.stringify(errObj);
      }
    }

    const entry = {
      timestamp,
      level: normalizedLevel,
      message: String(message ?? ''),
      ...(resolvedContext ? { context: resolvedContext } : {}),
      app: this.appSlug,
      ...(safeMetadata && Object.keys(safeMetadata).length > 0 ? { metadata: safeMetadata } : {}),
    };

    if (job === 'backend' && process.env.NODE_ENV !== 'test') {
      const prefix = `[${new Date(timestamp).toISOString()}] [${normalizedLevel.toUpperCase()}]${resolvedContext ? ` [${resolvedContext}]` : ''}`;
      if (normalizedLevel === 'error') {
        console.error(prefix, entry.message, safeMetadata || '');
      } else if (normalizedLevel === 'warn') {
        console.warn(prefix, entry.message, safeMetadata || '');
      } else {
        console.log(prefix, entry.message, safeMetadata || '');
      }
    }

    if (this.enabled) {
      this.queue.push({ job, entry });
    }
  }

  info(message, context, metadata) {
    this.log('info', message, context, metadata);
  }

  warn(message, context, metadata) {
    this.log('warn', message, context, metadata);
  }

  error(message, context, metadata) {
    this.log('error', message, context, metadata);
  }

  debug(message, context, metadata) {
    this.log('debug', message, context, metadata);
  }

  /**
   * Encola logs provenientes del frontend u otros clientes externos.
   * @param {Array<{timestamp?: number, level?: string, message: string, context?: string, metadata?: Record<string, unknown>}>} logs
   * @param {string} [job='frontend']
   */
  enqueueExternalLogs(logs, job = 'frontend') {
    if (!Array.isArray(logs) || logs.length === 0) return;
    for (const item of logs) {
      if (!item || typeof item.message !== 'string') continue;
      this.log(
        item.level || 'info',
        item.message,
        item.context || 'Frontend',
        item.metadata,
        job,
        typeof item.timestamp === 'number' ? item.timestamp : Date.now()
      );
    }
  }

  /**
   * Envía el lote actual a Loki agrupado por (job, app).
   */
  async flush() {
    if (!this.enabled || this.flushing || this.queue.length === 0) return;

    this.flushing = true;
    const batch = this.queue.splice(0, this.queue.length);

    try {
      const grouped = new Map();
      for (const item of batch) {
        const key = `${item.job}::${this.appSlug}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            stream: {
              app: this.appSlug,
              job: item.job,
              env: this.env,
            },
            values: [],
          });
        }
        const tsNs = String(BigInt(Math.trunc(item.entry.timestamp)) * 1_000_000n);
        grouped.get(key).values.push([tsNs, JSON.stringify(item.entry)]);
      }

      const payload = { streams: Array.from(grouped.values()) };
      const response = await fetch(this.lokiPushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.queue.unshift(...batch);
      }
    } catch {
      this.queue.unshift(...batch);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Detiene el temporizador y realiza un flush final antes de apagar.
   */
  async shutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}

export const logger = new LokiLogger();
