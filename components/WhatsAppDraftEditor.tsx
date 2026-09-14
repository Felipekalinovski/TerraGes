import React,{useState} from 'react';
import {supabase} from '../services/supabaseClient';
export type WhatsAppDraft={id:string;event_id:string;kind:string;payload:Record<string,string>;state:string;version:number;record_id?:string};
type Props={eventId:string;source:string;draft?:WhatsAppDraft;machines:{id:string;name:string}[];manager:boolean;onSaved:()=>Promise<void>};
const titles:Record<string,string>={rdo:'Diário de obra (RDO)',expense:'Despesa',service_order:'Ordem de serviço'};
const fieldClass='w-full rounded-lg bg-black/30 border border-white/20 px-3 py-2 text-white';
export function WhatsAppDraftEditor({eventId,source,draft,machines,manager,onSaved}:Props){
 const [kind,setKind]=useState(draft?.kind??'rdo');
 const [values,setValues]=useState<Record<string,string>>(draft?.payload??{description:source.slice(0,4000)});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(!draft),[checked,setChecked]=useState(false);
 const [expanded,setExpanded]=useState(Boolean(draft));
 const update=(key:string,value:string)=>{setValues(v=>({...v,[key]:value}));setDirty(true);setChecked(false);};
 async function act(action:'save'|'confirm'|'discard'){
  setBusy(true);setError('');
  try {
   const {error}=await supabase.rpc('review_whatsapp_draft',{p_event_id:eventId,p_action:action,p_kind:kind,p_payload:values,p_version:draft?.version??0});
   if(error)throw error;
   await onSaved();
  }catch(e:any){
   const msg=String(e?.message??'');
   setError(msg.includes('version_conflict')?'Outra pessoa alterou este rascunho. Atualize a caixa de entrada e confira a versão mais recente.':msg.includes('manager_required')?'A confirmação precisa ser feita por um gestor.':msg.includes('invalid_')||msg.includes('_required')?'Confira a data, a máquina, a descrição e os valores. A OS deve ter até 24 horas e horímetro final maior que o inicial.':'Não foi possível concluir. Atualize a caixa de entrada antes de tentar novamente.');
  }finally{setBusy(false);}
 }
 if(draft?.state==='confirmed')return <div className="p-3 rounded-xl bg-green-500/10 text-sm"><strong>{titles[draft.kind]} registrado</strong><p className="break-all mt-1 text-gray-300">Comprovante: {draft.record_id}</p>{manager&&<a className="text-primary underline" href={draft.kind==='expense'?'/finance':draft.kind==='rdo'?'/rdo':`/service-orders/${draft.record_id}`}>Ver lançamento</a>}</div>;
 if(draft?.state==='discarded')return <p className="text-sm text-gray-400">Rascunho descartado. O envio original foi preservado.</p>;
 if(!expanded)return <button className="px-4 py-2 rounded-xl bg-primary text-black" onClick={()=>setExpanded(true)}>Preparar lançamento</button>;
 const input=(key:string,label:string,type='text',step?:string)=><label className="block text-sm space-y-1">{label}<input className={fieldClass} type={type} step={step} value={values[key]??''} onChange={e=>update(key,e.target.value)} disabled={busy}/></label>;
 return <div className="space-y-4 border-t border-white/10 pt-4">
  <h3 className="font-bold">Conferir lançamento</h3>
  <p className="text-sm text-gray-400">Use o envio original para preencher os campos. Salvar mantém um rascunho; confirmar cria o lançamento.</p>
  <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
   <label className="block text-sm space-y-1">Tipo de lançamento<select className={fieldClass} value={kind} onChange={e=>{setKind(e.target.value);setDirty(true);setChecked(false);}}>{Object.entries(titles).map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></label>
   <div className="grid gap-3 sm:grid-cols-2">{input('date','Data do serviço ou despesa','date')}
    {kind!=='expense'&&<label className="block text-sm space-y-1">Máquina<select className={fieldClass} value={values.machine_id??''} onChange={e=>update('machine_id',e.target.value)}><option value="">Selecione a máquina</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
   </div>
   <label className="block text-sm space-y-1">{kind==='expense'?'Descrição da despesa':'Atividade realizada'}<textarea className={fieldClass} rows={4} maxLength={4000} value={values.description??''} onChange={e=>update('description',e.target.value)}/></label>
   {kind==='expense'&&<div className="grid gap-3 sm:grid-cols-2">{input('amount','Valor (R$)','number','0.01')}{input('category','Categoria')}</div>}
   {kind==='service_order'&&<>{input('client','Cliente')}<div className="grid gap-3 sm:grid-cols-3">{input('start_hour','Horímetro inicial','number','0.01')}{input('end_hour','Horímetro final','number','0.01')}{input('hourly_rate','Valor por hora (R$)','number','0.01')}</div></>}
   <button type="button" disabled={!dirty} onClick={()=>act('save')} className="px-4 py-2 rounded-xl bg-white/10 disabled:opacity-40">Salvar rascunho</button>
  </fieldset>
  {draft&&!dirty&&<div className="space-y-3">
   {(manager||kind==='rdo')?<><p className="text-sm text-gray-300">{kind==='expense'?'A despesa será registrada como pendente de pagamento.':kind==='service_order'?'A OS será criada como pendente, sem recebimento ou atualização do horímetro.':'O RDO será registrado com a atividade e a máquina conferidas.'}</p>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy} onChange={e=>setChecked(e.target.checked)}/>Conferi o conteúdo original, a data e todos os campos.</label>
    <button disabled={!checked||busy} onClick={()=>act('confirm')} className="px-4 py-2 rounded-xl bg-primary text-black disabled:opacity-40">Confirmar lançamento</button></>:<p className="text-sm text-amber-300">Rascunho salvo. Aguardando conferência e confirmação do gestor.</p>}
   <button disabled={busy} onClick={()=>act('discard')} className="ml-4 text-sm text-gray-400">Descartar rascunho</button>
  </div>}
  {busy&&<p role="status" className="text-sm text-gray-400">Salvando…</p>}
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
 </div>;
}
