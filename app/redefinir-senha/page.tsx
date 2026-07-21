"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RedefinirSenhaPage() {
  const router = useRouter();

  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] =
    useState("");

  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [sessaoValida, setSessaoValida] =
    useState(false);

  useEffect(() => {
    async function verificarRecuperacao() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setSessaoValida(true);
        setVerificando(false);
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(
        (evento, sessao) => {
          if (
            evento === "PASSWORD_RECOVERY" ||
            sessao
          ) {
            setSessaoValida(true);
            setVerificando(false);
          }
        }
      );

      window.setTimeout(() => {
        setVerificando(false);
      }, 3000);

      return () => subscription.unsubscribe();
    }

    verificarRecuperacao();
  }, []);

  async function alterarSenha(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setErro("");
    setMensagem("");

    if (senha.length < 8) {
      setErro(
        "A nova senha deve possuir pelo menos 8 caracteres."
      );
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);

    const { error } = await supabase.auth.updateUser({
      password: senha,
    });

    if (error) {
      setErro(
        `Não foi possível alterar a senha: ${error.message}`
      );
      setSalvando(false);
      return;
    }

    setMensagem(
      "Senha alterada com sucesso. Você já pode entrar no sistema."
    );

    setSenha("");
    setConfirmarSenha("");
    setSalvando(false);

    await supabase.auth.signOut();

    window.setTimeout(() => {
      router.replace("/login");
    }, 2000);
  }

  if (verificando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="text-center">
          <p className="text-lg font-semibold">
            Verificando link...
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Aguarde um instante.
          </p>
        </div>
      </main>
    );
  }

  if (!sessaoValida) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Link inválido ou expirado
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Solicite um novo link para redefinir sua senha.
          </p>

          <Link
            href="/esqueci-senha"
            className="mt-6 block rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950"
          >
            Solicitar novo link
          </Link>
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
            Criar nova senha
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Digite e confirme sua nova senha.
          </p>
        </div>

        <form
          onSubmit={alterarSenha}
          className="rounded-3xl border border-slate-800 bg-white p-7 shadow-2xl"
        >
          <label
            htmlFor="senha"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Nova senha
          </label>

          <input
            id="senha"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={senha}
            onChange={(evento) =>
              setSenha(evento.target.value)
            }
            placeholder="Mínimo de 8 caracteres"
            className="w-full rounded-xl border px-4 py-3 text-slate-900 outline-none focus:border-amber-500"
          />

          <label
            htmlFor="confirmarSenha"
            className="mb-2 mt-5 block text-sm font-semibold text-slate-700"
          >
            Confirmar nova senha
          </label>

          <input
            id="confirmarSenha"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmarSenha}
            onChange={(evento) =>
              setConfirmarSenha(evento.target.value)
            }
            placeholder="Digite novamente"
            className="w-full rounded-xl border px-4 py-3 text-slate-900 outline-none focus:border-amber-500"
          />

          {mensagem && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {mensagem}
            </div>
          )}

          {erro && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="mt-6 w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
          >
            {salvando
              ? "Salvando..."
              : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </main>
  );
}