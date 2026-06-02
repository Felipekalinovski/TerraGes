/**
 * Types para Evolution GO API
 * Compatível com Antigravity Design System
 */

// ─── WEBHOOK PAYLOAD ──────────────────────────────────────────────────────────

export interface EvogoWebhookPayload {
  event: "Message" | "messages.upsert" | "messages.update" | "send_message" | "connection.update" | string;
  instance?: string;
  instanceName?: string;
  instanceToken?: string;
  timestamp?: number;
  data: EvogoMessageData;
}

export interface EvogoMessageData {
  Info?: EvogoMessageInfo;
  key?: EvogoMessageKey;
  Message?: EvogoMessage;
  message?: EvogoMessage;
  IsBotInvoke?: boolean;
  IsEdit?: boolean;
  [key: string]: any;
}

export interface EvogoMessageInfo {
  Chat: string;               // "555592149709@s.whatsapp.net" ou "12345678-1234567890@g.us"
  Sender: string;             // JID completo
  ID: string;                 // ID único da mensagem
  IsFromMe: boolean;
  IsGroup: boolean;
  PushName?: string;          // Nome do contato
  Type: "text" | "audio" | "image" | "video" | "document" | "sticker" | "location" | "vcard";
  MediaType?: string;
  Timestamp: string | number; // Unix timestamp
  [key: string]: any;
}

export interface EvogoMessageKey {
  id: string;
  remoteJid: string;          // "555592149709@s.whatsapp.net"
  fromMe: boolean;
  [key: string]: any;
}

export interface EvogoMessage {
  conversation?: string;
  text?: string;
  extendedTextMessage?: {
    text: string;
    description?: string;
    matchedText?: string;
    canonicalUrl?: string;
    previewType?: string;
    jpegThumbnail?: string;
    media?: any;
  };
  audioMessage?: {
    url?: string;
    mimetype: string;
    fileLength?: string;
    seconds?: number;
    ptt?: boolean; // Voice message
    mediaKey?: string;
  };
  imageMessage?: {
    url?: string;
    mimetype: string;
    caption?: string;
    fileLength?: string;
    height?: number;
    width?: number;
    mediaKey?: string;
    jpegThumbnail?: string;
  };
  videoMessage?: {
    url?: string;
    mimetype: string;
    caption?: string;
    fileLength?: string;
    seconds?: number;
    height?: number;
    width?: number;
    mediaKey?: string;
    jpegThumbnail?: string;
  };
  documentMessage?: {
    url?: string;
    mimetype: string;
    title?: string;
    fileName?: string;
    fileLength?: string;
    mediaKey?: string;
    jpegThumbnail?: string;
  };
  locationMessage?: {
    degreesLatitude: number;
    degreesLongitude: number;
    name?: string;
    address?: string;
    accuracy?: number;
  };
  contactMessage?: {
    vcard: string;
    displayName?: string;
  };
  reactionMessage?: {
    key: EvogoMessageKey;
    text: string;
  };
  quotedMessage?: any;
}

// ─── API REQUEST/RESPONSE ─────────────────────────────────────────────────────

export interface SendTextRequest {
  number: string;             // "5559xxxx" ou "555592149709"
  text: string;
  delay?: number;             // ms, -1 para imediato
  linkPreview?: boolean;
  mentioned?: string[];       // JIDs para mentions
  quoted?: {
    key: EvogoMessageKey;
    message: { conversation: string };
  };
}

export interface SendTextResponse {
  key: EvogoMessageKey;
  message: EvogoMessage;
  messageTimestamp: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
}

export interface GetBase64Response {
  base64?: string;
  data?: {
    base64?: string;
    mimetype?: string;
  };
  mimetype?: string;
}

export interface WebhookSetRequest {
  enabled: boolean;
  url: string;
  headers?: Record<string, string>;
  events?: string[];
  byEvents?: boolean;         // Agrupar eventos
  base64?: boolean;           // Enviar mídia em base64
}

export interface WebhookFindResponse {
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
    events?: string[];
    byEvents?: boolean;
    base64?: boolean;
  };
  [key: string]: any;
}

// ─── DATABASE TYPES ───────────────────────────────────────────────────────────

export interface WhatsAppConversation {
  id: string;
  profile_id: string;
  phone_number: string;
  contact_name?: string;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  whatsapp_msg_id?: string;
  input_type?: "text" | "audio" | "image" | "video";
  action_type?: "schedule" | "service_order" | "report" | null;
  action_data?: Record<string, any>;
  action_status?: "none" | "pending" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  phone: string;
  role: "operador" | "gerente" | "proprietario" | "admin";
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// ─── OPERATOR TYPES ───────────────────────────────────────────────────────────

export interface OperaAIContext {
  userId: string;
  phone: string;
  isAdmin: boolean;
  role: string;
  conversationId: string;
}

export interface OperaAIResponse {
  text: string;
  actionType?: "schedule" | "service_order" | "report" | null;
  actionData?: Record<string, any>;
  actionStatus?: "pending" | "completed" | "failed";
}

// ─── EVOLUTION CONFIG ─────────────────────────────────────────────────────────

export interface EvolutionConfig {
  apiUrl: string;
  globalKey: string;
  instanceName: string;
  instanceToken?: string;
  webhookUrl?: string;
}

export enum EvolutionEvent {
  MESSAGES_UPSERT = "MESSAGES_UPSERT",
  MESSAGES_UPDATE = "MESSAGES_UPDATE",
  MESSAGES_DELETE = "MESSAGES_DELETE",
  SEND_MESSAGE = "SEND_MESSAGE",
  CONNECTION_UPDATE = "CONNECTION_UPDATE",
  CALL = "CALL",
  PRESENCE_UPDATE = "PRESENCE_UPDATE",
  TYPING = "TYPING",
}

export enum MessageType {
  TEXT = "text",
  AUDIO = "audio",
  IMAGE = "image",
  VIDEO = "video",
  DOCUMENT = "document",
  STICKER = "sticker",
  LOCATION = "location",
  VCARD = "vcard",
  UNSUPPORTED = "unsupported",
}
