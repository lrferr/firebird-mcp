# Configuração de Conexões Firebird

## ⚠️ IMPORTANTE - Dados Sensíveis

**NUNCA** commite arquivos com dados sensíveis (senhas, IPs de produção, etc.) para o repositório!

## Estrutura de Arquivos

### Arquivos Seguros (podem ser commitados)
- `multi-connections.json` - Template com dados de exemplo
- `connections-template.json` - Template completo para referência
- `README.md` - Esta documentação

### Arquivos Sensíveis (NÃO commitar)
- `local-connections.json` - Suas conexões locais com dados reais
- `production-connections.json` - Conexões de produção
- `*-sensitive.json` - Qualquer arquivo com dados sensíveis

## Como Configurar

### 1. Para Desenvolvimento Local
```bash
# Copie o template
cp config/connections-template.json config/local-connections.json

# Edite com seus dados reais
# NUNCA commite este arquivo!
```

### 2. Para Produção
```bash
# Crie arquivo específico para produção
cp config/connections-template.json config/production-connections.json

# Configure com dados de produção
# NUNCA commite este arquivo!
```

## Configuração no MCP

No arquivo `~/.cursor/mcp.json`, use variáveis de ambiente:

```json
{
  "mcpServers": {
    "firebird-mcp": {
      "command": "npx",
      "args": ["firebird_mcp_server@latest"],
      "env": {
        "FIREBIRD_HOST": "localhost",
        "FIREBIRD_PORT": "3050",
        "FIREBIRD_DATABASE": "/path/to/database.fdb",
        "FIREBIRD_USER": "SYSDBA",
        "FIREBIRD_PASSWORD": "masterkey",
        "FIREBIRD_ROLE": "RDB$ADMIN",
        "FIREBIRD_CHARSET": "UTF8"
      }
    }
  }
}
```

## Segurança

- ✅ Use variáveis de ambiente para dados sensíveis
- ✅ Mantenha arquivos locais fora do controle de versão
- ✅ Use templates para outros desenvolvedores
- ❌ NUNCA commite senhas ou dados de produção
- ❌ NUNCA compartilhe dados sensíveis em logs

## Troubleshooting

Se o MCP não conectar:
1. Verifique se o arquivo `local-connections.json` existe
2. Confirme se os dados de conexão estão corretos
3. Teste a conexão com: `node scripts/test-connection.js`
4. Verifique os logs em `logs/firebird-mcp.log`
5. Consulte a documentação do projeto: [GitLab Wiki](https://gitlab.ufpr.br/mcp/firebird_mcp_server/-/wikis/home)
