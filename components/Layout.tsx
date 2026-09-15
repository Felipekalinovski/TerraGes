import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { UserProfile } from "../services/userService";
import { isAdminUser, getRoleLabel } from "../services/roleService";
import { ThemeToggle } from "./ThemeToggle";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock3,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  Truck,
  Users,
  Wallet,
  Wrench,
  X,
  FileText,
  MapPin,
} from "lucide-react";
import "../styles/workspace.css";

interface LayoutState {
  open: boolean;
  setOpen: (open: boolean) => void;
  profile: UserProfile | null;
}
const LayoutContext = createContext<LayoutState | null>(null);
function useLayout() {
  const value = useContext(LayoutContext);
  if (!value) throw new Error("Layout required");
  return value;
}
interface HeaderProps {
  title: string;
  subTitle?: string;
  showBack?: boolean;
  onBackClick?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}
interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  title?: string;
  showBack?: boolean;
}

export const Layout: React.FC<LayoutProps> & {
  Header: React.FC<HeaderProps>;
  Sidebar: React.FC;
  Content: React.FC<{ children: React.ReactNode }>;
  Navigation: React.FC;
} = ({ children, hideNav = false, title, showBack }) => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  return (
    <LayoutContext.Provider value={{ open, setOpen, profile }}>
      <div className="tg-app">
        <a href="#main-content" className="tg-skip">
          Pular para o conteúdo
        </a>
        <Layout.Sidebar />
        <div className="tg-workspace">
          {title && <Layout.Header title={title} showBack={showBack} />}
          {children}
        </div>
        {!hideNav && <Layout.Navigation />}
      </div>
    </LayoutContext.Provider>
  );
};

export function Brand() {
  return (
    <div className="tg-brand">
      <span className="tg-brand-mark">
        <HardHat size={23} strokeWidth={2} />
      </span>
      <span>
        Terra<span className="tg-brand-accent">Ges</span>
        <small>Gestão de operações</small>
      </span>
    </div>
  );
}

Layout.Header = ({
  title,
  subTitle,
  showBack,
  onBackClick,
  actions,
  children,
}) => {
  const { setOpen, profile } = useLayout();
  const navigate = useNavigate();
  return (
    <header className="tg-header">
      <div className="tg-header-title">
        {showBack ? (
          <button
            className="tg-icon-button"
            onClick={onBackClick || (() => navigate(-1))}
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <button
            className="tg-icon-button tg-mobile-only"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-haspopup="dialog"
          >
            <Menu size={21} />
          </button>
        )}
        <div>
          <h1>{title}</h1>
          {subTitle && <p>{subTitle}</p>}
        </div>
      </div>
      <div className="tg-header-actions">
        {actions}
        {children}
        <ThemeToggle />
        <button
          onClick={() => navigate("/settings/profile")}
          className="tg-avatar"
          aria-label="Meu perfil"
          title={profile?.name || "Meu perfil"}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            (profile?.name || "TG")
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
          )}
        </button>
      </div>
    </header>
  );
};

type MenuItem = {
  label: string;
  path: string;
  icon: React.ElementType;
  end?: boolean;
};
function NavigationContent({ close }: { close?: () => void }) {
  const { profile } = useLayout();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const admin = isAdminUser(profile?.role);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const groups: { label: string; items: MenuItem[] }[] = [
    {
      label: "Área de trabalho",
      items: [
        { label: "Visão geral", path: "/dashboard", icon: LayoutDashboard },
        {
          label: "Caixa de entrada",
          path: "/whatsapp-inbox",
          icon: MessageSquare,
        },
        ...(admin
          ? [{ label: "Assistente IA", path: "/chat", icon: Sparkles }]
          : []),
      ],
    },
    {
      label: "Operação",
      items: [
        ...(admin ? [{ label: "Frota", path: "/fleet", icon: Truck }] : []),
        {
          label: "Ordens de serviço",
          path: "/service-orders",
          icon: ClipboardList,
        },
        { label: "Horas trabalhadas", path: "/hora-maquina", icon: Clock3 },
        {
          label: "Diário de obra",
          path: admin ? "/rdo" : "/rdo/new",
          icon: HardHat,
        },
        ...(admin
          ? [
              { label: "Agenda", path: "/schedule", icon: CalendarDays },
              { label: "Manutenções", path: "/maintenance", icon: Wrench },
              { label: "Equipe", path: "/employees", icon: Users },
            ]
          : []),
      ],
    },
    ...(admin
      ? [
          {
            label: "Gestão",
            items: [
              { label: "Orçamentos", path: "/orcamentos", icon: FileText },
              { label: "Financeiro", path: "/finance", icon: Wallet },
              { label: "Relatórios", path: "/reports", icon: BarChart3 },
              {
                label: "Relatório por cliente",
                path: "/relatorio-cliente",
                icon: FileText,
              },
              { label: "Obras", path: "/settings/projects", icon: MapPin },
              {
                label: "Configurações",
                path: "/settings",
                icon: Settings,
                end: true,
              },
            ],
          },
        ]
      : []),
  ];
  return (
    <>
      <div className="tg-sidebar-top">
        <Brand />
        {close && (
          <button
            className="tg-sidebar-close"
            onClick={close}
            aria-label="Fechar menu"
          >
            <X size={22} />
          </button>
        )}
      </div>
      <div className="tg-company">
        <span className="tg-company-icon">
          <HardHat size={17} />
        </span>
        <div>
          <strong>{profile?.company_name || "Minha empresa"}</strong>
          <small>{getRoleLabel(profile?.role)}</small>
        </div>
      </div>
      <nav className="tg-sidebar-nav" aria-label="Navegação principal">
        {groups.map((group) => (
          <div className="tg-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map(({ label, path, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                onClick={close}
                className={({ isActive }) =>
                  `tg-nav-link${isActive ? " is-active" : ""}`
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="tg-sidebar-footer">
        <div className="tg-account">
          <span className="tg-avatar">
            {(profile?.name || "TG").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{profile?.name || "Minha conta"}</strong>
            <small>{getRoleLabel(profile?.role)}</small>
          </div>
          <button
            disabled={signingOut}
            aria-label="Sair da conta"
            title="Sair da conta"
            onClick={async () => {
              setSigningOut(true);
              setError("");
              try {
                await signOut();
                navigate("/login");
              } catch {
                setError("Não foi possível sair. Tente novamente.");
                setSigningOut(false);
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    </>
  );
}

Layout.Sidebar = () => {
  const { open, setOpen } = useLayout();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <>
      <aside className="tg-sidebar tg-desktop-sidebar">
        <NavigationContent />
      </aside>
      <dialog
        ref={dialog}
        className="tg-mobile-dialog"
        aria-label="Menu de navegação"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <aside className="tg-sidebar">
          <NavigationContent close={() => setOpen(false)} />
        </aside>
      </dialog>
    </>
  );
};

Layout.Content = ({ children }) => (
  <main id="main-content" tabIndex={-1} className="tg-main">
    {children}
  </main>
);
Layout.Navigation = () => {
  const { setOpen, profile } = useLayout();
  const admin = isAdminUser(profile?.role);
  const items = [
    { label: "Início", path: "/dashboard", icon: LayoutDashboard },
    { label: "Envios", path: "/whatsapp-inbox", icon: MessageSquare },
    { label: "Serviços", path: "/service-orders", icon: ClipboardList },
    admin
      ? { label: "Financeiro", path: "/finance", icon: Wallet }
      : { label: "Horas", path: "/hora-maquina", icon: Clock3 },
  ];
  return (
    <nav className="tg-bottom-nav" aria-label="Atalhos do celular">
      {items.map(({ label, path, icon: Icon }) => (
        <NavLink
          to={path}
          key={path}
          className={({ isActive }) => (isActive ? "is-active" : "")}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
      <button onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Menu size={20} />
        <span>Menu</span>
      </button>
    </nav>
  );
};
