---
name: processamento-multimodal
description: Processa mensagens multimodais (áudio, imagem) do WhatsApp. Use quando receber mídia e precisar extrair texto.
allowed-tools: None
---

# Skill de Processamento Multimodal

## Quando usar
- Receber mensagem de áudio (.ogg, .mp4)
- Receber mensagem de imagem com legenda
- Precisar transcrever áudio para texto
- Precisar fazer OCR em imagens

## Tipos de Processamento

### 1. Transcrição de Áudio
- Usar Groq Whisper API
- Suporta formatos: .ogg, .mp4
- Idioma: português (pt)
- Model: whisper-large-v3-turbo

### 2. OCR em Imagens
- Usar Gemini Vision API
- Extrair texto visível da imagem
- Identificar valores monetários, datas, documentos
- Combinar com legenda da mensagem

## Fluxo de Processamento

### Áudio
```
1. Receber mensagem de áudio
2. Baixar mídia (base64)
3. Chamar Groq Whisper API
4. Retornar texto transcrito
```

### Imagem
```
1. Receber mensagem de imagem
2. Extrair legenda (caption)
3. Baixar imagem
4. Chamar Gemini Vision API (OCR)
5. Combinar legenda + texto OCR
6. Retornar texto completo
```

## APIs Utilizadas

### Groq Whisper
```
Endpoint: https://api.groq.com/openai/v1/audio/transcriptions
Modelo: whisper-large-v3-turbo
Idioma: pt
Formato: text
```

### Gemini Vision
```
Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent
Função: OCR e extração de texto
```

## Formato de Entrada

```
{
  "message_id": "abc123",
  "chat_jid": "551199999999@s.whatsapp.net",
  "type": "audio" | "image",
  "media_url": "https://...",
  "caption": "Texto opcional da legenda"
}
```

## Formato de Saída

```
{
  "text": "Texto extraído da mídia",
  "confidence": número (0-1),
  "processed_type": "audio" | "image"
}
```

## Exemplos de Uso

### Áudio
```
Usuário envia áudio: "Olá, registrei 8 horas da escavadeira hoje"
→ Transcrever com Whisper
→ Retornar: "Olá, registrei 8 horas da escavadeira hoje"
```

### Imagem
```
Usuário envia foto de nota fiscal com legenda: "Comprovante de abastecimento"
→ Fazer OCR na imagem
→ Retornar: "Comprovante de abastecimento\n[NF: 12345, Valor: R$ 250,00, Data: 01/06/2026]"
```

## Tratamento de Erros

- Transcrição falhou: Solicitar ao usuário digitar
- OCR falhou: Informar que não conseguiu ler a imagem
- Mídia não disponível: Solicitar envio novamente

## Performance

- Transcrição de áudio: ~3-5 segundos
- OCR de imagem: ~2-4 segundos
- Tolerância máxima: 10 segundos por requisição