import React, {useEffect,useState} from 'react';
import {WhatsAppConnection} from '../components/WhatsAppConnection';
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
  const [entries,setEntries]=useState<Entry[]>([]), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const [drafts,setDrafts]=useState<WhatsAppDraft[]>([]),[machines,setMachines]=useState<{id:string;name:string}[]>([]);

  async function refresh(){
    setBusy(true);setError('');
    try {
      const [result,machineResult]=await Promise.all([
        supabase.from('whatsapp_inbound_events').select('id,kind,status,created_at,text_content,media_path,extracted_data,error_code,attempts,updated_at,draft:whatsapp_drafts(*)').order('created_at',{ascending:false}).limit(100),
        supabase.from('machines').select('id,name').order('name')
      ]);
      if(result.error||machineResult.error) throw new Error("load_failed");
      setDrafts((result.data??[]).flatMap(e=>e.draft?(Array.isArray(e.draft)?e.draft:[e.draft]):[]));setMachines(machineResult.data??[]);
      setEntries(result.data??[]);
    } catch {setError('Não foi possível carregar os envios. Tente atualizar.');} finally {setBusy(false);}
  }
  useEffect(()=>{setEntries([]);setDrafts([]);setMachines([]);void refresh();},[profile?.id]);
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
  return <Layout><Layout.Header title="WhatsApp" subTitle="Confira os registros da sua empresa" showBack/><Layout.Content>
    <div className="p-4 space-y-6 pb-24 max-w-4xl mx-auto text-white">
      <WhatsAppConnection />
      <div className="flex items-center justify-between gap-4"><h2 className="font-bold">{isAdminUser(profile?.role)?'Envios da minha empresa':'Meus envios'}</h2><button disabled={busy} onClick={refresh} className="text-primary">{busy?'Carregando…':'Atualizar'}</button></div>
      <p className="text-sm text-gray-400">Confira os dados recebidos antes de confirmar um lançamento.</p>
      <details className="tg-details"><summary>Arquivos aceitos e ajuda com falhas</summary><p>Áudio, JPG, PNG, WebP, PDF, TXT e CSV de até 10 MB. A transcrição pode conter erros: confira datas, máquinas, horas e valores. Falhas temporárias são retomadas automaticamente, até cinco tentativas. Se não funcionar, envie a mensagem novamente.</p></details>
      {error&&<p role="alert" className="text-red-400">{error}</p>}
      {!busy&&entries.length===0&&<p className="p-6 rounded-xl bg-white/5 text-gray-400">Nenhum envio por aqui ainda. Envie uma mensagem ao TerraGes pelo WhatsApp conectado e toque em Atualizar.</p>}
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
