"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MobileNav from "@/components/MobileNav";

type Veiculo = {
  id: string;
  status: string;
};

type Lancamento = {
  id: string;
  descricao: string;
  tipo: "Receita" | "Despesa";
  valor: number;
  vencimento: string;
  status: "Recebido" | "A receber" | "Pago" | "A pagar";
};

type Perfil = {
  nome: string | null;
  tipo: "Administrador" | "Motorista";
  ativo: boolean;
};

const menu = [
  ["📊", "Dashboard", "/"],
  ["🚛", "Frota", "/frota"],
  ["👨‍✈️", "Motoristas", "/motoristas"],
  ["🗺️", "Viagens", "/viagens"],
  ["💰", "Financeiro", "/financeiro"],
  ["⛽", "Abastecimentos", "/abastecimentos"],
  ["🔧", "Manutenção", "/manutencao"],
  ["👥", "Clientes", "/clientes"],
  ["📈", "Relatórios", "/relatorios"],
  ["⚙️", "Configurações", "/"],
];

export default function Home() {
  const router = useRouter();

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [frotaCarregada, setFrotaCarregada] = useState(false);
  const [financeiroCarregado, setFinanceiroCarregado] =
    useState(false);

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");

  const carregarDashboard = useCallback(
    async (silencioso = false) => {
      if (silencioso) {
        setAtualizando(true);
      } else {
        setCarregando(true);
      }

      const {
        data: { session },
        error: erroSessao,
      } = await supabase.auth.getSession();

      if (erroSessao) {
        setErro(
          `Não foi possível recuperar sua sessão: ${erroSessao.message}`
        );
        setCarregando(false);
        setAtualizando(false);
        return;
      }

      if (!session) {
        setSessaoPronta(false);
        setCarregando(false);
        setAtualizando(false);
        router.replace("/login");
        return;
      }

      setSessaoPronta(true);

      const [
        resultadoVeiculos,
        resultadoFinanceiro,
        resultadoPerfil,
      ] = await Promise.all([
        supabase
          .from("veiculos")
          .select("id, status"),

        supabase
          .from("financeiro")
          .select(
            "id, descricao, tipo, valor, vencimento, status"
          )
          .order("vencimento", {
            ascending: true,
          }),

        supabase
          .from("perfis")
          .select("nome, tipo, ativo")
          .eq("id", session.user.id)
          .maybeSingle(),
      ]);

      const erros: string[] = [];

      if (resultadoVeiculos.error) {
        erros.push(
          `Frota: ${resultadoVeiculos.error.message}`
        );
      } else {
        setVeiculos(resultadoVeiculos.data ?? []);
        setFrotaCarregada(true);
      }

      if (resultadoFinanceiro.error) {
        erros.push(
          `Financeiro: ${resultadoFinanceiro.error.message}`
        );
      } else {
        setLancamentos(resultadoFinanceiro.data ?? []);
        setFinanceiroCarregado(true);
      }

      if (resultadoPerfil.error) {
        erros.push(
          `Perfil: ${resultadoPerfil.error.message}`
        );
      } else if (resultadoPerfil.data) {
        setPerfil(resultadoPerfil.data as Perfil);
      }

      if (erros.length > 0) {
        setErro(
          `Alguns dados não puderam ser atualizados — ${erros.join(
            " | "
          )}`
        );
      } else {
        setErro("");
      }

      setCarregando(false);
      setAtualizando(false);
    },
    [router]
  );

  useEffect(() => {
    let ativo = true;
    let canal: ReturnType<typeof supabase.channel> | null =
      null;

    const atualizarSilenciosamente = () => {
      if (ativo) {
        void carregarDashboard(true);
      }
    };

    const iniciar = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!ativo) return;

      if (error) {
        setErro(
          `Não foi possível recuperar sua sessão: ${error.message}`
        );
        setCarregando(false);
        return;
      }

      if (!session) {
        setSessaoPronta(false);
        setCarregando(false);
        router.replace("/login");
        return;
      }

      setSessaoPronta(true);
      await carregarDashboard(false);

      if (!ativo) return;

      canal = supabase
        .channel(`dashboard-tempo-real-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "veiculos",
          },
          atualizarSilenciosamente
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "financeiro",
          },
          atualizarSilenciosamente
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "perfis",
          },
          atualizarSilenciosamente
        )
        .subscribe((status) => {
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            setErro(
              "A atualização em tempo real foi interrompida. O sistema continuará tentando sincronizar automaticamente."
            );
          }
        });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_evento, session) => {
        if (!ativo) return;

        if (!session) {
          setSessaoPronta(false);
          router.replace("/login");
          return;
        }

        setSessaoPronta(true);

        window.setTimeout(() => {
          atualizarSilenciosamente();
        }, 0);
      }
    );

    const atualizarAoVoltar = () => {
      if (document.visibilityState === "visible") {
        atualizarSilenciosamente();
      }
    };

    window.addEventListener(
      "focus",
      atualizarSilenciosamente
    );

    document.addEventListener(
      "visibilitychange",
      atualizarAoVoltar
    );

    const verificacaoSeguranca = window.setInterval(
      atualizarSilenciosamente,
      15000
    );

    void iniciar();

    return () => {
      ativo = false;

      subscription.unsubscribe();

      window.removeEventListener(
        "focus",
        atualizarSilenciosamente
      );

      document.removeEventListener(
        "visibilitychange",
        atualizarAoVoltar
      );

      window.clearInterval(verificacaoSeguranca);

      if (canal) {
        void supabase.removeChannel(canal);
      }
    };
  }, [carregarDashboard, router]);

  async function sairDoSistema() {
    setErro("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErro(`Erro ao sair: ${error.message}`);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (!sessaoPronta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
          <div className="text-2xl font-bold text-amber-500">
            NOBRE
          </div>

          <p className="mt-4 font-semibold">
            Restaurando sua sessão...
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Seus dados serão exibidos assim que o acesso for
            confirmado.
          </p>
        </div>
      </main>
    );
  }

  const totalVeiculos = veiculos.length;

  const ativos = veiculos.filter(
    (veiculo) => veiculo.status === "Ativo"
  ).length;

  const manutencao = veiculos.filter(
    (veiculo) => veiculo.status === "Em manutenção"
  ).length;

  const inativos = veiculos.filter(
    (veiculo) => veiculo.status === "Inativo"
  ).length;

  const aPagar = lancamentos
    .filter((item) => item.status === "A pagar")
    .reduce(
      (total, item) => total + Number(item.valor),
      0
    );

  const aReceber = lancamentos
    .filter((item) => item.status === "A receber")
    .reduce(
      (total, item) => total + Number(item.valor),
      0
    );

  const pago = lancamentos
    .filter((item) => item.status === "Pago")
    .reduce(
      (total, item) => total + Number(item.valor),
      0
    );

  const recebido = lancamentos
    .filter((item) => item.status === "Recebido")
    .reduce(
      (total, item) => total + Number(item.valor),
      0
    );

  const saldoCaixa = recebido - pago;

  const proximosVencimentos = lancamentos
    .filter(
      (item) =>
        item.status === "A pagar" ||
        item.status === "A receber"
    )
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 text-white md:flex">
        <div className="border-b border-slate-800 px-6 py-6">
          <div className="text-2xl font-bold text-amber-400">
            NOBRE
          </div>

          <div className="text-sm text-slate-400">
            Sistema de Gestão de Frota
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {menu.map(([icone, nome, rota], index) => (
            <Link
              key={nome}
              href={rota}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition ${
                index === 0
                  ? "bg-amber-400 font-semibold text-slate-950"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{icone}</span>
              <span>{nome}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={sairDoSistema}
            className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Sair do sistema
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            SGF Nobre 2.0
          </p>
        </div>
      </aside>

      <main className="pb-28 md:ml-64 md:pb-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
          <div>
            <h1 className="text-2xl font-bold">
              Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Gestão inteligente para quem move o Brasil.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {atualizando && (
              <span className="text-xs text-slate-400">
                Atualizando...
              </span>
            )}

            <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium">
              {perfil?.tipo ?? "Administrador"}
            </div>
          </div>
        </header>

        <section className="p-4 sm:p-6">
          <div className="mb-5 rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:mb-6 sm:p-7">
            <p className="text-sm text-amber-400">
              Nobre Transportadora
            </p>

            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Visão geral da operação
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400 sm:text-base">
              Frota, financeiro e vencimentos em um só
              lugar.
            </p>
          </div>

          {erro && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {erro}
            </div>
          )}

          {carregando && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">
              Carregando os dados do Dashboard...
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-5">
            <Card
              titulo="Total de veículos"
              valor={
                frotaCarregada
                  ? String(totalVeiculos)
                  : "..."
              }
              detalhe="Veículos cadastrados"
            />

            <Card
              titulo="Veículos ativos"
              valor={
                frotaCarregada ? String(ativos) : "..."
              }
              detalhe="Frota operacional"
            />

            <Card
              titulo="Contas a pagar"
              valor={
                financeiroCarregado
                  ? formatarMoeda(aPagar)
                  : "..."
              }
              detalhe="Valores pendentes"
            />

            <Card
              titulo="Contas a receber"
              valor={
                financeiroCarregado
                  ? formatarMoeda(aReceber)
                  : "..."
              }
              detalhe="Receitas pendentes"
            />

            <div className="col-span-2 xl:col-span-1">
              <Card
                titulo="Saldo em caixa"
                valor={
                  financeiroCarregado
                    ? formatarMoeda(saldoCaixa)
                    : "..."
                }
                detalhe="Recebido menos despesas pagas"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:mt-6 xl:grid-cols-2 xl:gap-6">
            <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold">
                  Próximos vencimentos
                </h3>

                <Link
                  href="/financeiro"
                  className="text-sm font-semibold text-amber-600"
                >
                  Ver financeiro
                </Link>
              </div>

              {proximosVencimentos.length === 0 ? (
                <p className="mt-5 text-slate-500">
                  Nenhuma conta pendente.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {proximosVencimentos.map((item) => {
                    const alerta = calcularAlerta(
                      item.vencimento
                    );

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold">
                            {item.descricao}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {item.tipo} •{" "}
                            {formatarData(
                              item.vencimento
                            )}
                          </p>

                          <span
                            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${alerta.classe}`}
                          >
                            {alerta.texto}
                          </span>
                        </div>

                        <div className="sm:text-right">
                          <p className="font-bold">
                            {formatarMoeda(
                              item.valor
                            )}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {item.status}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
              <h3 className="text-lg font-bold">
                Resumo financeiro
              </h3>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                <Resumo
                  titulo="Recebido"
                  valor={recebido}
                  detalhe="Receitas confirmadas"
                />

                <Resumo
                  titulo="Pago"
                  valor={pago}
                  detalhe="Despesas quitadas"
                />

                <Resumo
                  titulo="A receber"
                  valor={aReceber}
                  detalhe="Receitas pendentes"
                />

                <Resumo
                  titulo="A pagar"
                  valor={aPagar}
                  detalhe="Despesas pendentes"
                />

                <div className="col-span-2 xl:col-span-1">
                  <Resumo
                    titulo="Saldo em caixa"
                    valor={saldoCaixa}
                    detalhe="Recebido menos despesas pagas"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 xl:mt-6 xl:grid-cols-2 xl:gap-6">
            <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
              <h3 className="text-lg font-bold">
                Situação da frota
              </h3>

              <div className="mt-5 space-y-5">
                <Status
                  nome="Ativos"
                  quantidade={ativos}
                  total={totalVeiculos}
                />

                <Status
                  nome="Em manutenção"
                  quantidade={manutencao}
                  total={totalVeiculos}
                />

                <Status
                  nome="Inativos"
                  quantidade={inativos}
                  total={totalVeiculos}
                />
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
              <h3 className="text-lg font-bold">
                Acesso rápido
              </h3>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
                <Link
                  href="/viagens"
                  className="rounded-xl border bg-slate-50 p-4 transition hover:border-amber-400 hover:bg-amber-50 sm:p-5"
                >
                  <p className="text-2xl">🗺️</p>

                  <p className="mt-3 font-bold">
                    Viagens
                  </p>

                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Iniciar e acompanhar operações.
                  </p>
                </Link>

                <Link
                  href="/motoristas"
                  className="rounded-xl border bg-slate-50 p-4 transition hover:border-amber-400 hover:bg-amber-50 sm:p-5"
                >
                  <p className="text-2xl">👨‍✈️</p>

                  <p className="mt-3 font-bold">
                    Motoristas
                  </p>

                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Consultar e gerenciar motoristas.
                  </p>
                </Link>

                <Link
                  href="/frota"
                  className="rounded-xl border bg-slate-50 p-4 transition hover:border-amber-400 hover:bg-amber-50 sm:p-5"
                >
                  <p className="text-2xl">🚛</p>

                  <p className="mt-3 font-bold">
                    Gerenciar frota
                  </p>

                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Cadastrar e controlar veículos.
                  </p>
                </Link>

                <Link
                  href="/financeiro"
                  className="rounded-xl border bg-slate-50 p-4 transition hover:border-amber-400 hover:bg-amber-50 sm:p-5"
                >
                  <p className="text-2xl">💰</p>

                  <p className="mt-3 font-bold">
                    Financeiro
                  </p>

                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Contas a pagar e receber.
                  </p>
                </Link>
              </div>
            </section>
          </div>
        </section>
      </main>

      <MobileNav />
    </div>
  );
}

function Card({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <article className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium text-slate-500 sm:text-sm">
        {titulo}
      </p>

      <p className="mt-3 break-words text-xl font-bold sm:text-2xl">
        {valor}
      </p>

      <p className="mt-2 text-xs text-slate-400 sm:text-sm">
        {detalhe}
      </p>
    </article>
  );
}

function Resumo({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
}) {
  return (
    <div className="h-full rounded-xl border bg-slate-50 p-3 sm:p-4">
      <p className="text-xs text-slate-500 sm:text-sm">
        {titulo}
      </p>

      <p className="mt-2 break-words text-base font-bold sm:text-xl">
        {formatarMoeda(valor)}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {detalhe}
      </p>
    </div>
  );
}

function Status({
  nome,
  quantidade,
  total,
}: {
  nome: string;
  quantidade: number;
  total: number;
}) {
  const percentual =
    total > 0 ? (quantidade / total) * 100 : 0;

  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>{nome}</span>
        <strong>{quantidade}</strong>
      </div>

      <div className="h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-amber-400"
          style={{
            width: `${percentual}%`,
          }}
        />
      </div>
    </div>
  );
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarData(data: string) {
  return new Date(
    `${data}T12:00:00`
  ).toLocaleDateString("pt-BR");
}

function calcularAlerta(vencimento: string) {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  const dataVencimento = new Date(
    `${vencimento}T12:00:00`
  );

  const diferenca = Math.ceil(
    (dataVencimento.getTime() - hoje.getTime()) /
      86400000
  );

  if (diferenca < 0) {
    return {
      texto: `Vencida há ${Math.abs(
        diferenca
      )} dia(s)`,
      classe: "bg-red-100 text-red-700",
    };
  }

  if (diferenca === 0) {
    return {
      texto: "Vence hoje",
      classe: "bg-red-100 text-red-700",
    };
  }

  if (diferenca === 1) {
    return {
      texto: "Vence amanhã",
      classe: "bg-orange-100 text-orange-700",
    };
  }

  if (diferenca <= 5) {
    return {
      texto: `Faltam ${diferenca} dias`,
      classe: "bg-amber-100 text-amber-700",
    };
  }

  return {
    texto: `Faltam ${diferenca} dias`,
    classe: "bg-slate-100 text-slate-600",
  };
}