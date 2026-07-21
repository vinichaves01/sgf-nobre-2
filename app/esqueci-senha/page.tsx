"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviarRecuperacao(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setEnviando(true);
    setMensagem("");
    setErro("");

    const emailLimpo = email.trim().toLowerCase();

    if (!emailLimpo) {
      setErro("Informe o seu e-mail.");
      setEnviando(false);
      return;
    }

    const enderecoAtual = window.location.origin;

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        emailLimpo,
        {
          redirectTo: `${enderecoAtual}/redefinir-senha`,
        }
      );

    if (error) {
      setErro(
        `Não foi possível enviar o e-mail: ${error.message}`
      );
      setEnviando(false);
      return;
    }

    setMensagem(
      "E-mail enviado. Verifique sua caixa de entrada e também a pasta de spam."
    );

    setEnviando(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-400">
            Nobre
          </p>

          <h1 className="mt-3 text-3xl font-bold text-white">
            Recuperar senha
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Enviaremos um link seguro para o seu e-mail.
          </p>
        </div>

        <form
          onSubmit={enviarRecuperacao}
          className="rounded-3xl border border-slate-800 bg-white p-7 shadow-2xl"
        >
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            E-mail cadastrado
          </label>

          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(evento) =>
              setEmail(evento.target.value)
            }
            placeholder="seuemail@empresa.com"
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
            disabled={enviando}
            className="mt-6 w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
          >
            {enviando
              ? "Enviando..."
              : "Enviar link de recuperação"}
          </button>

          <Link
            href="/login"
            className="mt-5 block text-center text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            Voltar para o login
          </Link>
        </form>
      </div>
    </main>
  );
}