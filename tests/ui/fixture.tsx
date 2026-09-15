// Development-only visual harness. Not a production entry point; no real data or writes.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabaseClient";
import { serviceOrderService } from "../../services/serviceOrderService";
import { machineService } from "../../services/machineService";
import { employeeService } from "../../services/employeeService";
import { Dashboard } from "../../pages/Dashboard";
import { ServiceOrderList } from "../../pages/ServiceOrderList";
import { ServiceOrderForm } from "../../pages/ServiceOrderForm";
import { WhatsAppInbox } from "../../pages/WhatsAppInbox";
import { Login } from "../../pages/Login";
import "../../index.css";
import "../../styles/workspace.css";
if (!import.meta.env.DEV) throw new Error("Visual fixture is development-only");
const params = new URLSearchParams(location.search);
const now = new Date();
const date = (offset = 0) =>
  new Date(now.getFullYear(), now.getMonth() - offset, 12, 12)
    .toISOString()
    .slice(0, 10);
const empty = params.get("state") === "empty",
  failure = params.get("state") === "error";
const orders: any[] = empty
  ? []
  : [
      {
        id: "a1100000-0000-0000-0000-000000000001",
        client: "Residencial Jardim das Araucárias",
        date: date(),
        status: "pending",
        total_hours: 8.5,
        total_value: 2550,
        machine: { name: "Escavadeira CAT 320" },
        operator: { name: "Carlos Silva" },
      },
      {
        id: "b2200000-0000-0000-0000-000000000002",
        client: "Construtora Horizonte",
        date: date(),
        status: "completed",
        total_hours: 16,
        total_value: 4800,
        machine: { name: "Retroescavadeira JCB 3CX" },
        operator: { name: "João Santos" },
      },
      {
        id: "c3300000-0000-0000-0000-000000000003",
        client: "Sítio Boa Vista",
        date: date(),
        status: "pending",
        total_hours: 6,
        total_value: 1800,
        machine: { name: "Escavadeira CAT 320" },
        operator: { name: "Carlos Silva" },
      },
    ];
const tx = empty
  ? []
  : Array.from({ length: 6 }, (_, i) => [
      {
        id: `income-${i}`,
        type: "income",
        status: "paid",
        title: "Serviços de terraplenagem",
        date: date(i),
        amount: 38500 - i * 2900,
      },
      {
        id: `expense-${i}`,
        type: "expense",
        status: "paid",
        title: "Combustível e manutenção",
        date: date(i),
        amount: 14600 - i * 1100,
      },
      {
        id: `pending-${i}`,
        type: "income",
        status: "pending",
        title: "Locação de equipamentos",
        date: date(i),
        amount: 8200,
      },
    ]).flat();
const entries = empty
  ? []
  : [
      {
        id: "evt-1",
        kind: "audio",
        status: "needs_review",
        created_at: new Date().toISOString(),
        text_content:
          "Hoje trabalhei 8 horas com a escavadeira na obra Jardim das Araucárias. Serviço de abertura de fundação.",
        attempts: 1,
        updated_at: new Date().toISOString(),
      },
      {
        id: "evt-2",
        kind: "document",
        status: "processing",
        created_at: new Date().toISOString(),
        text_content: "Documento recebido. Aguardando processamento.",
        attempts: 1,
        updated_at: new Date().toISOString(),
      },
      {
        id: "evt-3",
        kind: "image",
        status: "failed",
        created_at: new Date().toISOString(),
        text_content: "Sem transcrição disponível.",
        attempts: 5,
        error_code: "test",
        updated_at: new Date().toISOString(),
      },
    ];
const blocked = async () => {
  throw new Error("Writes disabled in visual fixture");
};
const machines = [{ id: "machine-1", name: "Escavadeira CAT 320" }];
supabase.from = ((table: string) => {
  let from = 0;
  const result = () => ({
    data: failure
      ? null
      : table === "transactions"
        ? tx
        : table === "hora_maquina"
          ? empty
            ? []
            : [{ total_hours: 248 }]
          : table === "whatsapp_inbound_events"
            ? entries
            : table === "machines"
              ? machines
              : orders,
    error: failure ? new Error("Fixture error") : null,
    count: empty ? 0 : 2,
  });
  const query: any = {
    select: () => query,
    gte: () => query,
    lte: () => query,
    order: () => query,
    eq: () => query,
    limit: () => query,
    range: (start: number) => {
      from = start;
      return query;
    },
    then: (resolve: any) =>
      Promise.resolve(from ? { data: [], error: null } : result()).then(
        resolve,
      ),
    insert: blocked,
    update: blocked,
    delete: blocked,
  };
  return query;
}) as any;
supabase.rpc = (async (name: string) =>
  name === "my_whatsapp_status"
    ? { data: true, error: null }
    : blocked()) as any;
supabase.functions.invoke = blocked as any;
serviceOrderService.getAll = async () => {
  if (failure) throw new Error("Fixture error");
  return orders;
};
serviceOrderService.create = blocked;
serviceOrderService.update = blocked;
machineService.getAll = async () => machines as any;
employeeService.getAll = async () =>
  [{ id: "employee-1", name: "Carlos Silva" }] as any;
document.documentElement.style.fontSize = `${params.get("scale") || 16}px`;
createRoot(document.getElementById("root")!).render(
  <AuthContext.Provider
    value={{
      profile: {
        id: "visual-fixture",
        name: "Felipe Kalinovski",
        company_name: "TerraGes · Empresa de exemplo",
        company_id: "fixture-company",
        role: params.get("role") || "admin",
      } as any,
      session: null,
      user: null,
      loading: false,
      signOut: blocked,
      refreshProfile: blocked,
    }}
  >
    <MemoryRouter initialEntries={["/" + (params.get("page") || "dashboard")]}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/service-orders" element={<ServiceOrderList />} />
        <Route path="/service-orders/new" element={<ServiceOrderForm />} />
        <Route path="/whatsapp-inbox" element={<WhatsAppInbox />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<p>Destino fora da revisão visual.</p>} />
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>,
);
