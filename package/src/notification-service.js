import { Logger } from './logger.js';
import fs from 'fs';
import path from 'path';

export class NotificationService {
  constructor() {
    this.logger = new Logger();
    this.notifications = [];
    this.subscribers = new Map();
    this.notificationLogPath = './logs/notifications.log';
    this.initializeNotificationLog();
  }

  initializeNotificationLog() {
    try {
      const logDir = path.dirname(this.notificationLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      if (!fs.existsSync(this.notificationLogPath)) {
        fs.writeFileSync(this.notificationLogPath, '');
      }
    } catch (error) {
      this.logger.error('Erro ao inicializar log de notificações:', error);
    }
  }

  // ===== SISTEMA DE NOTIFICAÇÕES =====

  async sendNotification(type, message, details = {}) {
    const notification = {
      id: this.generateNotificationId(),
      type,
      message,
      details,
      timestamp: new Date().toISOString(),
      read: false
    };

    try {
      // Adicionar à lista de notificações
      this.notifications.push(notification);

      // Log da notificação
      this.logNotification(notification);

      // Notificar subscribers
      await this.notifySubscribers(notification);

      // Log no sistema
      this.logger.info(`Notificação enviada: ${type}`, notification);

      return notification;
    } catch (error) {
      this.logger.error('Erro ao enviar notificação:', error);
      throw error;
    }
  }

  async sendDatabaseAlert(alertType, message, details = {}) {
    const alertDetails = {
      ...details,
      category: 'database',
      severity: this.getAlertSeverity(alertType)
    };

    return await this.sendNotification('DATABASE_ALERT', message, alertDetails);
  }

  async sendSecurityAlert(alertType, message, details = {}) {
    const alertDetails = {
      ...details,
      category: 'security',
      severity: this.getAlertSeverity(alertType)
    };

    return await this.sendNotification('SECURITY_ALERT', message, alertDetails);
  }

  async sendPerformanceAlert(alertType, message, details = {}) {
    const alertDetails = {
      ...details,
      category: 'performance',
      severity: this.getAlertSeverity(alertType)
    };

    return await this.sendNotification('PERFORMANCE_ALERT', message, alertDetails);
  }

  async sendSystemAlert(alertType, message, details = {}) {
    const alertDetails = {
      ...details,
      category: 'system',
      severity: this.getAlertSeverity(alertType)
    };

    return await this.sendNotification('SYSTEM_ALERT', message, alertDetails);
  }

  // ===== TIPOS DE ALERTAS ESPECÍFICOS =====

  async alertDatabaseConnectionFailed(connectionName, error) {
    return await this.sendDatabaseAlert(
      'CONNECTION_FAILED',
      `Falha na conexão com o banco: ${connectionName}`,
      {
        connection: connectionName,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertDatabaseConnectionRestored(connectionName) {
    return await this.sendDatabaseAlert(
      'CONNECTION_RESTORED',
      `Conexão com o banco restaurada: ${connectionName}`,
      {
        connection: connectionName,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertHighDatabaseUsage(usage, threshold) {
    return await this.sendPerformanceAlert(
      'HIGH_DATABASE_USAGE',
      `Uso do banco de dados alto: ${usage}% (limite: ${threshold}%)`,
      {
        usage,
        threshold,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertSlowQuery(query, executionTime, threshold) {
    return await this.sendPerformanceAlert(
      'SLOW_QUERY',
      `Query lenta detectada: ${executionTime}ms (limite: ${threshold}ms)`,
      {
        query: this.sanitizeQuery(query),
        executionTime,
        threshold,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertSuspiciousActivity(activity, user, details) {
    return await this.sendSecurityAlert(
      'SUSPICIOUS_ACTIVITY',
      `Atividade suspeita detectada: ${activity}`,
      {
        activity,
        user,
        ...details,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertFailedLogin(user, attempts, ip) {
    return await this.sendSecurityAlert(
      'FAILED_LOGIN',
      `Múltiplas tentativas de login falhadas para usuário: ${user}`,
      {
        user,
        attempts,
        ip,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertSensitiveTableAccess(user, table, operation) {
    return await this.sendSecurityAlert(
      'SENSITIVE_TABLE_ACCESS',
      `Acesso a tabela sensível: ${table} por usuário: ${user}`,
      {
        user,
        table,
        operation,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertSystemError(error, component) {
    return await this.sendSystemAlert(
      'SYSTEM_ERROR',
      `Erro no sistema: ${error.message}`,
      {
        error: error.message,
        stack: error.stack,
        component,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertBackupCompleted(backupPath, size, duration) {
    return await this.sendDatabaseAlert(
      'BACKUP_COMPLETED',
      `Backup concluído com sucesso: ${backupPath}`,
      {
        backupPath,
        size,
        duration,
        timestamp: new Date().toISOString()
      }
    );
  }

  async alertBackupFailed(backupPath, error) {
    return await this.sendDatabaseAlert(
      'BACKUP_FAILED',
      `Falha no backup: ${backupPath}`,
      {
        backupPath,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    );
  }

  // ===== SISTEMA DE SUBSCRIBERS =====

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    
    this.subscribers.get(eventType).push(callback);
    this.logger.info(`Subscriber adicionado para evento: ${eventType}`);
  }

  unsubscribe(eventType, callback) {
    if (this.subscribers.has(eventType)) {
      const callbacks = this.subscribers.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        this.logger.info(`Subscriber removido para evento: ${eventType}`);
      }
    }
  }

  async notifySubscribers(notification) {
    const eventType = notification.type;
    
    if (this.subscribers.has(eventType)) {
      const callbacks = this.subscribers.get(eventType);
      
      for (const callback of callbacks) {
        try {
          await callback(notification);
        } catch (error) {
          this.logger.error(`Erro ao notificar subscriber para ${eventType}:`, error);
        }
      }
    }

    // Notificar subscribers de eventos gerais
    if (this.subscribers.has('*')) {
      const callbacks = this.subscribers.get('*');
      
      for (const callback of callbacks) {
        try {
          await callback(notification);
        } catch (error) {
          this.logger.error('Erro ao notificar subscriber geral:', error);
        }
      }
    }
  }

  // ===== GESTÃO DE NOTIFICAÇÕES =====

  getNotifications(filter = {}) {
    let filteredNotifications = [...this.notifications];

    if (filter.type) {
      filteredNotifications = filteredNotifications.filter(n => n.type === filter.type);
    }

    if (filter.read !== undefined) {
      filteredNotifications = filteredNotifications.filter(n => n.read === filter.read);
    }

    if (filter.since) {
      const sinceDate = new Date(filter.since);
      filteredNotifications = filteredNotifications.filter(n => 
        new Date(n.timestamp) >= sinceDate
      );
    }

    if (filter.limit) {
      filteredNotifications = filteredNotifications.slice(-filter.limit);
    }

    return filteredNotifications.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.logger.info(`Notificação marcada como lida: ${notificationId}`);
      return true;
    }
    return false;
  }

  markAllAsRead() {
    const unreadCount = this.notifications.filter(n => !n.read).length;
    this.notifications.forEach(n => n.read = true);
    this.logger.info(`${unreadCount} notificações marcadas como lidas`);
    return unreadCount;
  }

  deleteNotification(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index > -1) {
      this.notifications.splice(index, 1);
      this.logger.info(`Notificação removida: ${notificationId}`);
      return true;
    }
    return false;
  }

  clearOldNotifications(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const initialCount = this.notifications.length;
    this.notifications = this.notifications.filter(n => 
      new Date(n.timestamp) > cutoffDate
    );

    const removedCount = initialCount - this.notifications.length;
    this.logger.info(`${removedCount} notificações antigas removidas`);
    return removedCount;
  }

  // ===== ESTATÍSTICAS =====

  getNotificationStats() {
    const stats = {
      total: this.notifications.length,
      unread: this.notifications.filter(n => !n.read).length,
      byType: {},
      byCategory: {},
      bySeverity: {},
      recent: this.notifications.filter(n => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return new Date(n.timestamp) > dayAgo;
      }).length
    };

    this.notifications.forEach(notification => {
      // Por tipo
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;

      // Por categoria
      const category = notification.details.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Por severidade
      const severity = notification.details.severity || 'info';
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
    });

    return stats;
  }

  // ===== MÉTODOS AUXILIARES =====

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getAlertSeverity(alertType) {
    const severityMap = {
      'CONNECTION_FAILED': 'high',
      'CONNECTION_RESTORED': 'info',
      'HIGH_DATABASE_USAGE': 'medium',
      'SLOW_QUERY': 'medium',
      'SUSPICIOUS_ACTIVITY': 'high',
      'FAILED_LOGIN': 'high',
      'SENSITIVE_TABLE_ACCESS': 'high',
      'SYSTEM_ERROR': 'high',
      'BACKUP_COMPLETED': 'info',
      'BACKUP_FAILED': 'high'
    };

    return severityMap[alertType] || 'info';
  }

  sanitizeQuery(query) {
    if (!query) return '';
    
    // Limitar tamanho e remover informações sensíveis
    let sanitized = query.substring(0, 200);
    sanitized = sanitized.replace(/PASSWORD\s+['"][^'"]*['"]/gi, 'PASSWORD \'***\'');
    return sanitized;
  }

  logNotification(notification) {
    try {
      const logEntry = {
        timestamp: notification.timestamp,
        type: notification.type,
        message: notification.message,
        details: notification.details
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.notificationLogPath, logLine);
    } catch (error) {
      this.logger.error('Erro ao registrar notificação no log:', error);
    }
  }

  // ===== EXPORTAÇÃO E IMPORTAÇÃO =====

  exportNotifications(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.notifications, null, 2);
    } else if (format === 'csv') {
      return this.exportToCSV();
    } else {
      throw new Error('Formato não suportado. Use "json" ou "csv"');
    }
  }

  exportToCSV() {
    if (this.notifications.length === 0) {
      return 'id,type,message,timestamp,read,category,severity\n';
    }

    const headers = ['id', 'type', 'message', 'timestamp', 'read', 'category', 'severity'];
    const rows = this.notifications.map(notification => [
      notification.id,
      notification.type,
      `"${notification.message.replace(/"/g, '""')}"`,
      notification.timestamp,
      notification.read,
      notification.details.category || '',
      notification.details.severity || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  importNotifications(data, format = 'json') {
    try {
      let importedNotifications;

      if (format === 'json') {
        importedNotifications = JSON.parse(data);
      } else if (format === 'csv') {
        importedNotifications = this.importFromCSV(data);
      } else {
        throw new Error('Formato não suportado. Use "json" ou "csv"');
      }

      if (!Array.isArray(importedNotifications)) {
        throw new Error('Dados importados devem ser um array de notificações');
      }

      // Validar e adicionar notificações
      let addedCount = 0;
      importedNotifications.forEach(notification => {
        if (this.validateNotification(notification)) {
          // Gerar novo ID para evitar conflitos
          notification.id = this.generateNotificationId();
          this.notifications.push(notification);
          addedCount++;
        }
      });

      this.logger.info(`${addedCount} notificações importadas com sucesso`);
      return addedCount;
    } catch (error) {
      this.logger.error('Erro ao importar notificações:', error);
      throw error;
    }
  }

  importFromCSV(csvData) {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    const notifications = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const notification = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        const cleanValue = value.replace(/^"|"$/g, '').replace(/""/g, '"');
        
        switch (header) {
        case 'id':
          notification.id = cleanValue;
          break;
        case 'type':
          notification.type = cleanValue;
          break;
        case 'message':
          notification.message = cleanValue;
          break;
        case 'timestamp':
          notification.timestamp = cleanValue;
          break;
        case 'read':
          notification.read = cleanValue === 'true';
          break;
        default:
          if (!notification.details) {
            notification.details = {};
          }
          notification.details[header] = cleanValue;
        }
      });

      notifications.push(notification);
    }

    return notifications;
  }

  validateNotification(notification) {
    const requiredFields = ['type', 'message', 'timestamp'];
    
    for (const field of requiredFields) {
      if (!notification[field]) {
        this.logger.warn(`Notificação inválida: campo ${field} ausente`);
        return false;
      }
    }

    return true;
  }
}
