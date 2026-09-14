import React, {useEffect,useState} from 'react';
import {Layout} from '../components/Layout';
import {supabase} from '../services/supabaseClient';
import {resolvePrivateFile} from '../services/storageService';
import {useAuth} from '../contexts/AuthContext';
import {isAdminUser} from '../services/roleService';
type Entry = {id:string;kind:string;status:string;created_at:string;text_content?:string;media_path?:string;extracted_data?:{text?:string};error_code?:string};
const labels:Record<string,string>={processing:'Em processamento',received:'Recebido',needs_review:'Aguardando conferência',failed:'Falha no processamento',rejected:'Arquivo recusado',processed:'Conferido',text:'Texto',audio:'Áudio',image:'Imagem',document:'Documento'};
export const WhatsAppInbox:React.FC=()=>{
  const {profile}=useAuth();
  const [entries,setEntries]=useState<Entry[]>([]), [code,setCode]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const [binding,setBinding]=useState(false);
  async function refresh(){
    setBusy(true);setError('');
    try {
      const [result,status]=await Promise.all([
        supabase.from('whatsapp_inbound_events').select('id,kind,status,created_at,text_content,media_path,extracted_data,error_code').order('created_at',{ascending:false}).limit(100),
        supabase.rpc('my_whatsapp_status')
      ]);
      if(result.error) throw result.error;
      setEntries(result.data??[]);setBinding(Boolean(status.data));
    } catch {setError('Não foi possível carregar os envios. Tente atualizar.');} finally {setBusy(false);}
  }
  useEffect(()=>{void refresh();},[profile?.id]);
  async function pair(){
    setBusy(true);setError('');
    const {data,error}=await supabase.rpc('create_whatsapp_pairing');
    if(error)setError('Não foi possível gerar o vínculo. Confira se sua empresa está vinculada ao perfil.');else setCode(data);
    setBusy(false);
  }
  async function openFile(path:string){
    const url=await resolvePrivateFile(`storage://whatsapp-media/${path}`);
    if(url)window.open(url,'_blank','noopener,noreferrer');else setError('Arquivo indisponível ou acesso não permitido.');
  }
  return <Layout><Layout.Header title="WhatsApp" subTitle="Envios identificados e conferência de conteúdo" showBack/><Layout.Content>
    <div className="p-4 space-y-6 pb-24 max-w-4xl mx-auto text-white">
      <section className="p-5 rounded-2xl border border-white/10 bg-surface-dark space-y-3">
        <h2 className="font-bold text-lg">Meu número • {binding?'Vinculado':'Vínculo pendente'}</h2>
        <p className="text-sm text-gray-400">Gere o código e envie a mensagem abaixo, pelo seu próprio WhatsApp, ao número oficial do TerraGes informado pelo responsável. O código vale por 10 minutos e identifica somente a sua conta. Não o compartilhe.</p>
        <button disabled={busy} onClick={pair} className="px-4 py-2 bg-primary text-black rounded-xl disabled:opacity-50">Gerar código de vínculo</button>
        {code&&<div className="p-3 rounded-xl bg-black/30"><code className="break-all select-all">{code}</code><p className="text-xs mt-2 text-gray-400">Depois de enviar, clique em Atualizar para conferir o vínculo.</p></div>}
      </section>
      <div className="flex items-center justify-between gap-4"><h2 className="font-bold">{isAdminUser(profile?.role)?'Envios da minha empresa':'Meus envios'}</h2><button disabled={busy} onClick={refresh} className="text-primary">{busy?'Carregando…':'Atualizar'}</button></div>
      <p className="text-sm text-gray-400">Áudio, JPG, PNG, WebP, PDF, TXT e CSV de até 10 MB. Confira datas, máquinas, horas e valores antes de registrar uma OS, RDO ou despesa. A transcrição pode conter erros. Arquivos com falha podem ser reenviados como uma nova mensagem.</p>
      {error&&<p role="alert" className="text-red-400">{error}</p>}
      {!busy&&entries.length===0&&<p className="p-6 rounded-xl bg-white/5 text-gray-400">Nenhum envio disponível nesta conta.</p>}
      {entries.map(entry=><article key={entry.id} className="p-5 rounded-2xl bg-surface-dark border border-white/10 space-y-3">
        <div className="flex flex-wrap gap-3 text-sm"><strong>{labels[entry.kind]}</strong><span className="text-primary">{labels[entry.status]??entry.status}</span><time className="text-gray-400">{new Date(entry.created_at).toLocaleString('pt-BR')}</time></div>
        <p className="whitespace-pre-wrap break-words text-sm">{entry.extracted_data?.text||entry.text_content||'Sem transcrição disponível.'}</p>
        {entry.error_code&&<p className="text-sm text-red-300">O processamento não foi concluído. Confira o formato e reenvie o conteúdo.</p>}
        {entry.media_path&&<button className="text-primary underline text-sm" onClick={()=>openFile(entry.media_path!)}>Abrir arquivo privado</button>}
        <p className="text-xs text-gray-500">Este envio não gerou lançamentos automáticos.</p>
      </article>)}
    </div></Layout.Content></Layout>;
};
