import React, {useEffect,useState} from 'react';
import {Layout} from '../components/Layout';
import {supabase} from '../services/supabaseClient';
import {resolvePrivateFile} from '../services/storageService';
import {useAuth} from '../contexts/AuthContext';
import {WhatsAppDraftEditor} from '../components/WhatsAppDraftEditor';
import type {WhatsAppDraft} from '../components/WhatsAppDraftEditor';
import {isAdminUser} from '../services/roleService';
type Entry = {id:string;kind:string;status:string;created_at:string;text_content?:string;media_path?:string;extracted_data?:{text?:string};error_code?:string;attempts:number;updated_at:string};
const labels:Record<string,string>={processing:'Em processamento',received:'Recebido',needs_review:'Aguardando conferência',failed:'Falha no processamento',rejected:'Arquivo recusado',processed:'Concluído',text:'Texto',audio:'Áudio',image:'Imagem',document:'Documento'};
export const WhatsAppInbox:React.FC=()=>{
  const {profile}=useAuth();
  const [entries,setEntries]=useState<Entry[]>([]), [code,setCode]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const [drafts,setDrafts]=useState<WhatsAppDraft[]>([]),[machines,setMachines]=useState<{id:string;name:string}[]>([]);
  const [binding,setBinding]=useState(false);
  async function refresh(){
    setBusy(true);setError('');
    try {
      const [result,status,machineResult]=await Promise.all([
        supabase.from('whatsapp_inbound_events').select('id,kind,status,created_at,text_content,media_path,extracted_data,error_code,attempts,updated_at,draft:whatsapp_drafts(*)').order('created_at',{ascending:false}).limit(100),
        supabase.rpc('my_whatsapp_status'),
        supabase.from('machines').select('id,name').order('name')
      ]);
      if(result.error||status.error||machineResult.error) throw new Error("load_failed");
      setDrafts((result.data??[]).flatMap(e=>e.draft?(Array.isArray(e.draft)?e.draft:[e.draft]):[]));setMachines(machineResult.data??[]);
      setEntries(result.data??[]);setBinding(Boolean(status.data));
    } catch {setError('Não foi possível carregar os envios. Tente atualizar.');} finally {setBusy(false);}
  }
  useEffect(()=>{setEntries([]);setDrafts([]);setMachines([]);setCode('');void refresh();},[profile?.id]);
  async function pair(){
    setBusy(true);setError('');
    const {data,error}=await supabase.rpc('create_whatsapp_pairing');
    if(error)setError('Não foi possível gerar o vínculo. Confira se sua empresa está vinculada ao perfil.');else setCode(data);
    setBusy(false);
  }
  async function retry(id:string){
    setBusy(true);setError('');
    try{const {error}=await supabase.functions.invoke('whatsapp-worker',{body:{event_id:id}});if(error)throw error;await refresh();}
    catch{setError('A retomada não está disponível ainda. Aguarde um minuto e atualize. Envios antigos ou com cinco tentativas precisam de uma nova mensagem.');}
    finally{setBusy(false);}
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
      <p className="text-sm text-gray-400">Áudio, JPG, PNG, WebP, PDF, TXT e CSV de até 10 MB. Confira datas, máquinas, horas e valores antes de registrar uma OS, RDO ou despesa. A transcrição pode conter erros. Falhas temporárias são retomadas automaticamente, até cinco tentativas. Envios anteriores a esta atualização precisam ser reenviados se falharem.</p>
      {error&&<p role="alert" className="text-red-400">{error}</p>}
      {!busy&&entries.length===0&&<p className="p-6 rounded-xl bg-white/5 text-gray-400">Nenhum envio disponível nesta conta.</p>}
      {entries.map(entry=><article key={entry.id} className="p-5 rounded-2xl bg-surface-dark border border-white/10 space-y-3">
        <div className="flex flex-wrap gap-3 text-sm"><strong>{labels[entry.kind]}</strong><span className="text-primary">{labels[entry.status]??entry.status}</span><time className="text-gray-400">{new Date(entry.created_at).toLocaleString('pt-BR')}</time></div>
        <p className="whitespace-pre-wrap break-words text-sm">{entry.extracted_data?.text||entry.text_content||'Sem transcrição disponível.'}</p>
        {entry.error_code&&<p className="text-sm text-red-300">O processamento não foi concluído. Tentativas: {entry.attempts}/5. Arquivos recusados precisam ser corrigidos e reenviados.</p>}
        {entry.media_path&&<button className="text-primary underline text-sm" onClick={()=>openFile(entry.media_path!)}>Abrir arquivo privado</button>}
        {((entry.status==='failed'&&entry.attempts<5)||(entry.status==='processing'&&Date.now()-new Date(entry.updated_at).getTime()>180000))&&<button disabled={busy} onClick={()=>retry(entry.id)} className="text-sm text-primary">Retomar processamento</button>}
        {(entry.status==='needs_review'||entry.status==='processed')&&<WhatsAppDraftEditor key={`${entry.id}-${drafts.find(d=>d.event_id===entry.id)?.version??0}`} eventId={entry.id} source={entry.extracted_data?.text||entry.text_content||''} draft={drafts.find(d=>d.event_id===entry.id)} machines={machines} manager={isAdminUser(profile?.role)} onSaved={refresh}/>}
        <p className="text-xs text-gray-500">Lançamentos são criados somente após conferência e confirmação.</p>
      </article>)}
    </div></Layout.Content></Layout>;
};
