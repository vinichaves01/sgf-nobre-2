import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTrackingToken } from "@/lib/mobile-tracking-token";

export const runtime = "nodejs";

type NativeLocation = {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number | null;
  bearing?: number | null;
  speed?: number | null;
  time?: number | null;
  simulated?: boolean;
  source?: string;
};

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const payload = verifyTrackingToken(token);
    if (!payload) {
      return NextResponse.json({ erro: "Token de rastreamento inválido." }, { status: 401 });
    }

    const location = (await request.json()) as NativeLocation;
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      return NextResponse.json({ erro: "Coordenadas inválidas." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase do servidor não configurado.");
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: jornada } = await serviceClient
      .from("jornadas_motorista")
      .select("id,status")
      .eq("id", payload.jornadaId)
      .eq("motorista_id", payload.motoristaId)
      .maybeSingle();

    if (!jornada || jornada.status !== "Ativa") {
      return NextResponse.json({ erro: "Jornada encerrada." }, { status: 409 });
    }

    const capturadoEm =
      typeof location.time === "number" && location.time > 0
        ? new Date(location.time).toISOString()
        : new Date().toISOString();

    const { error } = await serviceClient.from("localizacoes_gps").insert({
      motorista_id: payload.motoristaId,
      veiculo_id: payload.veiculoId,
      jornada_id: payload.jornadaId,
      latitude: location.latitude,
      longitude: location.longitude,
      precisao_metros: location.accuracy ?? null,
      velocidade_kmh:
        location.speed == null ? null : Math.max(0, location.speed * 3.6),
      direcao_graus: location.bearing ?? null,
      altitude_metros: location.altitude ?? null,
      capturado_em: capturadoEm,
    });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : "Erro ao salvar localização." },
      { status: 500 },
    );
  }
}
