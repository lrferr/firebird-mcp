import { Logger } from './logger.js';

export class MigrationValidator {
  constructor() {
    this.logger = new Logger();
  }

  validateScript(script, targetSchema) {
    try {
      this.logger.info(`Validando script de migração para schema: ${targetSchema}`);

      const validationResults = {
        isValid: true,
        warnings: [],
        errors: [],
        suggestions: []
      };

      // Validar estrutura básica
      this.validateBasicStructure(script, validationResults);

      // Validar sintaxe SQL
      this.validateSQLSyntax(script, validationResults);

      // Validar operações perigosas
      this.validateDangerousOperations(script, validationResults);

      // Validar compatibilidade com Firebird
      this.validateFirebirdCompatibility(script, validationResults);

      // Sugerir melhorias
      this.suggestImprovements(script, validationResults);

      // Determinar se é válido
      validationResults.isValid = validationResults.errors.length === 0;

      return this.formatValidationResult(validationResults);
    } catch (error) {
      this.logger.error('Erro ao validar script de migração:', error);
      return `Erro na validação: ${error.message}`;
    }
  }

  validateBasicStructure(script, results) {
    if (!script || typeof script !== 'string') {
      results.errors.push('Script deve ser uma string não vazia');
      return;
    }

    if (script.trim().length === 0) {
      results.errors.push('Script não pode estar vazio');
      return;
    }

    // Verificar se contém pelo menos uma operação SQL
    const sqlKeywords = ['CREATE', 'ALTER', 'DROP', 'INSERT', 'UPDATE', 'DELETE', 'SELECT'];
    const hasSQLOperation = sqlKeywords.some(keyword => 
      script.toUpperCase().includes(keyword)
    );

    if (!hasSQLOperation) {
      results.warnings.push('Script não parece conter operações SQL válidas');
    }

    // Verificar se tem comentários explicativos
    const hasComments = script.includes('--') || script.includes('/*');
    if (!hasComments) {
      results.suggestions.push('Considere adicionar comentários explicativos ao script');
    }
  }

  validateSQLSyntax(script, results) {
    const lines = script.split('\n');
    let inComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Pular linhas vazias e comentários
      if (!line || line.startsWith('--')) continue;

      // Verificar comentários de bloco
      if (line.includes('/*')) {
        inComment = true;
      }
      if (line.includes('*/')) {
        inComment = false;
        continue;
      }
      if (inComment) continue;

      // Verificar strings
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (!inString && (char === "'" || char === '"')) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      // Verificar sintaxe básica
      this.checkLineSyntax(line, lineNumber, results);
    }

    // Verificar se todas as strings foram fechadas
    if (inString) {
      results.errors.push('String não foi fechada corretamente');
    }

    if (inComment) {
      results.warnings.push('Comentário de bloco não foi fechado');
    }
  }

  checkLineSyntax(line, lineNumber, results) {
    // Verificar ponto e vírgula no final de statements
    if (line.match(/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT)/i) && 
        !line.endsWith(';') && !line.endsWith(';')) {
      results.warnings.push(`Linha ${lineNumber}: Considere adicionar ponto e vírgula no final do statement`);
    }

    // Verificar parênteses balanceados
    const openParens = (line.match(/\(/g) || []).length;
    const closeParens = (line.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      results.warnings.push(`Linha ${lineNumber}: Parênteses podem não estar balanceados`);
    }

    // Verificar aspas balanceadas
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      results.warnings.push(`Linha ${lineNumber}: Aspas simples podem não estar balanceadas`);
    }
    if (doubleQuotes % 2 !== 0) {
      results.warnings.push(`Linha ${lineNumber}: Aspas duplas podem não estar balanceadas`);
    }
  }

  validateDangerousOperations(script, results) {
    const dangerousPatterns = [
      {
        pattern: /DROP\s+TABLE/i,
        message: 'Operação DROP TABLE detectada - certifique-se de que é necessária',
        severity: 'warning'
      },
      {
        pattern: /DROP\s+DATABASE/i,
        message: 'Operação DROP DATABASE detectada - EXTREMAMENTE PERIGOSA',
        severity: 'error'
      },
      {
        pattern: /DELETE\s+FROM\s+\w+\s*(?!WHERE)/i,
        message: 'DELETE sem WHERE detectado - pode remover todos os registros',
        severity: 'error'
      },
      {
        pattern: /UPDATE\s+\w+\s+SET\s+(?!WHERE)/i,
        message: 'UPDATE sem WHERE detectado - pode atualizar todos os registros',
        severity: 'warning'
      },
      {
        pattern: /TRUNCATE/i,
        message: 'Operação TRUNCATE detectada - remove todos os dados da tabela',
        severity: 'warning'
      }
    ];

    dangerousPatterns.forEach(({ pattern, message, severity }) => {
      if (pattern.test(script)) {
        if (severity === 'error') {
          results.errors.push(message);
        } else {
          results.warnings.push(message);
        }
      }
    });
  }

  validateFirebirdCompatibility(script, results) {
    const firebirdSpecificPatterns = [
      {
        pattern: /AUTO_INCREMENT/i,
        message: 'Firebird usa GENERATORS em vez de AUTO_INCREMENT',
        suggestion: 'Use CREATE GENERATOR e triggers para auto-incremento'
      },
      {
        pattern: /LIMIT\s+\d+/i,
        message: 'Firebird usa ROWS em vez de LIMIT',
        suggestion: 'Use ROWS 1 TO n em vez de LIMIT n'
      },
      {
        pattern: /IF\s+EXISTS/i,
        message: 'Firebird não suporta IF EXISTS em todas as operações',
        suggestion: 'Verifique a compatibilidade com sua versão do Firebird'
      },
      {
        pattern: /SEQUENCE/i,
        message: 'Firebird usa GENERATORS em vez de SEQUENCES',
        suggestion: 'Use CREATE GENERATOR em vez de CREATE SEQUENCE'
      }
    ];

    firebirdSpecificPatterns.forEach(({ pattern, message, suggestion }) => {
      if (pattern.test(script)) {
        results.warnings.push(message);
        results.suggestions.push(suggestion);
      }
    });

    // Verificar tipos de dados específicos do Firebird
    const firebirdTypes = [
      'BLOB', 'CHAR', 'VARCHAR', 'SMALLINT', 'INTEGER', 'BIGINT',
      'FLOAT', 'DOUBLE PRECISION', 'DECIMAL', 'NUMERIC', 'DATE',
      'TIME', 'TIMESTAMP', 'BOOLEAN'
    ];

    const usedTypes = [];
    firebirdTypes.forEach(type => {
      if (new RegExp(`\\b${type}\\b`, 'i').test(script)) {
        usedTypes.push(type);
      }
    });

    if (usedTypes.length > 0) {
      results.suggestions.push(`Tipos de dados Firebird detectados: ${usedTypes.join(', ')}`);
    }
  }

  suggestImprovements(script, results) {
    // Sugerir uso de transações
    if (!script.toUpperCase().includes('BEGIN') && 
        !script.toUpperCase().includes('COMMIT') &&
        !script.toUpperCase().includes('ROLLBACK')) {
      results.suggestions.push('Considere usar transações (BEGIN/COMMIT/ROLLBACK) para operações múltiplas');
    }

    // Sugerir backup antes de operações destrutivas
    const destructiveOps = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER'];
    const hasDestructiveOps = destructiveOps.some(op => 
      script.toUpperCase().includes(op)
    );

    if (hasDestructiveOps) {
      results.suggestions.push('Considere fazer backup do banco antes de executar operações destrutivas');
    }

    // Sugerir validação de dados
    if (script.toUpperCase().includes('INSERT') || script.toUpperCase().includes('UPDATE')) {
      results.suggestions.push('Considere adicionar validações de dados antes de INSERT/UPDATE');
    }

    // Sugerir índices para performance
    if (script.toUpperCase().includes('CREATE TABLE')) {
      results.suggestions.push('Considere criar índices apropriados para melhorar performance');
    }

    // Sugerir documentação
    if (!script.includes('--') && !script.includes('/*')) {
      results.suggestions.push('Adicione comentários explicando o propósito de cada operação');
    }
  }

  formatValidationResult(results) {
    let output = `## Validação do Script de Migração\n\n`;

    // Status geral
    if (results.isValid) {
      output += `✅ **Script válido** - Pode ser executado com segurança\n\n`;
    } else {
      output += `❌ **Script inválido** - Corrija os erros antes de executar\n\n`;
    }

    // Erros
    if (results.errors.length > 0) {
      output += `### ❌ Erros (${results.errors.length})\n\n`;
      results.errors.forEach((error, index) => {
        output += `${index + 1}. ${error}\n`;
      });
      output += '\n';
    }

    // Avisos
    if (results.warnings.length > 0) {
      output += `### ⚠️ Avisos (${results.warnings.length})\n\n`;
      results.warnings.forEach((warning, index) => {
        output += `${index + 1}. ${warning}\n`;
      });
      output += '\n';
    }

    // Sugestões
    if (results.suggestions.length > 0) {
      output += `### 💡 Sugestões (${results.suggestions.length})\n\n`;
      results.suggestions.forEach((suggestion, index) => {
        output += `${index + 1}. ${suggestion}\n`;
      });
      output += '\n';
    }

    // Resumo
    output += `### 📊 Resumo\n\n`;
    output += `- **Status:** ${results.isValid ? 'Válido' : 'Inválido'}\n`;
    output += `- **Erros:** ${results.errors.length}\n`;
    output += `- **Avisos:** ${results.warnings.length}\n`;
    output += `- **Sugestões:** ${results.suggestions.length}\n`;

    if (results.isValid) {
      output += `\n✅ **O script pode ser executado com segurança.**\n`;
    } else {
      output += `\n❌ **Corrija os erros antes de executar o script.**\n`;
    }

    return output;
  }

  // Método para validar scripts específicos do Firebird
  validateFirebirdScript(script, options = {}) {
    const {
      checkGenerators = true,
      checkTriggers = true,
      checkProcedures = true,
      checkDomains = true
    } = options;

    const results = {
      isValid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };

    // Validação básica
    this.validateBasicStructure(script, results);

    // Validações específicas do Firebird
    if (checkGenerators) {
      this.validateGenerators(script, results);
    }

    if (checkTriggers) {
      this.validateTriggers(script, results);
    }

    if (checkProcedures) {
      this.validateProcedures(script, results);
    }

    if (checkDomains) {
      this.validateDomains(script, results);
    }

    results.isValid = results.errors.length === 0;
    return this.formatValidationResult(results);
  }

  validateGenerators(script, results) {
    // Verificar se generators são criados corretamente
    const generatorPattern = /CREATE\s+GENERATOR\s+(\w+)/gi;
    const generators = script.match(generatorPattern);

    if (generators) {
      generators.forEach(generator => {
        const name = generator.match(/CREATE\s+GENERATOR\s+(\w+)/i)[1];
        
        // Verificar se há trigger correspondente
        const triggerPattern = new RegExp(`GEN_ID\\(${name}`, 'gi');
        if (!triggerPattern.test(script)) {
          results.suggestions.push(`Generator ${name} criado mas não há uso de GEN_ID() correspondente`);
        }
      });
    }
  }

  validateTriggers(script, results) {
    // Verificar sintaxe de triggers
    const triggerPattern = /CREATE\s+TRIGGER\s+(\w+)\s+FOR\s+(\w+)\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)/gi;
    const triggers = script.match(triggerPattern);

    if (triggers) {
      triggers.forEach(trigger => {
        const match = trigger.match(/CREATE\s+TRIGGER\s+(\w+)\s+FOR\s+(\w+)\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)/i);
        if (match) {
          const [, triggerName, tableName, timing, event] = match;
          
          // Verificar se o trigger tem código
          const triggerCodePattern = new RegExp(`CREATE\\s+TRIGGER\\s+${triggerName}[\\s\\S]*?AS\\s*([\\s\\S]*?)(?=CREATE|$)`, 'i');
          const codeMatch = script.match(triggerCodePattern);
          
          if (!codeMatch || !codeMatch[1].trim()) {
            results.warnings.push(`Trigger ${triggerName} não possui código`);
          }
        }
      });
    }
  }

  validateProcedures(script, results) {
    // Verificar sintaxe de stored procedures
    const procedurePattern = /CREATE\s+PROCEDURE\s+(\w+)/gi;
    const procedures = script.match(procedurePattern);

    if (procedures) {
      procedures.forEach(procedure => {
        const name = procedure.match(/CREATE\s+PROCEDURE\s+(\w+)/i)[1];
        
        // Verificar se tem parâmetros definidos
        const paramPattern = new RegExp(`CREATE\\s+PROCEDURE\\s+${name}\\s*\\(([^)]*)\\)`, 'i');
        const paramMatch = script.match(paramPattern);
        
        if (paramMatch && paramMatch[1].trim()) {
          results.suggestions.push(`Procedure ${name} tem parâmetros - verifique se estão sendo usados corretamente`);
        }
      });
    }
  }

  validateDomains(script, results) {
    // Verificar sintaxe de domains
    const domainPattern = /CREATE\s+DOMAIN\s+(\w+)\s+AS\s+(\w+)/gi;
    const domains = script.match(domainPattern);

    if (domains) {
      domains.forEach(domain => {
        const match = domain.match(/CREATE\s+DOMAIN\s+(\w+)\s+AS\s+(\w+)/i);
        if (match) {
          const [, domainName, domainType] = match;
          
          // Verificar se o domain é usado
          const usagePattern = new RegExp(`\\b${domainName}\\b`, 'gi');
          const usages = script.match(usagePattern);
          
          if (!usages || usages.length <= 1) {
            results.suggestions.push(`Domain ${domainName} criado mas não parece ser usado`);
          }
        }
      });
    }
  }
}
