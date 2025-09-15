import { Logger } from './logger.js';
import fs from 'fs';
import path from 'path';

export class SecurityAudit {
  constructor() {
    this.logger = new Logger();
    this.auditLogPath = './logs/audit.log';
    this.securityConfig = this.loadSecurityConfig();
    this.initializeAuditLog();
  }

  loadSecurityConfig() {
    try {
      const configPath = './config/security-config.json';
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      this.logger.warn('Erro ao carregar configuração de segurança, usando padrões:', error.message);
    }

    // Configuração padrão
    return {
      sensitiveTables: ['USERS', 'PASSWORDS', 'CREDENTIALS', 'TOKENS'],
      maxFailedAttempts: 5,
      lockoutDuration: 300000, // 5 minutos
      auditRetentionDays: 90,
      alertOnSuspiciousActivity: true,
      allowedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      restrictedOperations: ['DROP', 'ALTER', 'CREATE', 'GRANT', 'REVOKE']
    };
  }

  initializeAuditLog() {
    try {
      const logDir = path.dirname(this.auditLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Criar arquivo de log se não existir
      if (!fs.existsSync(this.auditLogPath)) {
        fs.writeFileSync(this.auditLogPath, '');
      }
    } catch (error) {
      this.logger.error('Erro ao inicializar log de auditoria:', error);
    }
  }

  // ===== VALIDAÇÕES DE SEGURANÇA =====

  validateTableName(tableName) {
    if (!tableName || typeof tableName !== 'string') {
      throw new Error('Nome da tabela deve ser uma string válida');
    }

    // Verificar se é uma tabela sensível
    if (this.securityConfig.sensitiveTables.includes(tableName.toUpperCase())) {
      this.logSecurityEvent('SENSITIVE_TABLE_ACCESS', 'unknown', {
        table: tableName,
        message: 'Tentativa de acesso a tabela sensível'
      });
    }

    // Validar caracteres permitidos
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
      throw new Error('Nome da tabela contém caracteres inválidos');
    }
  }

  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      throw new Error('Nome de usuário deve ser uma string válida');
    }

    if (username.length < 3 || username.length > 31) {
      throw new Error('Nome de usuário deve ter entre 3 e 31 caracteres');
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(username)) {
      throw new Error('Nome de usuário contém caracteres inválidos');
    }
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Senha deve ser uma string válida');
    }

    if (password.length < 8) {
      throw new Error('Senha deve ter pelo menos 8 caracteres');
    }

    // Verificar complexidade da senha
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      this.logSecurityEvent('WEAK_PASSWORD', 'unknown', {
        message: 'Senha não atende aos critérios de complexidade'
      });
    }
  }

  validateWhereClause(whereClause) {
    if (!whereClause || typeof whereClause !== 'string') {
      throw new Error('Condição WHERE deve ser uma string válida');
    }

    // Verificar se contém comandos perigosos
    const dangerousKeywords = this.securityConfig.restrictedOperations;
    const upperWhere = whereClause.toUpperCase();

    for (const keyword of dangerousKeywords) {
      if (upperWhere.includes(keyword)) {
        this.logSecurityEvent('DANGEROUS_QUERY', 'unknown', {
          query: whereClause,
          keyword: keyword,
          message: 'Query contém palavra-chave perigosa'
        });
        throw new Error(`Condição WHERE contém palavra-chave perigosa: ${keyword}`);
      }
    }
  }

  validatePrivileges(privileges) {
    if (!privileges || !Array.isArray(privileges) || privileges.length === 0) {
      throw new Error('Lista de privilégios deve ser um array não vazio');
    }

    const allowedPrivileges = this.securityConfig.allowedOperations;
    const restrictedPrivileges = this.securityConfig.restrictedOperations;

    for (const privilege of privileges) {
      const upperPrivilege = privilege.toUpperCase();

      if (restrictedPrivileges.includes(upperPrivilege)) {
        this.logSecurityEvent('RESTRICTED_PRIVILEGE', 'unknown', {
          privilege: privilege,
          message: 'Tentativa de usar privilégio restrito'
        });
        throw new Error(`Privilégio restrito: ${privilege}`);
      }

      if (!allowedPrivileges.includes(upperPrivilege)) {
        this.logSecurityEvent('UNKNOWN_PRIVILEGE', 'unknown', {
          privilege: privilege,
          message: 'Privilégio desconhecido'
        });
        throw new Error(`Privilégio desconhecido: ${privilege}`);
      }
    }
  }

  // ===== LOGGING DE AUDITORIA =====

  async logOperation(operationData) {
    const {
      user,
      operation,
      resource,
      query,
      result,
      timestamp = new Date().toISOString()
    } = operationData;

    const auditEntry = {
      timestamp,
      user,
      operation,
      resource,
      query: this.sanitizeQuery(query),
      success: result.success,
      message: result.message,
      ip: this.getClientIP(),
      userAgent: this.getUserAgent()
    };

    try {
      // Escrever no arquivo de auditoria
      const logLine = JSON.stringify(auditEntry) + '\n';
      fs.appendFileSync(this.auditLogPath, logLine);

      // Log no sistema de logging
      if (result.success) {
        this.logger.info(`Operação auditada: ${operation}`, auditEntry);
      } else {
        this.logger.warn(`Operação auditada (falha): ${operation}`, auditEntry);
      }

      // Verificar atividades suspeitas
      await this.checkSuspiciousActivity(auditEntry);

    } catch (error) {
      this.logger.error('Erro ao registrar operação de auditoria:', error);
    }
  }

  sanitizeQuery(query) {
    if (!query) return '';
    
    // Remover informações sensíveis como senhas
    return query.replace(/PASSWORD\s+['"][^'"]*['"]/gi, 'PASSWORD \'***\'');
  }

  getClientIP() {
    // Em um ambiente real, isso viria do request
    return process.env.CLIENT_IP || '127.0.0.1';
  }

  getUserAgent() {
    // Em um ambiente real, isso viria do request
    return process.env.USER_AGENT || 'Firebird-MCP-Server';
  }

  // ===== DETECÇÃO DE ATIVIDADES SUSPEITAS =====

  async checkSuspiciousActivity(auditEntry) {
    const suspiciousActivities = [];

    // Verificar múltiplas falhas de autenticação
    if (!auditEntry.success && auditEntry.operation.includes('LOGIN')) {
      const failedAttempts = await this.getRecentFailedAttempts(auditEntry.user, 5);
      if (failedAttempts >= this.securityConfig.maxFailedAttempts) {
        suspiciousActivities.push({
          type: 'MULTIPLE_FAILED_LOGINS',
          message: `Múltiplas tentativas de login falhadas para usuário ${auditEntry.user}`,
          severity: 'HIGH'
        });
      }
    }

    // Verificar acesso a tabelas sensíveis
    if (this.securityConfig.sensitiveTables.some(table => 
      auditEntry.resource && auditEntry.resource.toUpperCase().includes(table))) {
      suspiciousActivities.push({
        type: 'SENSITIVE_TABLE_ACCESS',
        message: `Acesso a tabela sensível: ${auditEntry.resource}`,
        severity: 'MEDIUM'
      });
    }

    // Verificar operações em horário não usual
    const hour = new Date(auditEntry.timestamp).getHours();
    if (hour < 6 || hour > 22) {
      suspiciousActivities.push({
        type: 'UNUSUAL_TIME_ACCESS',
        message: `Acesso em horário não usual: ${auditEntry.timestamp}`,
        severity: 'LOW'
      });
    }

    // Verificar múltiplas operações em sequência
    const recentOperations = await this.getRecentOperations(auditEntry.user, 10);
    if (recentOperations.length > 50) {
      suspiciousActivities.push({
        type: 'HIGH_FREQUENCY_OPERATIONS',
        message: `Alto volume de operações para usuário ${auditEntry.user}`,
        severity: 'MEDIUM'
      });
    }

    // Log de atividades suspeitas
    for (const activity of suspiciousActivities) {
      this.logSecurityEvent(activity.type, auditEntry.user, {
        message: activity.message,
        severity: activity.severity,
        auditEntry
      });
    }
  }

  async getRecentFailedAttempts(user, minutes = 5) {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
      const logData = fs.readFileSync(this.auditLogPath, 'utf8');
      const lines = logData.trim().split('\n');

      let failedAttempts = 0;
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.user === user && 
              entry.operation.includes('LOGIN') && 
              !entry.success && 
              entry.timestamp > cutoffTime) {
            failedAttempts++;
          }
        } catch (e) {
          // Ignorar linhas malformadas
        }
      }

      return failedAttempts;
    } catch (error) {
      this.logger.error('Erro ao verificar tentativas falhadas:', error);
      return 0;
    }
  }

  async getRecentOperations(user, minutes = 10) {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
      const logData = fs.readFileSync(this.auditLogPath, 'utf8');
      const lines = logData.trim().split('\n');

      const operations = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.user === user && entry.timestamp > cutoffTime) {
            operations.push(entry);
          }
        } catch (e) {
          // Ignorar linhas malformadas
        }
      }

      return operations;
    } catch (error) {
      this.logger.error('Erro ao obter operações recentes:', error);
      return [];
    }
  }

  // ===== RELATÓRIOS DE AUDITORIA =====

  async generateAuditReport(options = {}) {
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
      user,
      operation,
      success
    } = options;

    try {
      const logData = fs.readFileSync(this.auditLogPath, 'utf8');
      const lines = logData.trim().split('\n');

      let filteredEntries = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          // Aplicar filtros
          if (entry.timestamp < startDate || entry.timestamp > endDate) continue;
          if (user && entry.user !== user) continue;
          if (operation && entry.operation !== operation) continue;
          if (success !== undefined && entry.success !== success) continue;

          filteredEntries.push(entry);
        } catch (e) {
          // Ignorar linhas malformadas
        }
      }

      return this.formatAuditReport(filteredEntries, options);
    } catch (error) {
      this.logger.error('Erro ao gerar relatório de auditoria:', error);
      throw new Error(`Erro ao gerar relatório: ${error.message}`);
    }
  }

  formatAuditReport(entries, options) {
    let report = `## Relatório de Auditoria\n\n`;
    report += `**Período:** ${options.startDate} até ${options.endDate}\n`;
    report += `**Total de operações:** ${entries.length}\n\n`;

    if (entries.length === 0) {
      report += 'Nenhuma operação encontrada no período especificado.';
      return report;
    }

    // Estatísticas por usuário
    const userStats = {};
    const operationStats = {};
    let successCount = 0;

    entries.forEach(entry => {
      // Estatísticas por usuário
      if (!userStats[entry.user]) {
        userStats[entry.user] = { total: 0, success: 0, failed: 0 };
      }
      userStats[entry.user].total++;
      if (entry.success) {
        userStats[entry.user].success++;
        successCount++;
      } else {
        userStats[entry.user].failed++;
      }

      // Estatísticas por operação
      if (!operationStats[entry.operation]) {
        operationStats[entry.operation] = 0;
      }
      operationStats[entry.operation]++;
    });

    // Resumo
    report += `### Resumo\n`;
    report += `- **Operações bem-sucedidas:** ${successCount}\n`;
    report += `- **Operações falhadas:** ${entries.length - successCount}\n`;
    report += `- **Taxa de sucesso:** ${((successCount / entries.length) * 100).toFixed(2)}%\n\n`;

    // Top usuários
    report += `### Top Usuários\n`;
    report += `| Usuário | Total | Sucessos | Falhas | Taxa Sucesso |\n`;
    report += `|---------|-------|----------|--------|-------------|\n`;
    
    Object.entries(userStats)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 10)
      .forEach(([user, stats]) => {
        const successRate = ((stats.success / stats.total) * 100).toFixed(2);
        report += `| ${user} | ${stats.total} | ${stats.success} | ${stats.failed} | ${successRate}% |\n`;
      });

    report += `\n### Top Operações\n`;
    report += `| Operação | Quantidade |\n`;
    report += `|----------|------------|\n`;
    
    Object.entries(operationStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([operation, count]) => {
        report += `| ${operation} | ${count} |\n`;
      });

    // Operações recentes
    report += `\n### Operações Recentes\n`;
    report += `| Timestamp | Usuário | Operação | Recurso | Sucesso |\n`;
    report += `|-----------|---------|----------|---------|----------|\n`;
    
    entries
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20)
      .forEach(entry => {
        const success = entry.success ? '✅' : '❌';
        report += `| ${entry.timestamp} | ${entry.user} | ${entry.operation} | ${entry.resource || 'N/A'} | ${success} |\n`;
      });

    return report;
  }

  async detectSuspiciousActivity() {
    try {
      const logData = fs.readFileSync(this.auditLogPath, 'utf8');
      const lines = logData.trim().split('\n');
      const suspiciousActivities = [];

      // Analisar últimas 24 horas
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentEntries = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.timestamp > cutoffTime) {
            recentEntries.push(entry);
          }
        } catch (e) {
          // Ignorar linhas malformadas
        }
      }

      // Detectar padrões suspeitos
      const userActivity = {};
      const ipActivity = {};

      recentEntries.forEach(entry => {
        // Agrupar por usuário
        if (!userActivity[entry.user]) {
          userActivity[entry.user] = [];
        }
        userActivity[entry.user].push(entry);

        // Agrupar por IP
        if (!ipActivity[entry.ip]) {
          ipActivity[entry.ip] = [];
        }
        ipActivity[entry.ip].push(entry);
      });

      // Verificar atividades suspeitas por usuário
      Object.entries(userActivity).forEach(([user, activities]) => {
        if (activities.length > 100) {
          suspiciousActivities.push({
            type: 'HIGH_FREQUENCY_USER',
            message: `Usuário ${user} executou ${activities.length} operações em 24h`,
            severity: 'MEDIUM'
          });
        }

        const failedLogins = activities.filter(a => !a.success && a.operation.includes('LOGIN'));
        if (failedLogins.length > 10) {
          suspiciousActivities.push({
            type: 'MULTIPLE_FAILED_LOGINS',
            message: `Usuário ${user} teve ${failedLogins.length} tentativas de login falhadas`,
            severity: 'HIGH'
          });
        }
      });

      // Verificar atividades suspeitas por IP
      Object.entries(ipActivity).forEach(([ip, activities]) => {
        if (activities.length > 200) {
          suspiciousActivities.push({
            type: 'HIGH_FREQUENCY_IP',
            message: `IP ${ip} executou ${activities.length} operações em 24h`,
            severity: 'MEDIUM'
          });
        }
      });

      return suspiciousActivities;
    } catch (error) {
      this.logger.error('Erro ao detectar atividades suspeitas:', error);
      return [];
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  logSecurityEvent(event, user, details = {}) {
    const securityEntry = {
      timestamp: new Date().toISOString(),
      event,
      user,
      ...details
    };

    this.logger.warn(`Evento de segurança: ${event}`, securityEntry);

    // Escrever no arquivo de auditoria
    try {
      const logLine = JSON.stringify(securityEntry) + '\n';
      fs.appendFileSync(this.auditLogPath, logLine);
    } catch (error) {
      this.logger.error('Erro ao registrar evento de segurança:', error);
    }
  }

  async cleanOldAuditLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.securityConfig.auditRetentionDays);

      const logData = fs.readFileSync(this.auditLogPath, 'utf8');
      const lines = logData.trim().split('\n');

      const filteredLines = lines.filter(line => {
        try {
          const entry = JSON.parse(line);
          return new Date(entry.timestamp) > cutoffDate;
        } catch (e) {
          return true; // Manter linhas malformadas
        }
      });

      fs.writeFileSync(this.auditLogPath, filteredLines.join('\n') + '\n');
      this.logger.info(`Logs de auditoria antigos removidos. Mantidos ${filteredLines.length} de ${lines.length} entradas.`);
    } catch (error) {
      this.logger.error('Erro ao limpar logs de auditoria antigos:', error);
    }
  }

  getAuditLogStats() {
    try {
      const logData = fs.readFileSync(this.auditLogPath, 'utf8');
      const lines = logData.trim().split('\n');

      let totalEntries = 0;
      let successEntries = 0;
      let failedEntries = 0;
      const userCounts = {};
      const operationCounts = {};

      lines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          totalEntries++;
          
          if (entry.success) {
            successEntries++;
          } else {
            failedEntries++;
          }

          if (entry.user) {
            userCounts[entry.user] = (userCounts[entry.user] || 0) + 1;
          }

          if (entry.operation) {
            operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;
          }
        } catch (e) {
          // Ignorar linhas malformadas
        }
      });

      return {
        totalEntries,
        successEntries,
        failedEntries,
        uniqueUsers: Object.keys(userCounts).length,
        uniqueOperations: Object.keys(operationCounts).length,
        topUsers: Object.entries(userCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5),
        topOperations: Object.entries(operationCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
      };
    } catch (error) {
      this.logger.error('Erro ao obter estatísticas de auditoria:', error);
      return null;
    }
  }
}
