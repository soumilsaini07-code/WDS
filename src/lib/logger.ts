// ==============================================================================
// High-Performance Structured Logger & Audit Ledger
// Wolf of Dalal Street – Institutional Edition
// ==============================================================================

import fs from 'fs';
import path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';

export interface AuditRecord {
  id: string;
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  actor?: string;
  meta?: Record<string, any>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit.log');
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function ensureLogDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to ensure log directory:', err);
  }
}

function appendToAuditLog(record: AuditRecord): void {
  try {
    ensureLogDir();

    // Check size and rotate if necessary
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      const stats = fs.statSync(AUDIT_LOG_FILE);
      if (stats.size > MAX_LOG_SIZE_BYTES) {
        const rotatedFile = path.join(DATA_DIR, `audit-${Date.now()}.log`);
        fs.renameSync(AUDIT_LOG_FILE, rotatedFile);
      }
    }

    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(AUDIT_LOG_FILE, line, 'utf-8');
  } catch (err) {
    console.error('Failed to write to audit log:', err);
  }
}

class Logger {
  private format(level: LogLevel, tag: string, message: string, meta?: Record<string, any>): string {
    const ts = new Date().toISOString();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${ts}] [${level}] [${tag}] ${message}${metaStr}`;
  }

  debug(tag: string, message: string, meta?: Record<string, any>): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format('DEBUG', tag, message, meta));
    }
  }

  info(tag: string, message: string, meta?: Record<string, any>): void {
    console.info(this.format('INFO', tag, message, meta));
  }

  warn(tag: string, message: string, meta?: Record<string, any>): void {
    console.warn(this.format('WARN', tag, message, meta));
  }

  error(tag: string, message: string, error?: any, meta?: Record<string, any>): void {
    const errorDetails = error ? { errorMsg: error.message || String(error), stack: error.stack } : {};
    const merged = { ...meta, ...errorDetails };
    console.error(this.format('ERROR', tag, message, merged));
  }

  audit(action: string, actor: string, details: Record<string, any>): void {
    const record: AuditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      tag: action,
      message: `${action} executed by ${actor}`,
      actor,
      meta: details,
    };

    console.log(this.format('AUDIT', action, record.message, details));
    appendToAuditLog(record);
  }

  getRecentAuditLogs(limit: number = 50): AuditRecord[] {
    try {
      if (!fs.existsSync(AUDIT_LOG_FILE)) return [];
      const lines = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8').trim().split('\n');
      const records: AuditRecord[] = [];
      const start = Math.max(0, lines.length - limit);
      for (let i = lines.length - 1; i >= start; i--) {
        const line = lines[i].trim();
        if (line) {
          try {
            records.push(JSON.parse(line));
          } catch {}
        }
      }
      return records;
    } catch {
      return [];
    }
  }
}

export const logger = new Logger();

