import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTrackingToken } from "@/lib/mobile-tracking-token";

export const runtime = "nodejs";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!accessToken) {
      return NextResponse.json({ erro: "Sessão não informada." }, { status: 401 });
    }

    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) throw new Error("Chave pública do Supabase não configurada.");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ erro: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const serviceClient = createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: motorista } = await serviceClient
      .from("motoristas")
      .select("id,veiculo_id,status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!motorista || motorista.status !== "Ativo") {
      return NextResponse.json({ erro: "Motorista ativo não encontrado." }, { status: 403 });
    }

    const { data: jornada } = await serviceClient
      .from("jornadas_motorista")
      .select("id,motorista_id,veiculo_id,status")
      .eq("motorista_id", motorista.id)
      .eq("status", "Ativa")
      .maybeSingle();

    if (!jornada) {
      return NextResponse.json({ erro: "Nenhuma jornada ativa encontrada." }, { status: 409 });
    }

    const token = createTrackingToken({
      motoristaId: jornada.motorista_id,
      jornadaId: jornada.id,
      veiculoId: jornada.veiculo_id ?? motorista.veiculo_id ?? null,
      exp: Date.now() + 18 * 60 * 60 * 1000,
    });

    const locationUrl = new URL("/api/mobile/location", request.nextUrl.origin);
    locationUrl.searchParams.set("token", token);

    return NextResponse.json({
      url: locationUrl.toString(),
      expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : "Erro ao preparar rastreamento." },
      { status: 500 },
    );
  }
}
