"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

const menu = [
  ["📊", "Dashboard", "/"],
  ["🚛", "Frota", "/frota"],
  ["👨‍✈️", "Motoristas", "/"],
  ["🗺️", "Viagens", "/"],
  ["💰", "Financeiro", "/financeiro"],
  ["⛽", "Abastecimentos", "/"],
  ["🔧", "Manutenção", "/"],
  ["👥", "Clientes", "/"],
  ["📈", "Relatórios", "/"],
  ["⚙️", "Configurações", "/"],
];

export default function Home() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarDashboard() {
      setCarregando(true);
      setErro("");

      const [resultadoVeiculos, resultadoFinanceiro] = await Promise.all([
        supabase.from("veiculos").select("id, status"),
        supabase
          .from("financeiro")
          .select("id, descricao, tipo, valor, vencimento, status")
          .order("vencimento", { ascending: true }),
      ]);

      if (resultadoVeiculos.error) {
        setErro(`Erro na frota: ${resultadoVeiculos.error.message}`);
      } else {
        setVeiculos(resultadoVeiculos.data ?? []);
      }

      if (resultadoFinanceiro.error) {
        setErro(`Erro no financeiro: ${resultadoFinanceiro.error.message}`);
      } else {
        setLancamentos(resultadoFinanceiro.data ?? []);
      }

      setCarregando(false);
    }

    carregarDashboard();
  }, []);

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
    .reduce((total, item) => total + Number(item.valor), 0);

  const aReceber = lancamentos
    .filter((item) => item.status === "A receber")
    .reduce((total, item) => total + Number(item.valor), 0);

  const pago = lancamentos
    .filter((item) => item.status === "Pago")
    .reduce((total, item) => total + Number(item.valor), 0);

  const recebido = lancamentos
    .filter((item) => item.status === "Recebido")
    .reduce((total, item) => total + Number(item.valor), 0);

  const saldoCaixa = recebido - pago;

  const proximosVencimentos = lancamentos
    .filter(
      (item) => item.status === "A pagar" || item.status === "A receber"
    )
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 text-white md:flex">
        <div className="border-b border-slate-800 px-6 py-6">
          <div className="text-2xl font-bold text-amber-400">NOBRE</div>

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

        <div className="border-t border-slate-800 p-4 text-xs text-slate-500">
          SGF Nobre 2.0
        </div>
      </aside>

      <main className="md:ml-64">
        <header className="flex items-center justify-between border-b bg-white px-6 py-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>

            <p className="text-sm text-slate-500">
              Gestão inteligente para quem move o Brasil.
            </p>
          </div>

          <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium">
            Administrador
          </div>
        </header>

        <section className="p-6">
          <div className="mb-6 rounded-2xl bg-slate-950 p-7 text-white shadow-lg">
            <p className="text-sm text-amber-400">Nobre Transportadora</p>

            <h2 className="mt-2 text-3xl font-bold">
              Visão geral da operação
            </h2>

            <p className="mt-2 text-slate-400">
              Frota, financeiro e vencimentos em um só lugar.
            </p>
          </div>

          {erro && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {erro}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <Card
              titulo="Total de veículos"
              valor={carregando ? "..." : String(totalVeiculos)}
              detalhe="Veículos cadastrados"
            />

            <Card
              titulo="Veículos ativos"
              valor={carregando ? "..." : String(ativos)}
              detalhe="Frota operacional"
            />

            <Card
              titulo="Contas a pagar"
              valor={carregando ? "..." : formatarMoeda(aPagar)}
              detalhe="Valores pendentes"
            />

            <Card
              titulo="Contas a receber"
              valor={carregando ? "..." : formatarMoeda(aReceber)}
              detalhe="Receitas pendentes"
            />

            <Card
              titulo="Saldo em caixa"
              valor={carregando ? "..." : formatarMoeda(saldoCaixa)}
              detalhe="Recebido menos despesas pagas"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Próximos vencimentos</h3>

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
                    const alerta = calcularAlerta(item.vencimento);

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border p-4"
                      >
                        <div>
                          <p className="font-semibold">{item.descricao}</p>

                          <p className="mt-1 text-sm text-slate-500">
                            {item.tipo} • {formatarData(item.vencimento)}
                          </p>

                          <span
                            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${alerta.classe}`}
                          >
                            {alerta.texto}
                          </span>
                        </div>

                        <div className="text-right">
                          <p className="font-bold">
                            {formatarMoeda(item.valor)}
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

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Resumo financeiro</h3>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

                <Resumo
                  titulo="Saldo em caixa"
                  valor={saldoCaixa}
                  detalhe="Recebido menos despesas pagas"
                />
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Situação da frota</h3>

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

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Acesso rápido</h3>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Link
                  href="/frota"
                  className="rounded-xl border bg-slate-50 p-5 transition hover:border-amber-400 hover:bg-amber-50"
                >
                  <p className="text-2xl">🚛</p>
                  <p className="mt-3 font-bold">Gerenciar frota</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Cadastrar, editar e controlar veículos.
                  </p>
                </Link>

                <Link
                  href="/financeiro"
                  className="rounded-xl border bg-slate-50 p-5 transition hover:border-amber-400 hover:bg-amber-50"
                >
                  <p className="text-2xl">💰</p>
                  <p className="mt-3 font-bold">Financeiro</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Contas a pagar e receber.
                  </p>
                </Link>
              </div>
            </section>
          </div>
        </section>
      </main>
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
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      <p className="mt-3 text-2xl font-bold">{valor}</p>
      <p className="mt-2 text-sm text-slate-400">{detalhe}</p>
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
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="mt-2 text-xl font-bold">{formatarMoeda(valor)}</p>
      <p className="mt-1 text-xs text-slate-400">{detalhe}</p>
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
  const percentual = total > 0 ? (quantidade / total) * 100 : 0;

  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>{nome}</span>
        <strong>{quantidade}</strong>
      </div>

      <div className="h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-amber-400"
          style={{ width: `${percentual}%` }}
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
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
}

function calcularAlerta(vencimento: string) {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  const dataVencimento = new Date(`${vencimento}T12:00:00`);

  const diferenca = Math.ceil(
    (dataVencimento.getTime() - hoje.getTime()) / 86400000
  );

  if (diferenca < 0) {
    return {
      texto: `Vencida há ${Math.abs(diferenca)} dia(s)`,
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
