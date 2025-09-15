import winston from 'winston';
import fs from 'fs';
import path from 'path';

export class Logger {
  constructor() {
    // Criar diretório de logs se não existir
    const logDir = './logs';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Configurar formatos
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
      })
    );

    // Criar logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'firebird-mcp' },
      transports: [
        // Arquivo de log geral
        new winston.transports.File({
          filename: path.join(logDir, 'firebird-mcp.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        
        // Arquivo de erros
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        
        // Console (apenas em desenvolvimento)
        new winston.transports.Console({
          format: consoleFormat,
          silent: process.env.NODE_ENV === 'production'
        })
      ],
      
      // Tratamento de exceções não capturadas
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'exceptions.log')
        })
      ],
      
      // Tratamento de rejeições não capturadas
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'rejections.log')
        })
      ]
    });

    // Log de inicialização
    this.info('Logger inicializado');
  }

  // Métodos de log
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  // Métodos específicos para operações de banco
  logDatabaseOperation(operation, table, user, success, details = {}) {
    const logData = {
      operation,
      table,
      user,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (success) {
      this.info(`Operação de banco executada: ${operation}`, logData);
    } else {
      this.error(`Falha na operação de banco: ${operation}`, logData);
    }
  }

  logConnection(connectionName, success, details = {}) {
    const logData = {
      connection: connectionName,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (success) {
      this.info(`Conexão estabelecida: ${connectionName}`, logData);
    } else {
      this.error(`Falha na conexão: ${connectionName}`, logData);
    }
  }

  logSecurityEvent(event, user, details = {}) {
    const logData = {
      event,
      user,
      timestamp: new Date().toISOString(),
      ...details
    };

    this.warn(`Evento de segurança: ${event}`, logData);
  }

  // Método para obter logs recentes
  getRecentLogs(level = 'info', limit = 100) {
    return new Promise((resolve, reject) => {
      const logFile = path.join('./logs', 'firebird-mcp.log');
      
      if (!fs.existsSync(logFile)) {
        resolve([]);
        return;
      }

      fs.readFile(logFile, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const lines = data.trim().split('\n');
        const logs = lines
          .slice(-limit)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return { message: line, timestamp: new Date().toISOString() };
            }
          })
          .filter(log => !level || log.level === level);

        resolve(logs);
      });
    });
  }

  // Método para limpar logs antigos
  cleanOldLogs(daysToKeep = 30) {
    const logDir = './logs';
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    if (!fs.existsSync(logDir)) {
      return;
    }

    fs.readdir(logDir, (err, files) => {
      if (err) {
        this.error('Erro ao ler diretório de logs:', err);
        return;
      }

      files.forEach(file => {
        const filePath = path.join(logDir, file);
        
        fs.stat(filePath, (statErr, stats) => {
          if (statErr) {
            return;
          }

          if (stats.mtime < cutoffDate) {
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) {
                this.error(`Erro ao remover log antigo ${file}:`, unlinkErr);
              } else {
                this.info(`Log antigo removido: ${file}`);
              }
            });
          }
        });
      });
    });
  }

  // Método para obter estatísticas de log
  getLogStats() {
    return new Promise((resolve, reject) => {
      const logDir = './logs';
      
      if (!fs.existsSync(logDir)) {
        resolve({
          totalFiles: 0,
          totalSize: 0,
          files: []
        });
        return;
      }

      fs.readdir(logDir, (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        let totalSize = 0;
        const fileStats = [];

        const processFile = (index) => {
          if (index >= files.length) {
            resolve({
              totalFiles: files.length,
              totalSize,
              files: fileStats
            });
            return;
          }

          const file = files[index];
          const filePath = path.join(logDir, file);

          fs.stat(filePath, (statErr, stats) => {
            if (!statErr) {
              totalSize += stats.size;
              fileStats.push({
                name: file,
                size: stats.size,
                modified: stats.mtime
              });
            }

            processFile(index + 1);
          });
        };

        processFile(0);
      });
    });
  }
}
