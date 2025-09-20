# Firebird MCP Server

**Servidor MCP (Model Context Protocol) para Firebird Database**

Desenvolvido pela **CSGD** (Coordenadoria de Software e Gestão de Dados) da **AGTIC** (Agência de Tecnologia da Informação e Comunicação) da **UFPR** (Universidade Federal do Paraná).

Este servidor oferece operações completas DDL, DML, DCL, monitoramento e auditoria para bancos de dados Firebird através do protocolo MCP.

## 🚀 Características

- **Operações DDL**: Criação, alteração e remoção de tabelas, índices, generators, triggers, procedures, functions, views e domains
- **Operações DML**: SELECT, INSERT, UPDATE, DELETE com suporte a transações
- **Operações DCL**: Gerenciamento de usuários, privilégios e roles
- **Monitoramento**: Saúde do banco, performance, conexões ativas
- **Auditoria**: Log de operações, detecção de atividades suspeitas
- **Segurança**: Validação de queries, controle de acesso, criptografia
- **Múltiplas Conexões**: Suporte a vários bancos Firebird
- **Backup/Restore**: Operações de backup e restauração
- **CLI**: Interface de linha de comando para administração

## 📋 Pré-requisitos

- Node.js 18.0.0 ou superior
- Firebird Database 3.0 ou superior
- Cliente Firebird instalado

## 🛠️ Instalação

1. **Clone o repositório:**
```bash
git clone https://gitlab.ufpr.br/mcp/firebird_mcp_server.git
cd firebird_mcp_server
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure o ambiente:**
```bash
npm run setup
```

4. **Configure as variáveis de ambiente:**
```bash
cp env.example .env
# Edite o arquivo .env com suas configurações
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` com as seguintes variáveis:

```env
# Configuração da conexão principal
FIREBIRD_HOST=localhost
FIREBIRD_PORT=3050
FIREBIRD_DATABASE=/path/to/your/database.fdb
FIREBIRD_USER=SYSDBA
FIREBIRD_PASSWORD=masterkey
FIREBIRD_ROLE=RDB$ADMIN
FIREBIRD_CHARSET=UTF8

# Configuração do servidor MCP
MCP_SERVER_NAME=firebird-monitor
MCP_SERVER_VERSION=1.0.0

# Configuração de logging
LOG_LEVEL=info
```

### Múltiplas Conexões

Configure múltiplas conexões no arquivo `config/multi-connections.json`:

```json
{
  "connections": [
    {
      "name": "default",
      "description": "Conexão padrão",
      "environment": "development",
      "host": "localhost",
      "port": 3050,
      "database": "/path/to/database.fdb",
      "user": "SYSDBA",
      "password": "masterkey",
      "role": "RDB$ADMIN",
      "charset": "UTF8"
    }
  ]
}
```

## 🚀 Uso

### Iniciar o Servidor MCP

```bash
npm start
```

### CLI (Interface de Linha de Comando)

```bash
# Testar conexão
npm run test-connection

# Verificar saúde do banco
npx firebird-mcp health-check

# Listar tabelas
npx firebird-mcp list-tables

# Executar query
npx firebird-mcp query --query "SELECT * FROM USERS"

# Backup do banco
npx firebird-mcp backup --path ./backup.fbk

# Validar banco
npx firebird-mcp validate
```

## 🔧 Ferramentas Disponíveis

### Monitoramento

- `check_database_health` - Verifica a saúde geral do banco
- `get_database_info` - Obtém informações gerais do banco
- `get_table_info` - Informações detalhadas de tabelas
- `get_generators` - Lista generators (equivalente a sequences)
- `get_domains` - Lista domains (tipos customizados)
- `get_procedures` - Lista stored procedures
- `get_functions` - Lista funções
- `get_triggers` - Lista triggers
- `get_views` - Lista views

### Operações DDL

- `create_table` - Criar tabelas
- `alter_table` - Alterar tabelas
- `drop_table` - Remover tabelas
- `create_index` - Criar índices
- `create_generator` - Criar generators
- `create_trigger` - Criar triggers
- `create_procedure` - Criar stored procedures
- `create_function` - Criar funções
- `create_view` - Criar views
- `create_domain` - Criar domains

### Operações DML

- `select_data` - Consultas SELECT
- `insert_data` - Inserir dados
- `update_data` - Atualizar dados
- `delete_data` - Remover dados
- `execute_procedure` - Executar stored procedures
- `execute_function` - Executar funções

### Operações DCL

- `create_user` - Criar usuários
- `alter_user` - Alterar usuários
- `drop_user` - Remover usuários
- `grant_privileges` - Conceder privilégios
- `revoke_privileges` - Revogar privilégios
- `create_role` - Criar roles
- `grant_role` - Conceder roles

### Backup e Restore

- `backup_database` - Realizar backup
- `restore_database` - Restaurar banco
- `validate_database` - Validar integridade

### Auditoria e Segurança

- `generate_audit_report` - Relatórios de auditoria
- `detect_suspicious_activity` - Detectar atividades suspeitas
- `validate_migration_script` - Validar scripts de migração

## 📊 Exemplos de Uso

### Criar uma Tabela

```javascript
// Via MCP
{
  "name": "create_table",
  "arguments": {
    "tableName": "USERS",
    "columns": [
      {
        "name": "ID",
        "type": "INTEGER",
        "notNull": true
      },
      {
        "name": "NAME",
        "type": "VARCHAR",
        "length": 100,
        "notNull": true
      },
      {
        "name": "EMAIL",
        "type": "VARCHAR",
        "length": 255,
        "notNull": true
      }
    ],
    "constraints": [
      {
        "name": "PK_USERS",
        "type": "PRIMARY KEY",
        "columns": ["ID"]
      }
    ]
  }
}
```

### Inserir Dados

```javascript
// Via MCP
{
  "name": "insert_data",
  "arguments": {
    "tableName": "USERS",
    "data": {
      "ID": 1,
      "NAME": "João Silva",
      "EMAIL": "joao@example.com"
    }
  }
}
```

### Consultar Dados

```javascript
// Via MCP
{
  "name": "select_data",
  "arguments": {
    "tableName": "USERS",
    "columns": ["ID", "NAME", "EMAIL"],
    "whereClause": "ID = 1",
    "limit": 10
  }
}
```

## 🔒 Segurança

O servidor implementa várias medidas de segurança:

- **Validação de Queries**: Apenas operações SELECT são permitidas em queries customizadas
- **Auditoria**: Todas as operações são logadas
- **Controle de Acesso**: Validação de usuários e privilégios
- **Detecção de Atividades Suspeitas**: Monitoramento de padrões anômalos
- **Criptografia**: Senhas e dados sensíveis são protegidos

## 📝 Logs

Os logs são armazenados no diretório `logs/`:

- `firebird-mcp.log` - Log geral
- `error.log` - Log de erros
- `audit.log` - Log de auditoria
- `notifications.log` - Log de notificações

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes unitários
npm run test:unit

# Testes de integração
npm run test:integration

# Testes de segurança
npm run test:security

# Testes de performance
npm run test:performance
```

## 📚 Documentação

- [Guia de Configuração](documentation/pt/guides/MCP-CONFIGURATION-GUIDE.md)
- [Guia de Início Rápido](documentation/pt/guides/QUICKSTART.md)
- [Múltiplas Conexões](documentation/pt/guides/MULTIPLE-CONNECTIONS.md)
- [Solução de Problemas](documentation/pt/guides/TROUBLESHOOTING-ORACLE-CONNECTIVITY.md)

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

- **Issues**: [GitLab Issues](https://gitlab.ufpr.br/mcp/firebird_mcp_server/-/issues)
- **Documentação**: [Wiki do Projeto](https://gitlab.ufpr.br/mcp/firebird_mcp_server/-/wikis/home)
- **Contato**: CSGD/AGTIC/UFPR

## 🙏 Agradecimentos

- [Firebird Database](https://firebirdsql.org/) - Banco de dados relacional
- [node-firebird](https://github.com/hgourvest/node-firebird) - Driver Node.js para Firebird
- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocolo MCP

## 📈 Roadmap

- [ ] Suporte a Firebird 4.0
- [ ] Interface web para administração
- [ ] Métricas em tempo real
- [ ] Suporte a clusters
- [ ] Integração com sistemas de monitoramento
- [ ] API REST adicional

---

**Desenvolvido com ❤️ pela [CSGD/AGTIC/UFPR](https://gitlab.ufpr.br/mcp)**
