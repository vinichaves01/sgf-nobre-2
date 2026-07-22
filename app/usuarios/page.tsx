"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileNav from "@/components/MobileNav";
import { supabase } from "@/lib/supabase";

type TipoPerfil = "Administrador" | "Motorista";

type Usuario = {
  id: string;
  email: string;
  nome: string;
  tipo: TipoPerfil;
  ativo: boolean;
  motorista_id: string | null;
  criado_em: string;
  ultimo_acesso: string | null;
};

type Motorista = { id: string; nome: string; email: string | null; status: string };

const inicial = {
  nome: "",
  email: "",
  senha: "",
  tipo: "Motorista" as TipoPerfil,
  motorista_id: "",
};

export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [formulario, setFormulario] = useState(inicial);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const requisicao = useCallback(async (opcoes?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      throw new Error("Sessão expirada.");
    }
    const resposta = await fetch("/api/admin/usuarios", {
      ...opcoes,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(opcoes?.headers ?? {}),
      },
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível concluir a operação.");
    return dados;
  }, [router]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [{ usuarios: lista }, motoristasResultado] = await Promise.all([
        requisicao(),
        supabase.from("motoristas").select("id, nome, email, status").order("nome"),
      ]);
      if (motoristasResultado.error) throw motoristasResultado.error;
      setUsuarios(lista ?? []);
      setMotoristas(motoristasResultado.data ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar usuários.");
    } finally {
      setCarregando(false);
    }
  }, [requisicao]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true); setErro(""); setMensagem("");
    try {
      await requisicao({ method: "POST", body: JSON.stringify(formulario) });
      setFormulario(inicial); setMostrarFormulario(false);
      setMensagem("Conta criada com sucesso. Entregue o e-mail e a senha inicial ao usuário.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar conta.");
    } finally { setSalvando(false); }
  }

  async function alterarPerfil(usuario: Usuario, alteracoes: Partial<Usuario>) {
    setErro(""); setMensagem("");
    try {
      await requisicao({
        method: "PATCH",
        body: JSON.stringify({
          id: usuario.id,
          acao: "atualizar_perfil",
          nome: alteracoes.nome ?? usuario.nome,
          tipo: alteracoes.tipo ?? usuario.tipo,
          ativo: alteracoes.ativo ?? usuario.ativo,
          motorista_id: alteracoes.motorista_id ?? usuario.motorista_id,
        }),
      });
      setMensagem("Conta atualizada.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao atualizar conta."); }
  }

  async function redefinirSenha(usuario: Usuario) {
    const senha = window.prompt(`Digite a nova senha para ${usuario.nome}:`);
    if (senha === null) return;
    try {
      await requisicao({ method: "PATCH", body: JSON.stringify({ id: usuario.id, acao: "redefinir_senha", senha }) });
      setMensagem("Senha redefinida. A senha anterior deixou de funcionar."); setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao redefinir senha."); }
  }

  async function alterarEmail(usuario: Usuario) {
    const email = window.prompt("Digite o novo e-mail:", usuario.email);
    if (email === null || email.trim() === usuario.email) return;
    try {
      await requisicao({ method: "PATCH", body: JSON.stringify({ id: usuario.id, acao: "alterar_email", email }) });
      setMensagem("E-mail alterado."); setErro(""); await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao alterar e-mail."); }
  }

  async function excluirConta(usuario: Usuario) {
    const confirmacao = window.prompt(
      `Para excluir definitivamente a conta de ${usuario.nome}, digite EXCLUIR:`
    );
    if (confirmacao !== "EXCLUIR") return;

    setErro("");
    setMensagem("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        throw new Error("Sessão expirada.");
      }
      const resposta = await fetch(`/api/admin/usuarios?id=${encodeURIComponent(usuario.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível excluir a conta.");
      setMensagem("Conta excluída definitivamente. O cadastro e o histórico do motorista foram preservados.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir conta.");
    }
  }

  function dataHora(valor: string | null) {
    return valor ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor)) : "Nunca acessou";
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-28 md:pb-8">
      <header className="border-b bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold text-slate-950">Usuários e acessos</h1><p className="mt-1 text-sm text-slate-500">Crie contas, vincule motoristas e controle o acesso ao SGF.</p></div>
          <div className="flex gap-2"><Link href="/" className="rounded-xl border bg-white px-4 py-3 font-semibold">Voltar</Link><button onClick={() => setMostrarFormulario((v) => !v)} className="rounded-xl bg-amber-500 px-4 py-3 font-bold text-slate-950">+ Nova conta</button></div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-4 sm:p-6">
        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">{mensagem}</div>}

        {mostrarFormulario && (
          <form onSubmit={criar} className="mb-6 rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Criar nova conta</h2>
            <p className="mt-1 text-sm text-slate-500">A senha inicial aparece somente agora; depois poderá apenas ser redefinida.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Campo rotulo="Nome completo"><input required value={formulario.nome} onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })} className="w-full rounded-xl border px-4 py-3" /></Campo>
              <Campo rotulo="E-mail de acesso"><input required type="email" value={formulario.email} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} className="w-full rounded-xl border px-4 py-3" /></Campo>
              <Campo rotulo="Senha inicial"><input required minLength={6} type="text" value={formulario.senha} onChange={(e) => setFormulario({ ...formulario, senha: e.target.value })} className="w-full rounded-xl border px-4 py-3" /></Campo>
              <Campo rotulo="Perfil"><select value={formulario.tipo} onChange={(e) => setFormulario({ ...formulario, tipo: e.target.value as TipoPerfil, motorista_id: e.target.value === "Administrador" ? "" : formulario.motorista_id })} className="w-full rounded-xl border px-4 py-3"><option>Motorista</option><option>Administrador</option></select></Campo>
              {formulario.tipo === "Motorista" && <Campo rotulo="Motorista vinculado"><select required value={formulario.motorista_id} onChange={(e) => setFormulario({ ...formulario, motorista_id: e.target.value })} className="w-full rounded-xl border px-4 py-3"><option value="">Selecione...</option>{motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome} — {m.status}</option>)}</select></Campo>}
            </div>
            <div className="mt-5 flex gap-3"><button disabled={salvando} className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white disabled:opacity-60">{salvando ? "Criando..." : "Criar conta"}</button><button type="button" onClick={() => setMostrarFormulario(false)} className="rounded-xl bg-slate-200 px-5 py-3 font-semibold">Cancelar</button></div>
          </form>
        )}

        <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Contas cadastradas</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{usuarios.length}</span></div>
          {carregando ? <p className="mt-6 text-slate-500">Carregando contas...</p> : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {usuarios.map((u) => (
                <article key={u.id} className={`rounded-2xl border p-4 ${u.ativo ? "bg-white" : "bg-slate-100 opacity-75"}`}>
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{u.nome || "Sem nome"}</h3><p className="text-sm text-slate-500">{u.email}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${u.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{u.ativo ? "Ativo" : "Bloqueado"}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-slate-500">Perfil</span><p className="font-semibold">{u.tipo}</p></div><div><span className="text-slate-500">Último acesso</span><p className="font-semibold">{dataHora(u.ultimo_acesso)}</p></div></div>
                  {u.tipo === "Motorista" && <div className="mt-4"><label className="text-sm text-slate-500">Motorista vinculado</label><select value={u.motorista_id ?? ""} onChange={(e) => void alterarPerfil(u, { motorista_id: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Não vinculado</option>{motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>}
                  <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void alterarEmail(u)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Alterar e-mail</button><button onClick={() => void redefinirSenha(u)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Nova senha</button><button onClick={() => void alterarPerfil(u, { ativo: !u.ativo })} className={`rounded-lg px-3 py-2 text-sm font-bold text-white ${u.ativo ? "bg-red-600" : "bg-green-600"}`}>{u.ativo ? "Bloquear" : "Liberar"}</button><button onClick={() => void excluirConta(u)} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700">Excluir conta</button></div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <MobileNav />
    </main>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-sm font-semibold text-slate-700">{rotulo}</span>{children}</label>;
}
