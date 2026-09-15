import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Plus,
  Wallet,
  Clock3,
  ClipboardList,
  MessageSquare,
  Truck,
  CalendarDays,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";
import { isAdminUser } from "../services/roleService";
import { supabase } from "../services/supabaseClient";
import {
  dashboardMetrics,
  type DashboardTransaction,
} from "../services/dashboardMetrics";

const money = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
type Data = ReturnType<typeof dashboardMetrics> & {
  pendingOrders: number;
  hours: number;
  transactions: DashboardTransaction[];
};

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const admin = isAdminUser(profile?.role);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  async function refresh() {
    if (!profile) return;
    setLoading(true);
    setError("");
    const now = new Date(),
      start = localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      end = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    try {
      // Paginate to avoid silently truncating financial and hour totals at the API row limit.
      async function transactions() {
        const rows: DashboardTransaction[] = [];
        if (!admin) return rows;
        for (let from = 0; ; from += 1000) {
          const r = await supabase
            .from("transactions")
            .select("id,type,amount,date,title,status")
            .gte(
              "date",
              localDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
            )
            .lte("date", end)
            .order("date", { ascending: false })
            .order("id")
            .range(from, from + 999);
          if (r.error) throw r.error;
          rows.push(...(r.data || []));
          if ((r.data?.length || 0) < 1000) return rows;
        }
      }
      async function hours() {
        let total = 0;
        for (let from = 0; ; from += 1000) {
          const r = await supabase
            .from("hora_maquina")
            .select("total_hours")
            .gte("date", start)
            .lte("date", end)
            .order("id")
            .range(from, from + 999);
          if (r.error) throw r.error;
          total += (r.data || []).reduce(
            (sum, row) => sum + Number(row.total_hours || 0),
            0,
          );
          if ((r.data?.length || 0) < 1000) return total;
        }
      }
      const [tx, hourTotal, os] = await Promise.all([
        transactions(),
        hours(),
        supabase
          .from("service_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      if (os.error) throw os.error;
      setData({
        ...dashboardMetrics(tx, now),
        hours: hourTotal,
        pendingOrders: os.count || 0,
        transactions: tx.slice(0, 5),
      });
    } catch {
      setError(
        "Não foi possível atualizar os indicadores. Tente novamente para consultar os valores.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setData(null);
    void refresh();
  }, [profile?.id, profile?.company_id, admin]);
  const month = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return (
    <Layout>
      <Layout.Header
        title="Visão geral"
        subTitle={profile?.company_name || "Sua operação em um só lugar"}
      />
      <Layout.Content>
        <div className="tg-page">
          <div className="tg-page-heading">
            <div>
              <p className="tg-eyebrow">Seu centro de operações</p>
              <h2>Olá, {profile?.name?.split(" ")[0] || "bem-vindo"}.</h2>
              <p className="tg-muted">
                {admin
                  ? "Um olhar claro sobre o trabalho e os resultados."
                  : "Tudo pronto para mais um dia em campo."}
              </p>
            </div>
            <div className="tg-actions">
              <button
                className="tg-button tg-button-secondary"
                disabled={loading}
                onClick={refresh}
              >
                <RefreshCw size={16} className={loading ? "tg-spin" : ""} />
                Atualizar
              </button>
              <Link className="tg-button" to="/service-orders/new">
                <Plus size={18} />
                Nova ordem
              </Link>
            </div>
          </div>
          <div className="tg-period">
            <CalendarDays size={16} />
            <span>{month}</span>
            <span className="tg-muted">· Indicadores do mês</span>
          </div>
          {error ? (
            <div role="alert" className="tg-alert">
              {error}
            </div>
          ) : loading ? (
            <div
              className="tg-kpis"
              role="status"
              aria-label="Carregando indicadores"
            >
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="tg-skeleton" />
              ))}
            </div>
          ) : (
            data && (
              <>
                <div className="tg-kpis">
                  {admin ? (
                    <>
                      <Metric
                        label="Saldo realizado"
                        value={money(data.balance)}
                        note="Recebido menos pago no mês"
                        icon={Wallet}
                        featured
                      />
                      <Metric
                        label="Recebido"
                        value={money(data.received)}
                        note="Entradas confirmadas no mês"
                        icon={ArrowDownLeft}
                      />
                      <Metric
                        label="Pago"
                        value={money(data.spent)}
                        note="Saídas confirmadas no mês"
                        icon={ArrowUpRight}
                      />
                      <Metric
                        label="A receber"
                        value={money(data.receivable)}
                        note="Receitas pendentes do mês"
                        icon={Clock3}
                      />
                    </>
                  ) : (
                    <>
                      <Metric
                        label="Horas registradas"
                        value={`${data.hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`}
                        note="Registros deste mês"
                        icon={Clock3}
                        featured
                      />
                      <Metric
                        label="Ordens pendentes"
                        value={String(data.pendingOrders)}
                        note="Todos os períodos"
                        icon={ClipboardList}
                      />
                    </>
                  )}
                </div>
                <div className="tg-dashboard-grid">
                  {admin ? (
                    <section className="tg-panel">
                      <div className="tg-panel-heading">
                        <div>
                          <h3>Movimentação financeira</h3>
                          <span className="tg-muted">
                            Valores confirmados · últimos 6 meses
                          </span>
                        </div>
                      </div>
                      {data.months.some((m) => m.receita || m.despesa) ? (
                        <>
                          <div
                            className="tg-chart"
                            role="img"
                            aria-label="Evolução das receitas recebidas e despesas pagas. Valores disponíveis na tabela abaixo."
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={data.months}
                                margin={{
                                  top: 8,
                                  right: 20,
                                  bottom: 0,
                                  left: 0,
                                }}
                              >
                                <CartesianGrid
                                  stroke="var(--tg-line)"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="mes"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{
                                    fill: "var(--tg-muted)",
                                    fontSize: 12,
                                  }}
                                  dy={8}
                                />
                                <YAxis
                                  width={54}
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{
                                    fill: "var(--tg-muted)",
                                    fontSize: 12,
                                  }}
                                  tickFormatter={(n) =>
                                    Math.abs(n) >= 1000
                                      ? `${n / 1000} mil`
                                      : String(n)
                                  }
                                />
                                <Tooltip
                                  formatter={(value) => money(Number(value))}
                                  contentStyle={{
                                    borderRadius: 10,
                                    border: "1px solid var(--tg-line)",
                                    background: "var(--tg-card)",
                                    color: "var(--tg-ink)",
                                    fontSize: 13,
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="receita"
                                  name="Recebido"
                                  stroke="#27825b"
                                  fill="#27825b"
                                  fillOpacity={0.1}
                                  strokeWidth={2.5}
                                  isAnimationActive={false}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="despesa"
                                  name="Pago"
                                  stroke="#e58b4f"
                                  fill="#e58b4f"
                                  fillOpacity={0.03}
                                  strokeWidth={2}
                                  isAnimationActive={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="tg-chart-legend">
                            <span>
                              <i className="tg-dot" />
                              Recebido
                            </span>
                            <span>
                              <i className="tg-dot tg-dot-orange" />
                              Pago
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="tg-empty">
                          <Wallet size={30} />
                          <h3>Acompanhe a evolução do seu caixa</h3>
                          <p>
                            O gráfico aparece quando houver recebimentos ou
                            pagamentos confirmados.
                          </p>
                          <Link
                            className="tg-button tg-button-secondary"
                            to="/finance"
                          >
                            Abrir financeiro
                          </Link>
                        </div>
                      )}
                      <details className="tg-chart-data">
                        <summary>Ver valores por mês</summary>
                        <table>
                          <caption className="sr-only">
                            Movimentação confirmada nos últimos seis meses
                          </caption>
                          <thead>
                            <tr>
                              <th>Mês</th>
                              <th>Recebido</th>
                              <th>Pago</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.months.map((m) => (
                              <tr key={m.key}>
                                <th scope="row">{m.mes}</th>
                                <td>{money(m.receita)}</td>
                                <td>{money(m.despesa)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    </section>
                  ) : (
                    <section className="tg-panel">
                      <div className="tg-panel-heading">
                        <h3>Registrar trabalho</h3>
                      </div>
                      <Task
                        to="/hora-maquina"
                        icon={Clock3}
                        title="Horas trabalhadas"
                        detail="Registre o tempo de operação"
                      />
                      <Task
                        to="/rdo/new"
                        icon={FileText}
                        title="Novo diário de obra"
                        detail="Organize o que aconteceu no campo"
                      />
                      <Task
                        to="/service-orders/new"
                        icon={ClipboardList}
                        title="Nova ordem de serviço"
                        detail="Cliente, máquina e execução"
                      />
                    </section>
                  )}
                  <section className="tg-panel">
                    <div className="tg-panel-heading">
                      <h3>{admin ? "Acompanhe a operação" : "Seus atalhos"}</h3>
                      <span className="tg-badge">Dia a dia</span>
                    </div>
                    <Task
                      to="/service-orders"
                      icon={ClipboardList}
                      title={`${data.pendingOrders} ${data.pendingOrders === 1 ? "ordem pendente" : "ordens pendentes"}`}
                      detail="Serviços em aberto · todos os períodos"
                    />
                    <Task
                      to="/whatsapp-inbox"
                      icon={MessageSquare}
                      title="Caixa de entrada"
                      detail="Confira os envios pelo WhatsApp"
                    />
                    {admin && (
                      <Task
                        to="/hora-maquina"
                        icon={Clock3}
                        title={`${data.hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h registradas`}
                        detail="Horas de operação neste mês"
                      />
                    )}
                    <Task
                      to={admin ? "/fleet" : "/schedule/new"}
                      icon={admin ? Truck : CalendarDays}
                      title={admin ? "Minha frota" : "Novo agendamento"}
                      detail={
                        admin
                          ? "Máquinas, informações e disponibilidade"
                          : "Planeje seu próximo serviço"
                      }
                    />
                  </section>
                </div>
                {admin && (
                  <section className="tg-panel">
                    <div className="tg-panel-heading">
                      <div>
                        <h3>Últimos lançamentos</h3>
                        <span className="tg-muted">
                          Por data · nos últimos 6 meses
                        </span>
                      </div>
                      <Link className="tg-link" to="/finance">
                        Ver todos <ArrowRight size={16} />
                      </Link>
                    </div>
                    {data.transactions.length ? (
                      data.transactions.map((tx) => (
                        <div className="tg-transaction" key={tx.id}>
                          <span className="tg-task-icon">
                            {tx.type === "income" ? (
                              <ArrowDownLeft size={19} />
                            ) : (
                              <ArrowUpRight size={19} />
                            )}
                          </span>
                          <div>
                            <strong>{tx.title}</strong>
                            <small>
                              {new Date(
                                `${tx.date.slice(0, 10)}T12:00:00`,
                              ).toLocaleDateString("pt-BR")}
                            </small>
                          </div>
                          <div className="tg-transaction-amount">
                            <strong
                              className={
                                tx.type === "income"
                                  ? "tg-positive"
                                  : "tg-negative"
                              }
                            >
                              {tx.type === "expense" ? "− " : "+ "}
                              {money(Number(tx.amount))}
                            </strong>
                            <span className={`tg-badge tg-badge-${tx.status}`}>
                              {tx.status === "paid"
                                ? tx.type === "income"
                                  ? "Recebido"
                                  : "Pago"
                                : tx.status === "pending"
                                  ? "Pendente"
                                  : tx.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="tg-empty">
                        Seus lançamentos financeiros aparecerão aqui.
                      </div>
                    )}
                  </section>
                )}
              </>
            )
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};
function Metric({
  label,
  value,
  note,
  icon: Icon,
  featured = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ElementType;
  featured?: boolean;
}) {
  return (
    <section className={`tg-panel tg-kpi${featured ? " tg-kpi-featured" : ""}`}>
      <span className="tg-kpi-label">
        <Icon size={16} />
        {label}
      </span>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
function Task({
  to,
  icon: Icon,
  title,
  detail,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  detail: string;
}) {
  return (
    <Link className="tg-task" to={to}>
      <span className="tg-task-icon">
        <Icon size={19} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <ArrowUpRight size={17} />
    </Link>
  );
}
