import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  RefreshCw,
  Mic,
  Image,
  FileText,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { supabase } from "../services/supabaseClient";
import { resolvePrivateFile } from "../services/storageService";
import { useAuth } from "../contexts/AuthContext";
import { WhatsAppDraftEditor } from "../components/WhatsAppDraftEditor";
import type { WhatsAppDraft } from "../components/WhatsAppDraftEditor";
import { isAdminUser } from "../services/roleService";
type Entry = {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  text_content?: string;
  media_path?: string;
  extracted_data?: { text?: string };
  error_code?: string;
  attempts: number;
  updated_at: string;
};
const labels: Record<string, string> = {
  processing: "Em processamento",
  received: "Recebido",
  needs_review: "Aguardando conferência",
  failed: "Falha no processamento",
  rejected: "Arquivo recusado",
  processed: "Concluído",
  text: "Texto",
  audio: "Áudio",
  image: "Imagem",
  document: "Documento",
};
export const WhatsAppInbox: React.FC = () => {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<WhatsAppDraft[]>([]),
    [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [binding, setBinding] = useState(false);
  const [filter, setFilter] = useState("all"),
    [copied, setCopied] = useState(false);
  const matches = (entry: Entry, key: string) =>
    key === "all" ||
    (key === "review"
      ? entry.status === "needs_review"
      : key === "failed"
        ? ["failed", "rejected"].includes(entry.status)
        : entry.status === "processed");
  const visible = entries.filter((e) => matches(e, filter));
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const [result, status, machineResult] = await Promise.all([
        supabase
          .from("whatsapp_inbound_events")
          .select(
            "id,kind,status,created_at,text_content,media_path,extracted_data,error_code,attempts,updated_at,draft:whatsapp_drafts(*)",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.rpc("my_whatsapp_status"),
        supabase.from("machines").select("id,name").order("name"),
      ]);
      if (result.error || status.error || machineResult.error)
        throw new Error("load_failed");
      setDrafts(
        (result.data ?? []).flatMap((e) =>
          e.draft ? (Array.isArray(e.draft) ? e.draft : [e.draft]) : [],
        ),
      );
      setMachines(machineResult.data ?? []);
      setEntries(result.data ?? []);
      setBinding(Boolean(status.data));
    } catch {
      setError("Não foi possível carregar os envios. Tente atualizar.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setEntries([]);
    setDrafts([]);
    setMachines([]);
    setCode("");
    void refresh();
  }, [profile?.id]);
  async function pair() {
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("create_whatsapp_pairing");
    if (error)
      setError(
        "Não foi possível gerar o vínculo. Confira se sua empresa está vinculada ao perfil.",
      );
    else {
      setCode(data);
      setCopied(false);
    }
    setBusy(false);
  }
  async function retry(id: string) {
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.functions.invoke("whatsapp-worker", {
        body: { event_id: id },
      });
      if (error) throw error;
      await refresh();
    } catch {
      setError(
        "A retomada não está disponível ainda. Aguarde um minuto e atualize. Envios antigos ou com cinco tentativas precisam de uma nova mensagem.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openFile(path: string) {
    const url = await resolvePrivateFile(`storage://whatsapp-media/${path}`);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setError("Arquivo indisponível ou acesso não permitido.");
  }
  return (
    <Layout>
      <Layout.Header
        title="Caixa de entrada"
        subTitle="WhatsApp · Receba, confira e registre"
      />
      <Layout.Content>
        <div className="tg-page">
          <div className="tg-page-heading">
            <div>
              <p className="tg-eyebrow">Conectado ao campo</p>
              <h2>Da mensagem ao registro.</h2>
              <p className="tg-muted">
                {isAdminUser(profile?.role)
                  ? "Acompanhe os envios da sua empresa."
                  : "Acompanhe seus envios."}{" "}
                Confira o conteúdo antes de lançar no sistema.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={refresh}
              className="tg-button tg-button-secondary"
            >
              <RefreshCw size={17} className={busy ? "tg-spin" : ""} />
              {busy ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
          <details className="tg-panel tg-details">
            <summary>
              <Link2 size={18} />
              Meu WhatsApp
              <span
                className={`tg-badge tg-badge-${binding ? "completed" : "pending"}`}
              >
                {binding ? "Número vinculado" : "Vínculo pendente"}
              </span>
            </summary>
            <div className="tg-details-body">
              <p>
                Gere um código e envie a mensagem pelo seu WhatsApp ao número
                oficial do TerraGes informado pelo responsável. O código vale
                por 10 minutos, identifica sua conta e não deve ser
                compartilhado.
              </p>
              <button
                disabled={busy}
                onClick={pair}
                className="tg-button tg-button-secondary"
              >
                Gerar código de vínculo
              </button>
              {code && (
                <>
                  <code className="tg-code">{code}</code>
                  <button
                    className="tg-button tg-button-secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(code);
                        setCopied(true);
                      } catch {
                        setError(
                          "Não foi possível copiar. Selecione o código e copie manualmente.",
                        );
                      }
                    }}
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                    <span role="status">
                      {copied ? "Código copiado" : "Copiar mensagem"}
                    </span>
                  </button>
                  <p>
                    Depois de enviar, toque em Atualizar para conferir o
                    vínculo.
                  </p>
                </>
              )}
            </div>
          </details>
          <div className="tg-filters" aria-label="Filtrar envios">
            {[
              ["all", "Todos"],
              ["review", "Para conferir"],
              ["processed", "Concluídos"],
              ["failed", "Com falha"],
            ].map(([key, label]) => (
              <button
                key={key}
                className="tg-filter"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
                <span>{entries.filter((e) => matches(e, key)).length}</span>
              </button>
            ))}
          </div>
          <p className="tg-muted">
            Últimos 100 envios · Áudios, imagens e documentos de até 10 MB.
            Revise datas, máquinas, horas e valores: a transcrição pode conter
            erros.
          </p>
          {error && (
            <p role="alert" className="tg-alert">
              {error}
            </p>
          )}
          {busy && !entries.length && (
            <div className="tg-loading" role="status">
              <RefreshCw size={20} className="tg-spin" />
              Carregando envios…
            </div>
          )}
          {!busy && !error && visible.length === 0 && (
            <section className="tg-panel tg-empty">
              <MessageSquare size={34} />
              <h3>
                {entries.length
                  ? "Nenhum envio nesta situação"
                  : "Seu campo, mais conectado"}
              </h3>
              <p>
                {entries.length
                  ? "Escolha outro filtro para encontrar seus envios."
                  : "Vincule seu número e envie um áudio, uma imagem ou um documento ao WhatsApp oficial da empresa."}
              </p>
              {entries.length > 0 && (
                <button
                  className="tg-button tg-button-secondary"
                  onClick={() => setFilter("all")}
                >
                  Ver todos os envios
                </button>
              )}
            </section>
          )}
          <div className="tg-inbox-list">
            {visible.map((entry) => (
              <article key={entry.id} className="tg-panel tg-inbox-item">
                <div className="tg-inbox-head">
                  <span className="tg-task-icon">
                    {entry.kind === "audio" ? (
                      <Mic size={20} />
                    ) : entry.kind === "image" ? (
                      <Image size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                  </span>
                  <strong>{labels[entry.kind] || "Envio"}</strong>
                  <span className={`tg-badge tg-badge-${entry.status}`}>
                    {labels[entry.status] ?? entry.status}
                  </span>
                  <time dateTime={entry.created_at}>
                    {new Date(entry.created_at).toLocaleString("pt-BR")}
                  </time>
                </div>
                <p className="tg-inbox-text">
                  {entry.extracted_data?.text ||
                    entry.text_content ||
                    "Sem transcrição disponível."}
                </p>
                {entry.error_code && (
                  <p className="tg-alert">
                    O processamento não foi concluído. Tentativas:{" "}
                    {entry.attempts}/5. Arquivos recusados precisam ser
                    corrigidos e reenviados.
                  </p>
                )}
                <div className="tg-actions">
                  {entry.media_path && (
                    <button
                      className="tg-button tg-button-secondary"
                      onClick={() => openFile(entry.media_path!)}
                    >
                      Abrir arquivo privado
                    </button>
                  )}
                  {((entry.status === "failed" && entry.attempts < 5) ||
                    (entry.status === "processing" &&
                      Date.now() - new Date(entry.updated_at).getTime() >
                        180000)) && (
                    <button
                      disabled={busy}
                      onClick={() => retry(entry.id)}
                      className="tg-button tg-button-secondary"
                    >
                      Retomar processamento
                    </button>
                  )}
                </div>
                {(entry.status === "needs_review" ||
                  entry.status === "processed") && (
                  <WhatsAppDraftEditor
                    key={`${entry.id}-${drafts.find((d) => d.event_id === entry.id)?.version ?? 0}`}
                    eventId={entry.id}
                    source={
                      entry.extracted_data?.text || entry.text_content || ""
                    }
                    draft={drafts.find((d) => d.event_id === entry.id)}
                    machines={machines}
                    manager={isAdminUser(profile?.role)}
                    onSaved={refresh}
                  />
                )}
                <p className="tg-muted" style={{ marginTop: 16, fontSize: 13 }}>
                  Lançamentos são criados somente após conferência e
                  confirmação.
                </p>
              </article>
            ))}
          </div>
          <details className="tg-panel tg-details">
            <summary>Formatos aceitos e processamento</summary>
            <div className="tg-details-body">
              <p>
                Áudio, JPG, PNG, WebP, PDF, TXT e CSV, até 10 MB. Falhas
                temporárias são retomadas automaticamente, até cinco tentativas.
                Envios antigos que falharem precisam ser reenviados.
              </p>
            </div>
          </details>
        </div>
      </Layout.Content>
    </Layout>
  );
};
