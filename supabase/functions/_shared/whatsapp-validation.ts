export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
export const MAX_WEBHOOK_BYTES = 128 * 1024;
export class IntakeError extends Error {
  status: number;
  constructor(code: string, status = 400) { super(code); this.status = status; }
}
export async function readLimited(response: Response | Request, limit: number): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > limit) throw new IntakeError('payload_too_large', 413);
  if (!response.body) throw new IntakeError('empty_body');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new IntakeError('payload_too_large', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export async function equalSecret(a: string, b: string): Promise<boolean> {
  if (!a || !b || a.length > 512 || b.length > 512) return false;
  const encode = new TextEncoder();
  const [x,y] = await Promise.all([a,b].map(v => crypto.subtle.digest('SHA-256', encode.encode(v))));
  const aa = new Uint8Array(x), bb = new Uint8Array(y); let delta = 0;
  for (let i = 0; i < aa.length; i++) delta |= aa[i] ^ bb[i];
  return delta === 0;
}
export function normalizePhone(jid: unknown): string {
  if (typeof jid !== 'string' || !/^[1-9][0-9]{7,14}@(s\.whatsapp\.net|c\.us)$/.test(jid)) throw new IntakeError('unsupported_sender');
  return jid.split('@')[0];
}
export function parseMessage(payload: any, expectedInstance: string) {
  const instance = payload.instanceName ?? payload.instance;
  if (!expectedInstance || instance !== expectedInstance) throw new IntakeError('instance_mismatch', 403);
  if (!['Message', 'messages.upsert', 'MESSAGES_UPSERT'].includes(payload.event)) return null;
  const envelope = payload.data?.data ?? payload.data;
  if (!envelope || typeof envelope !== 'object') throw new IntakeError('invalid_envelope');
  const info = envelope.Info ?? envelope.key;
  if (!info) throw new IntakeError('missing_message_identity');
  const jid = info.Chat ?? info.remoteJid;
  if (info.IsFromMe === true || info.fromMe === true || info.IsGroup === true || String(jid).endsWith('@g.us')) return null;
  const phone = normalizePhone(jid);
  const id = info.ID ?? info.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(id)) throw new IntakeError('invalid_message_id');
  const message = envelope.Message ?? envelope.message;
  if (!message || typeof message !== 'object') throw new IntakeError('invalid_message');
  // Do not unwrap ephemeral, view-once, edits or quoted messages into new commands.
  const variants = [message.audioMessage, message.imageMessage, message.documentMessage,
    message.conversation ?? message.extendedTextMessage?.text].filter(v => v !== undefined && v !== null);
  if (variants.length !== 1) throw new IntakeError('unsupported_message');
  const kind = message.audioMessage ? 'audio' : message.imageMessage ? 'image' : message.documentMessage ? 'document' : 'text';
  const media = message.audioMessage ?? message.imageMessage ?? message.documentMessage;
  const text = kind === 'text' ? (message.conversation ?? message.extendedTextMessage?.text) : (media.caption ?? '');
  if (typeof text !== 'string' || text.length > 16000) throw new IntakeError('invalid_text');
  return { instance, phone, jid, id, kind, text, mime: media?.mimetype };
}
export function validateMedia(base64: unknown, declaredMime: unknown, kind: string) {
  if (typeof base64 !== 'string' || base64.length > Math.ceil(MAX_MEDIA_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new IntakeError('invalid_media_encoding');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); } catch { throw new IntakeError('invalid_media_encoding'); }
  if (!bytes.length || bytes.length > MAX_MEDIA_BYTES) throw new IntakeError('invalid_media_size', 413);
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  let mime = '', ext = '';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { mime = 'image/jpeg'; ext = 'jpg'; }
  else if ([137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) { mime = 'image/png'; ext = 'png'; }
  else if (text(0,4) === 'RIFF' && text(8,12) === 'WEBP') { mime = 'image/webp'; ext = 'webp'; }
  else if (text(0,4) === 'OggS') { mime = 'audio/ogg'; ext = 'ogg'; }
  else if (text(0,3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0)) { mime = 'audio/mpeg'; ext = 'mp3'; }
  else if (text(0,4) === 'RIFF' && text(8,12) === 'WAVE') { mime = 'audio/wav'; ext = 'wav'; }
  else if (text(4,8) === 'ftyp' && ['M4A ', 'M4B '].includes(text(8,12))) { mime = 'audio/mp4'; ext = 'm4a'; }
  else if (text(0,5) === '%PDF-') { mime = 'application/pdf'; ext = 'pdf'; }
  const declared = typeof declaredMime === 'string' ? declaredMime.split(';')[0].trim().toLowerCase() : '';
  if (!mime && ['text/plain','text/csv'].includes(declared)) {
    let decoded: string;
    try { decoded = new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { throw new IntakeError('invalid_text_encoding'); }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(decoded) || /^\s*(?:<!doctype|<html|<svg|<script)/i.test(decoded)) throw new IntakeError('active_or_binary_document');
    mime = declared; ext = mime === 'text/csv' ? 'csv' : 'txt';
  }
  const aliases: Record<string,string> = {'audio/x-wav':'audio/wav','audio/mp3':'audio/mpeg'};
  if (!mime || mime !== (aliases[declared] ?? declared)) throw new IntakeError('media_type_mismatch');
  if ((kind === 'audio' && !mime.startsWith('audio/')) || (kind === 'image' && !mime.startsWith('image/')) || (kind === 'document' && !['application/pdf','text/plain','text/csv'].includes(mime))) throw new IntakeError('unsupported_media_type');
  return {bytes, mime, ext, base64};
}
