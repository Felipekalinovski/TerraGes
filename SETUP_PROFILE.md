# TerraGes - Sistema de Gestão de Obras

## 🎯 Configuração das Funcionalidades de Perfil e Configurações

Este guia explica como configurar todas as funcionalidades de perfil de usuário e configurações no sistema TerraGes.

## 📋 Pré-requisitos

1. Projeto Supabase ativo
2. Variáveis de ambiente configuradas no arquivo `.env.local`:
   ```
   VITE_SUPABASE_URL=sua-url-do-supabase
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima
   VITE_OPENROUTER_API_KEY=sua-chave-do-openrouter
   ```

## 🗄️ Configuração do Banco de Dados

### Passo 1: Executar o Script SQL

Execute o arquivo `database_schema.sql` no SQL Editor do seu projeto Supabase. Este script irá:

- ✅ Criar tabela `profiles` para dados do usuário
- ✅ Criar tabela `companies` para dados da empresa
- ✅ Criar tabela `notification_settings` para preferências de notificação
- ✅ Configurar buckets de storage para avatares e logos
- ✅ Configurar Row Level Security (RLS) policies
- ✅ Criar trigger para auto-criar perfil ao registrar usuário

### Passo 2: Verificar Buckets de Storage

No painel do Supabase, vá em **Storage** e verifique se os seguintes buckets foram criados:
- `avatars` (público)
- `company-logos` (público)

Se não foram criados automaticamente, crie-os manualmente:
1. Clique em "New bucket"
2. Nome: `avatars` / `company-logos`
3. Marque como "Public bucket"
4. Salve

### Passo 3: Configurar Políticas de Storage

Se as políticas não foram criadas automaticamente, adicione manualmente no SQL Editor:

```sql
-- Políticas para avatars
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars');

-- Políticas para company-logos
CREATE POLICY "Company logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "Users can upload their company logo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-logos');
```

## ✨ Funcionalidades Implementadas

### 1. Perfil do Usuário (`/settings/profile`)
- ✅ Visualizar dados do perfil atual
- ✅ Editar nome, telefone e cargo
- ✅ Upload de foto de perfil (máx 5MB)
- ✅ Preview da foto em tempo real
- ✅ Salvamento automático no Supabase

### 2. Dados da Empresa (`/settings/company`)
- ✅ Cadastro/edição de razão social
- ✅ Cadastro/edição de CNPJ
- ✅ Cadastro/edição de endereço
- ✅ Cadastro/edição de website
- ✅ Salvamento automático no Supabase

### 3. Notificações (`/settings/notifications`)
- ✅ Configurar alertas de manutenção
- ✅ Configurar lembretes de agenda
- ✅ Configurar relatórios por e-mail
- ✅ Configurar alertas SMS
- ✅ Salvamento automático ao alternar

### 4. Segurança (`/settings/security`)
- ✅ Alterar senha (validação de 6+ caracteres)
- ✅ Confirmação de senha
- ✅ Atualização via Supabase Auth
- ✅ Visualização de dispositivos conectados

### 5. Layout/Sidebar
- ✅ Exibição do nome real do usuário
- ✅ Exibição da foto de perfil real
- ✅ Exibição do cargo do usuário
- ✅ Carregamento automático dos dados

## 🔧 Como Usar

### Alterar Foto de Perfil
1. Acesse **Configurações** → **Perfil do Usuário**
2. Clique no ícone de câmera na foto de perfil
3. Selecione uma imagem (PNG, JPG, etc.)
4. A foto será enviada automaticamente

### Editar Dados do Perfil
1. Acesse **Configurações** → **Perfil do Usuário**
2. Edite os campos desejados
3. Clique em **Salvar Alterações**

### Configurar Notificações
1. Acesse **Configurações** → **Notificações**
2. Ative/desative as opções desejadas
3. As alterações são salvas automaticamente

### Alterar Senha
1. Acesse **Configurações** → **Segurança**
2. Digite a nova senha (mínimo 6 caracteres)
3. Confirme a nova senha
4. Clique em **Atualizar Senha**

## 🔐 Segurança

### Row Level Security (RLS)
Todas as tabelas têm RLS ativado, o que significa que:
- Usuários só podem ver/editar seus próprios dados
- Não é possível acessar dados de outros usuários
- As políticas são aplicadas automaticamente

### Upload de Arquivos
- Validação de tipo de arquivo (apenas imagens)
- Validação de tamanho (máximo 5MB)
- URLs públicas geradas automaticamente
- Armazenamento seguro no Supabase Storage

## 🐛 Resolução de Problemas

### Erro ao carregar perfil
- Verifique se o script SQL foi executado
- Verifique se as variáveis de ambiente estão corretas
- Verifique se o usuário está autenticado

### Erro ao fazer upload de foto
- Verifique se os buckets de storage existem
- Verifique se as políticas de storage estão configuradas
- Verifique o tamanho e formato da imagem

### Configurações não salvam
- Abra o console do navegador (F12) para ver erros
- Verifique se as tabelas foram criadas corretamente
- Verifique as políticas RLS

## 📝 Arquivos Modificados

### Novos Arquivos
- `services/userService.ts` - Serviço de gerenciamento de usuários
- `services/companyService.ts` - Serviço de gerenciamento de empresas
- `database_schema.sql` - Schema do banco de dados

### Arquivos Atualizados
- `pages/SettingsProfile.tsx` - Perfil com funcionalidade real
- `pages/SettingsCompany.tsx` - Empresa com funcionalidade real
- `pages/SettingsNotifications.tsx` - Notificações com funcionalidade real
- `pages/SettingsSecurity.tsx` - Segurança com funcionalidade real
- `components/Layout.tsx` - Carregamento de dados reais do usuário

## 🎨 Melhorias Implementadas

1. **Loading States**: Indicadores visuais durante carregamento
2. **Error Handling**: Tratamento adequado de erros
3. **Validação**: Validação de formulários e dados
4. **UX**: Feedback visual ao salvar/carregar
5. **Performance**: Carregamento otimizado de dados

## 📚 Próximos Passos

Para continuar melhorando o sistema:

1. ✅ Implementar lógica real para todas as páginas de configurações
2. ⏳ Adicionar notificações toast em vez de alerts
3. ⏳ Implementar cropping de imagens
4. ⏳ Adicionar validação de CNPJ
5. ⏳ Implementar autenticação de dois fatores (2FA)
6. ⏳ Adicionar histórico de dispositivos conectados

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no console do navegador (F12)
2. Verifique os logs do Supabase no painel
3. Revise as políticas RLS no SQL Editor
4. Verifique se todas as migrações foram aplicadas
