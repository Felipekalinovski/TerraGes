import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plus,
  ClipboardList,
  CalendarDays,
  Clock3,
  ArrowUpRight,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Layout } from "../components/Layout";
import {
  serviceOrderService,
  type ServiceOrder,
} from "../services/serviceOrderService";
import { useAuth } from "../contexts/AuthContext";

const statuses = {
  all: "Todas",
  pending: "Pendentes",
  completed: "Concluídas",
  cancelled: "Canceladas",
};
const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const dateLabel = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const ServiceOrderList: React.FC = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState<keyof typeof statuses>("all");
  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      setOrders(await serviceOrderService.getAll());
    } catch {
      setError(
        "Não foi possível carregar as ordens de serviço. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setOrders([]);
    if (profile) void loadOrders();
  }, [profile?.id, profile?.company_id]);
  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (status === "all" || o.status === status) &&
          normalize(
            `${o.id} ${o.client} ${o.machine?.name || ""} ${o.operator?.name || ""}`,
          ).includes(normalize(query.trim())),
      ),
    [orders, status, query],
  );
  return (
    <Layout>
      <Layout.Header
        title="Ordens de serviço"
        subTitle="Do trabalho em campo à conclusão"
      />
      <Layout.Content>
        <div className="tg-page">
          <div className="tg-page-heading">
            <div>
              <p className="tg-eyebrow">Operação</p>
              <h2>Cada serviço, sob controle.</h2>
              <p className="tg-muted">
                Encontre ordens, acompanhe a execução e acesse a folha de
                serviço.
              </p>
            </div>
            <Link className="tg-button" to="/service-orders/new">
              <Plus size={18} /> Nova ordem
            </Link>
          </div>
          <div className="tg-toolbar">
            <label className="tg-search">
              <Search size={19} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente, máquina ou nº da OS"
                aria-label="Buscar ordens de serviço"
              />
            </label>
            <button
              className="tg-button tg-button-secondary"
              onClick={loadOrders}
              disabled={loading}
            >
              <RefreshCw size={17} className={loading ? "tg-spin" : ""} />{" "}
              Atualizar
            </button>
          </div>
          <div className="tg-filters" aria-label="Filtrar por situação">
            {Object.entries(statuses).map(([key, label]) => (
              <button
                key={key}
                className="tg-filter"
                aria-pressed={status === key}
                onClick={() => setStatus(key as keyof typeof statuses)}
              >
                {label}
                <span>
                  {loading || error
                    ? "—"
                    : key === "all"
                      ? orders.length
                      : orders.filter((o) => o.status === key).length}
                </span>
              </button>
            ))}
          </div>
          {error ? (
            <div className="tg-alert" role="alert">
              {error}
            </div>
          ) : loading ? (
            <div className="tg-loading" role="status">
              <RefreshCw size={20} className="tg-spin" />
              Carregando serviços…
            </div>
          ) : (
            <>
              <p className="tg-muted" role="status">
                {filtered.length}{" "}
                {filtered.length === 1
                  ? "ordem encontrada"
                  : "ordens encontradas"}
              </p>
              {filtered.length === 0 ? (
                <section className="tg-panel tg-empty">
                  <ClipboardList size={34} />
                  <h3>
                    {orders.length
                      ? "Nenhum serviço com esses filtros"
                      : "Sua próxima operação começa aqui"}
                  </h3>
                  <p>
                    {orders.length
                      ? "Tente outro cliente, máquina ou situação."
                      : "Crie uma ordem para organizar cliente, máquina e horas trabalhadas."}
                  </p>
                  {orders.length ? (
                    <button
                      className="tg-button tg-button-secondary"
                      onClick={() => {
                        setQuery("");
                        setStatus("all");
                      }}
                    >
                      Limpar filtros
                    </button>
                  ) : (
                    <Link to="/service-orders/new" className="tg-button">
                      Criar primeira ordem
                    </Link>
                  )}
                </section>
              ) : (
                <div className="tg-order-grid">
                  {filtered.map((order) => (
                    <article key={order.id} className="tg-panel tg-order">
                      <div className="tg-order-top">
                        <span className="tg-order-id">
                          OS #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`tg-badge tg-badge-${order.status}`}>
                          {
                            {
                              pending: "Pendente",
                              completed: "Concluída",
                              cancelled: "Cancelada",
                            }[order.status]
                          }
                        </span>
                      </div>
                      <h3>
                        <Link to={`/service-orders/${order.id}`}>
                          {order.client || "Cliente não informado"}
                        </Link>
                      </h3>
                      <p className="tg-muted">
                        {order.machine?.name || "Máquina não informada"} ·{" "}
                        {order.operator?.name || "Operador não informado"}
                      </p>
                      <div className="tg-order-meta">
                        <span>
                          <CalendarDays size={15} />
                          {dateLabel(order.date)}
                        </span>
                        <span>
                          <Clock3 size={15} />
                          {Number(order.total_hours || 0).toLocaleString(
                            "pt-BR",
                            { maximumFractionDigits: 1 },
                          )}{" "}
                          horas
                        </span>
                      </div>
                      <div className="tg-order-footer">
                        <strong>{money(order.total_value)}</strong>
                        <div className="tg-order-buttons">
                          <Link
                            className="tg-icon-button"
                            to={`/service-orders/${order.id}/receipt`}
                            aria-label={`Folha da OS ${order.id.slice(0, 8)}`}
                            title="Folha de serviço"
                          >
                            <FileText size={19} />
                          </Link>
                          <Link
                            className="tg-button tg-button-secondary"
                            to={`/service-orders/${order.id}`}
                          >
                            Abrir OS <ArrowUpRight size={16} />
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};
