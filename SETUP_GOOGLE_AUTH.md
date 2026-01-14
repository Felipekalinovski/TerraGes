# Configuração do Login com Google

Este guia mostra como configurar o login com Google no seu projeto TerraGes usando Supabase.

## 📋 Pré-requisitos

- Conta no Google Cloud Console
- Projeto Supabase configurado

## 🔧 Passo 1: Configurar Google Cloud Console

### 1.1 Criar um Projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Anote o **Project ID**

### 1.2 Configurar OAuth Consent Screen

1. No menu lateral, vá em **APIs & Services** → **OAuth consent screen**
2. Selecione **External** como tipo de usuário
3. Preencha as informações obrigatórias:
   - **App name**: TerraGes
   - **User support email**: seu email
   - **Developer contact information**: seu email
4. Clique em **Save and Continue**
5. Em **Scopes**, adicione os escopos:
   - `userinfo.email`
   - `userinfo.profile`
6. Clique em **Save and Continue**
7. Adicione usuários de teste (se necessário)
8. Revise e clique em **Back to Dashboard**

### 1.3 Criar Credenciais OAuth 2.0

1. Vá em **APIs & Services** → **Credentials**
2. Clique em **Create Credentials** → **OAuth client ID**
3. Selecione **Web application**
4. Configure:
   - **Name**: TerraGes Web Client
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173` (desenvolvimento)
     - `https://seu-dominio.com` (produção)
   - **Authorized redirect URIs**:
     - `https://gwusywstresijdjzkujn.supabase.co/auth/v1/callback`
5. Clique em **Create**
6. **IMPORTANTE**: Copie o **Client ID** e **Client Secret**

## 🔐 Passo 2: Configurar Supabase

### 2.1 Acessar Configurações de Autenticação

1. Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com/)
2. Vá em **Authentication** → **Providers**
3. Encontre **Google** na lista de provedores

### 2.2 Habilitar Google Provider

1. Clique em **Google**
2. Ative o toggle **Enable Sign in with Google**
3. Cole as credenciais:
   - **Client ID**: (copiado do Google Cloud Console)
   - **Client Secret**: (copiado do Google Cloud Console)
4. Clique em **Save**

### 2.3 Configurar URL de Redirecionamento

A URL de callback do Supabase é:
```
https://gwusywstresijdjzkujn.supabase.co/auth/v1/callback
```

**Certifique-se de adicionar esta URL nas "Authorized redirect URIs" no Google Cloud Console!**

## 🚀 Passo 3: Testar a Integração

### 3.1 Desenvolvimento Local

1. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Acesse `http://localhost:5173/login`

3. Clique em **Continuar com Google**

4. Faça login com sua conta Google

5. Você será redirecionado para `/dashboard` após o login bem-sucedido

### 3.2 Verificar Usuário no Supabase

1. Vá em **Authentication** → **Users** no Supabase Dashboard
2. Você deve ver o novo usuário criado com o provider "google"

## 🔒 Segurança

### URLs Permitidas

No Supabase, configure as URLs permitidas em **Authentication** → **URL Configuration**:

- **Site URL**: `http://localhost:5173` (dev) ou `https://seu-dominio.com` (prod)
- **Redirect URLs**: 
  - `http://localhost:5173/dashboard`
  - `https://seu-dominio.com/dashboard`

## 🐛 Troubleshooting

### Erro: "redirect_uri_mismatch"

**Solução**: Verifique se a URL de callback do Supabase está corretamente configurada no Google Cloud Console.

### Erro: "Access blocked: This app's request is invalid"

**Solução**: 
1. Verifique se o OAuth Consent Screen está configurado corretamente
2. Adicione seu email como usuário de teste
3. Certifique-se de que os escopos estão corretos

### Usuário não é redirecionado após login

**Solução**: Verifique se a URL de redirecionamento está configurada corretamente no código e nas configurações do Supabase.

## 📝 Notas Importantes

1. **Ambiente de Desenvolvimento**: Durante o desenvolvimento, o Google pode mostrar um aviso de "app não verificado". Isso é normal. Clique em "Avançado" e depois em "Ir para [nome do app] (não seguro)".

2. **Publicação**: Para remover o aviso em produção, você precisará submeter seu app para verificação do Google.

3. **Dados do Usuário**: Quando um usuário faz login com Google, o Supabase automaticamente cria um registro na tabela `auth.users` com os dados do perfil do Google.

## ✅ Checklist de Configuração

- [ ] Projeto criado no Google Cloud Console
- [ ] OAuth Consent Screen configurado
- [ ] Credenciais OAuth 2.0 criadas
- [ ] Client ID e Client Secret copiados
- [ ] Google Provider habilitado no Supabase
- [ ] Credenciais coladas no Supabase
- [ ] URL de callback adicionada no Google Cloud Console
- [ ] URLs permitidas configuradas no Supabase
- [ ] Teste de login realizado com sucesso

## 🔗 Links Úteis

- [Documentação Supabase - Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Dashboard](https://app.supabase.com/)
