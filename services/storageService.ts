import { supabase } from './supabaseClient';

export async function uploadPrivateFile(bucket: string, file: File): Promise<string> {
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) throw new Error('Entre na sua conta.');
  const {data:profile,error} = await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if (error || !profile?.company_id) throw new Error('Seu vínculo com a empresa precisa ser verificado.');
  const extensions: Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
  const ext = extensions[file.type];
  if (!ext || (bucket !== 'service-receipts' && !file.type.startsWith('image/'))) throw new Error('Use JPG, PNG, WebP ou PDF para comprovantes.');
  if (file.size > (bucket === 'service-receipts' ? 10 : 5)*1024*1024) throw new Error('Arquivo acima do limite permitido.');
  const path = `${profile.company_id}/${user.id}/${crypto.randomUUID()}.${ext}`;
  const result = await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
  if (result.error) throw result.error;
  return `storage://${bucket}/${path}`;
}

export async function resolvePrivateFile(reference?: string | null): Promise<string | undefined> {
  if (!reference) return undefined;
  let bucket: string, path: string;
  if (reference.startsWith('storage://')) {
    const parts = reference.slice(10).split('/'); bucket = parts.shift()!; path = parts.join('/');
  } else {
    try {
      const url = new URL(reference);
      // Legacy Supabase public links must also pass storage RLS before being rendered.
      if (url.origin !== 'https://gwusywstresijdjzkujn.supabase.co') return undefined;
      const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
      if (!match) return undefined;
      bucket = match[1]; path = decodeURIComponent(match[2]);
    } catch { return undefined; }
  }
  if (!['avatars','company-logos','service-receipts','whatsapp-media'].includes(bucket)) return undefined;
  const {data,error} = await supabase.storage.from(bucket).createSignedUrl(path,300);
  return error ? undefined : data.signedUrl;
}
