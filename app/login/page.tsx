"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  nome: string;
  tipo: "Administrador" | "Motorista";
  ativo: boolean;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [verificandoSessao, setVerificandoSessao] =
    useState(true);

  useEffect(() => {
    async function verificarSessaoExistente() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setVerificandoSessao(false);
        return;
      }

      await redirecionarPorPerfil(user.id);
    }

    verificarSessaoExistente();
  }, []);

  async function redirecionarPorPerfil(userId: string) {
    const { data, error } = await supabase
      .from("perfis")
      .select("id, nome, tipo, ativo")
      .eq("id", userId)
      .maybeSingle<Perfil>();

    if (error) {
      await supabase.auth.signOut();

      setMensagem(
        `Não foi possível consultar o perfil: ${error.message}`
      );

      setVerificandoSessao(false);
      setCarregando(false);
      return;
    }

    if (!data) {
      await supabase.auth.signOut();

      setMensagem(
        "Este usuário ainda não possui um perfil de acesso."
      );

      setVerificandoSessao(false);
      setCarregando(false);
      return;
    }

    if (!data.ativo) {
      await supabase.auth.signOut();

      setMensagem(
        "Este usuário está desativado. Procure o administrador."
      );

      setVerificandoSessao(false);
      setCarregando(false);
      return;
    }

    if (data.tipo === "Administrador") {
      router.replace("/");
      router.refresh();
      return;
    }

    router.replace("/motorista");
    router.refresh();
  }

  async function entrar(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setCarregando(true);
    setMensagem("");

    const emailLimpo = email.trim().toLowerCase();

    if (!emailLimpo || !senha) {
      setMensagem("Informe o e-mail e a senha.");
      setCarregando(false);
      return;
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha,
      });

    if (error) {
      setMensagem(
        "E-mail ou senha incorretos. Confira os dados e tente novamente."
      );

      setCarregando(false);
      return;
    }

    if (!data.user) {
      setMensagem(
        "Não foi possível identificar o usuário."
      );

      setCarregando(false);
      return;
    }

    await redirecionarPorPerfil(data.user.id);
  }

  if (verificandoSessao) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="text-center">
          <p className="text-lg font-semibold">
            Verificando acesso...
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Aguarde um instante.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-400">
            Nobre
          </p>

          <h1 className="mt-3 text-3xl font-bold text-white">
            Acesso ao SGF
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Sistema de Gestão de Frota
          </p>
        </div>

        <form
          onSubmit={entrar}
          className="rounded-3xl border border-slate-800 bg-white p-7 shadow-2xl"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(evento) =>
                setEmail(evento.target.value)
              }
              placeholder="seuemail@empresa.com"
              className="w-full rounded-xl border px-4 py-3 text-slate-900 outline-none focus:border-amber-500"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="senha"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Senha
            </label>

            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(evento) =>
                setSenha(evento.target.value)
              }
              placeholder="Digite sua senha"
              className="w-full rounded-xl border px-4 py-3 text-slate-900 outline-none focus:border-amber-500"
            />
          </div>

          {mensagem && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {mensagem}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="mt-6 w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando
              ? "Entrando..."
              : "Entrar no sistema"}
          </button>

          <p className="mt-5 text-center text-xs text-slate-400">
            Acesso autorizado somente para usuários
            cadastrados.
          </p>
        </form>
      </div>
    </main>
  );
}