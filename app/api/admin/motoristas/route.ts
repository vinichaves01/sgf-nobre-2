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
    .select("tipo, ativo")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (perfilError || !perfil || perfil.tipo !== "Administrador" || !perfil.ativo) {
    return { erro: "Apenas administradores podem gerenciar motoristas.", status: 403 } as const;
  }

  return { adminClient } as const;
}

export async function PATCH(request: NextRequest) {
  try {
    const acesso = await exigirAdministrador(request);
    if ("erro" in acesso) {
      return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });
    }

    const body = await request.json();
    const id = String(body.id ?? "");
    const acao = String(body.acao ?? "");

    if (!id) return NextResponse.json({ erro: "Motorista não informado." }, { status: 400 });
    if (acao !== "arquivar") return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });

    const { data: motorista, error: motoristaError } = await acesso.adminClient
      .from("motoristas")
      .select("id, nome")
      .eq("id", id)
      .maybeSingle();

    if (motoristaError || !motorista) {
      return NextResponse.json({ erro: motoristaError?.message ?? "Motorista não encontrado." }, { status: 404 });
    }

    const { error: atualizarError } = await acesso.adminClient
      .from("motoristas")
      .update({ status: "Inativo", veiculo_id: null })
      .eq("id", id);

    if (atualizarError) {
      return NextResponse.json({ erro: atualizarError.message }, { status: 400 });
    }

    const { error: bloquearError } = await acesso.adminClient
      .from("perfis")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("motorista_id", id);

    if (bloquearError) {
      return NextResponse.json({ erro: bloquearError.message }, { status: 400 });
    }

    return NextResponse.json({ sucesso: true, mensagem: `${motorista.nome} foi arquivado e teve o acesso bloqueado.` });
  } catch (error) {
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : "Erro inesperado." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const acesso = await exigirAdministrador(request);
    if ("erro" in acesso) {
      return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });
    }

    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ erro: "Motorista não informado." }, { status: 400 });

    const [{ count: viagens, error: viagensError }, { count: contas, error: contasError }] = await Promise.all([
      acesso.adminClient.from("viagens").select("id", { count: "exact", head: true }).eq("motorista_id", id),
      acesso.adminClient.from("perfis").select("id", { count: "exact", head: true }).eq("motorista_id", id),
    ]);

    if (viagensError || contasError) {
      return NextResponse.json({ erro: viagensError?.message ?? contasError?.message }, { status: 400 });
    }

    if ((contas ?? 0) > 0) {
      return NextResponse.json(
        { erro: "Este motorista possui uma conta de acesso vinculada. Exclua a conta em Usuários e acessos antes de excluir o cadastro." },
        { status: 409 }
      );
    }

    if ((viagens ?? 0) > 0) {
      return NextResponse.json(
        { erro: "Este motorista possui viagens no histórico e não pode ser excluído. Use Arquivar para preservar os relatórios." },
        { status: 409 }
      );
    }

    const { error } = await acesso.adminClient.from("motoristas").delete().eq("id", id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : "Erro inesperado." },
      { status: 500 }
    );
  }
}
