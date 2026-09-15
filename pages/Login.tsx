import React, { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Loader2,
  Truck,
  Clock3,
  Wallet,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

import { Brand } from "../components/Layout";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (authError) throw authError;
    } catch (err: any) {
      setError("Não foi possível entrar com Google. Tente novamente.");
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

      if (authError) throw authError;

      if (authData.user) {
        await refreshProfile();
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(
        err.code === "invalid_credentials"
          ? "E-mail ou senha incorretos. Confira os dados e tente novamente."
          : err.code === "email_not_confirmed"
            ? "Confirme seu e-mail para acessar sua conta."
            : "Não foi possível entrar. Confira sua conexão e tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tg-auth">
      <aside className="tg-auth-brand">
        <Brand />
        <div className="tg-auth-story">
          <p className="tg-eyebrow">Do campo ao escritório</p>
          <h2>
            Mais controle.
            <br />
            Mais tempo para fazer acontecer.
          </h2>
          <p>Sua operação conectada, com as informações certas sempre à mão.</p>
          <ul>
            <li>
              <Truck size={22} /> Frota e serviços no mesmo lugar
            </li>
            <li>
              <Clock3 size={22} /> Horas registradas com clareza
            </li>
            <li>
              <Wallet size={22} /> Financeiro que acompanha a operação
            </li>
          </ul>
        </div>
        <span className="tg-auth-story tg-muted">
          TerraGes · Gestão de operações
        </span>
      </aside>
      <main className="tg-auth-main">
        <div className="tg-auth-form">
          <p className="tg-eyebrow">Bem-vindo ao TerraGes</p>
          <h1>Vamos ao trabalho?</h1>
          <p>Entre na sua conta para acompanhar sua operação.</p>
          <form onSubmit={handleLogin}>
            {error && (
              <div role="alert" className="tg-alert">
                {error}
              </div>
            )}
            <div className="tg-field">
              <label htmlFor="login-email">E-mail</label>
              <div className="tg-input">
                <Mail size={18} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="voce@empresa.com.br"
                />
              </div>
            </div>
            <div className="tg-field">
              <label htmlFor="login-password">Senha</label>
              <div className="tg-input">
                <Lock size={18} />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Link className="tg-link" to="/forgot-password">
              Esqueci minha senha
            </Link>
            <button className="tg-button" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={19} className="tg-spin" />
                  Entrando…
                </>
              ) : (
                <>
                  Entrar na minha conta <ArrowRight size={18} />
                </>
              )}
            </button>
            <div className="tg-divider">ou continue com</div>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleLogin}
              className="tg-button tg-button-secondary"
            >
              Entrar com Google
            </button>
          </form>
          <div className="tg-auth-footer">
            Sua empresa ainda não usa o TerraGes?
            <br />
            <Link to="/signup">
              Cadastrar empresa <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
