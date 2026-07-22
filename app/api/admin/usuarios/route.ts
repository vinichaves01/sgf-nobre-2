import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function clientes() {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Variáveis do Supabase não configuradas no servidor.");
  }

  return {
    authClient: createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    adminClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function exigirAdministrador(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) return { erro: "Sessão não informada.", status: 401 } as const;

  const { authClient, adminClient } = clientes();
  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return { erro: "Sessão inválida ou expirada.", status: 401 } as const;
  }

  const { data: perfil, error: perfilError } = await adminClient
    .from("perfis")
    .select("tipo, ativo, administrador_mestre")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (perfilError || !perfil || perfil.tipo !== "Administrador" || !perfil.ativo) {
    return { erro: "Apenas administradores podem gerenciar contas.", status: 403 } as const;
  }

  return {
    authClient,
    adminClient,
    usuarioAtualId: userData.user.id,
    usuarioAtualEmail: userData.user.email ?? "",
    usuarioAtualMestre: Boolean(perfil.administrador_mestre),
  } as const;
}

async function obterPerfil(adminClient: any, id: string) {
  const { data, error } = await adminClient
    .from("perfis")
    .select("id, nome, tipo, ativo, motorista_id, administrador_mestre")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function validarSenhaAtual(
  authClient: any,
  email: string,
  senhaAtual: string
) {
  if (!email || !senhaAtual) return false;
  const { error } = await authClient.auth.signInWithPassword({ email, password: senhaAtual });
  return !error;
}

export async function GET(request: NextRequest) {
  try {
    const acesso = await exigirAdministrador(request);
    if ("erro" in acesso) return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });

    const { data: authData, error: authError } = await acesso.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) return NextResponse.json({ erro: authError.message }, { status: 400 });

    const { data: perfis, error: perfisError } = await acesso.adminClient
      .from("perfis")
      .select("id, nome, tipo, ativo, motorista_id, updated_at, administrador_mestre");
    if (perfisError) return NextResponse.json({ erro: perfisError.message }, { status: 400 });

    const perfisPorId = new Map((perfis ?? []).map((perfil) => [perfil.id, perfil]));
    const usuarios = authData.users.map((usuario) => {
      const perfil = perfisPorId.get(usuario.id);
      return {
        id: usuario.id,
        email: usuario.email ?? "",
        nome: perfil?.nome ?? usuario.user_metadata?.nome ?? "",
        tipo: perfil?.tipo ?? "Motorista",
        ativo: perfil?.ativo ?? false,
        motorista_id: perfil?.motorista_id ?? null,
        administrador_mestre: Boolean(perfil?.administrador_mestre),
        criado_em: usuario.created_at,
        ultimo_acesso: usuario.last_sign_in_at ?? null,
        email_confirmado_em: usuario.email_confirmed_at ?? null,
        usuario_atual: usuario.id === acesso.usuarioAtualId,
      };
    });

    usuarios.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return NextResponse.json({ usuarios, usuarioAtualMestre: acesso.usuarioAtualMestre });
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const acesso = await exigirAdministrador(request);
    if ("erro" in acesso) return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });

    const body = await request.json();
    const nome = String(body.nome ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const senha = String(body.senha ?? "");
    const tipo = body.tipo === "Administrador" ? "Administrador" : "Motorista";
    const motoristaId = body.motorista_id ? String(body.motorista_id) : null;

    if (!nome || !email || senha.length < 6) {
      return NextResponse.json({ erro: "Informe nome, e-mail e uma senha com pelo menos 6 caracteres." }, { status: 400 });
    }
    if (tipo === "Administrador" && !acesso.usuarioAtualMestre) {
      return NextResponse.json({ erro: "Somente o Administrador Mestre pode criar outros administradores." }, { status: 403 });
    }
    if (tipo === "Motorista" && !motoristaId) {
      return NextResponse.json({ erro: "Vincule a conta a um motorista cadastrado." }, { status: 400 });
    }

    const { data, error } = await acesso.adminClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (error || !data.user) {
      return NextResponse.json({ erro: error?.message ?? "Não foi possível criar o usuário." }, { status: 400 });
    }

    const { error: perfilError } = await acesso.adminClient.from("perfis").upsert({
      id: data.user.id,
      nome,
      tipo,
      ativo: true,
      motorista_id: tipo === "Motorista" ? motoristaId : null,
      administrador_mestre: false,
      updated_at: new Date().toISOString(),
    });

    if (perfilError) {
      await acesso.adminClient.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ erro: perfilError.message }, { status: 400 });
    }

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const acesso = await exigirAdministrador(request);
    if ("erro" in acesso) return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });

    const body = await request.json();
    const id = String(body.id ?? "");
    const acao = String(body.acao ?? "");
    if (!id) return NextResponse.json({ erro: "Usuário não informado." }, { status: 400 });

    const alvo = await obterPerfil(acesso.adminClient, id);
    if (!alvo) return NextResponse.json({ erro: "Perfil não encontrado." }, { status: 404 });

    const alvoMestre = Boolean(alvo.administrador_mestre);
    const alterandoPropriaConta = id === acesso.usuarioAtualId;

    if (alvoMestre && !alterandoPropriaConta) {
      return NextResponse.json({ erro: "A conta do Administrador Mestre só pode ser alterada por ele próprio." }, { status: 403 });
    }

    if (acao === "redefinir_senha") {
      const senha = String(body.senha ?? "");
      if (senha.length < 6) return NextResponse.json({ erro: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });

      if (alvoMestre) {
        const senhaAtual = String(body.senha_atual ?? "");
        const valida = await validarSenhaAtual(acesso.authClient, acesso.usuarioAtualEmail, senhaAtual);
        if (!valida) return NextResponse.json({ erro: "Senha atual incorreta." }, { status: 403 });
      }

      const { error } = await acesso.adminClient.auth.admin.updateUserById(id, { password: senha });
      if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
    } else if (acao === "alterar_email") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return NextResponse.json({ erro: "Informe o novo e-mail." }, { status: 400 });

      if (alvoMestre) {
        const senhaAtual = String(body.senha_atual ?? "");
        const valida = await validarSenhaAtual(acesso.authClient, acesso.usuarioAtualEmail, senhaAtual);
        if (!valida) return NextResponse.json({ erro: "Senha atual incorreta." }, { status: 403 });
      }

      const { error } = await acesso.adminClient.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
    } else if (acao === "atualizar_perfil") {
      const nome = String(body.nome ?? "").trim();
      const tipo = body.tipo === "Administrador" ? "Administrador" : "Motorista";
      const ativo = Boolean(body.ativo);
      const motoristaId = body.motorista_id ? String(body.motorista_id) : null;

      if (!nome) return NextResponse.json({ erro: "Informe o nome." }, { status: 400 });
      if (alvoMestre && (!ativo || tipo !== "Administrador")) {
        return NextResponse.json({ erro: "O Administrador Mestre não pode ser bloqueado nem rebaixado." }, { status: 403 });
      }
      if (id === acesso.usuarioAtualId && !ativo) {
        return NextResponse.json({ erro: "Você não pode bloquear a conta que está usando." }, { status: 400 });
      }
      if (tipo === "Administrador" && alvo.tipo !== "Administrador" && !acesso.usuarioAtualMestre) {
        return NextResponse.json({ erro: "Somente o Administrador Mestre pode promover usuários a administrador." }, { status: 403 });
      }
      if (tipo === "Motorista" && !motoristaId) {
        return NextResponse.json({ erro: "Vincule a conta a um motorista cadastrado." }, { status: 400 });
      }

      const { error } = await acesso.adminClient.from("perfis").update({
        nome,
        tipo,
        ativo,
        motorista_id: tipo === "Motorista" ? motoristaId : null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
    } else {
      return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
    }

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const acesso = await exigirAdministrador(request);
    if ("erro" in acesso) return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });

    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ erro: "Usuário não informado." }, { status: 400 });

    const alvo = await obterPerfil(acesso.adminClient, id);
    if (!alvo) return NextResponse.json({ erro: "Perfil não encontrado." }, { status: 404 });
    if (alvo.administrador_mestre) {
      return NextResponse.json({ erro: "A conta do Administrador Mestre nunca pode ser excluída." }, { status: 403 });
    }
    if (id === acesso.usuarioAtualId) {
      return NextResponse.json({ erro: "Você não pode excluir a conta que está usando." }, { status: 400 });
    }

    const { error } = await acesso.adminClient.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

    await acesso.adminClient.from("perfis").delete().eq("id", id);
    return NextResponse.json({ sucesso: true });
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
