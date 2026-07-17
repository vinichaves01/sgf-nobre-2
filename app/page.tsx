"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Veiculo = {
  id: string;
  status: string;
};

const menu = [
  ["📊", "Dashboard", "/"],
  ["🚛", "Frota", "/frota"],
  ["👨‍✈️", "Motoristas", "/"],
  ["🗺️", "Viagens", "/"],
  ["💰", "Financeiro", "/"],
  ["⛽", "Abastecimentos", "/"],
  ["🔧", "Manutenção", "/"],
  ["👥", "Clientes", "/"],
  ["📈", "Relatórios", "/"],
  ["⚙️", "Configurações", "/"],
];

export default function Home() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarVeiculos() {
      const { data, error } = await supabase
        .from("veiculos")
        .select("id, status");

      if (!error) {
        setVeiculos(data ?? []);
      }

      setCarregando(false);
    }

    carregarVeiculos();
  }, []);

  const total = veiculos.length;
  const ativos = veiculos.filter((v) => v.status === "Ativo").length;
  const manutencao = veiculos.filter(
    (v) => v.status === "Em manutenção"
  ).length;
  const inativos = veiculos.filter((v) => v.status === "Inativo").length;

  const cards = [
    {
      titulo: "Total de veículos",
      valor: carregando ? "..." : String(total),
      detalhe: "Veículos cadastrados",
    },
    {
      titulo: "Veículos ativos",
      valor: carregando ? "..." : String(ativos),
      detalhe: "Frota operacional",
    },
    {
      titulo: "Em manutenção",
      valor: carregando ? "..." : String(manutencao),
      detalhe: "Veículos parados",
    },
    {
      titulo: "Veículos inativos",
      valor: carregando ? "..." : String(inativos),
      detalhe: "Fora de operação",
    },
  ];

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
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
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
              Controle financeiro, frota, viagens e manutenção em um só lugar.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <article
                key={card.titulo}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-500">
                  {card.titulo}
                </p>
                <p className="mt-3 text-2xl font-bold">{card.valor}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {card.detalhe}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Resumo da frota</h3>

              <div className="mt-5 space-y-5">
                <Status
                  nome="Ativos"
                  quantidade={ativos}
                  total={total}
                />
                <Status
                  nome="Em manutenção"
                  quantidade={manutencao}
                  total={total}
                />
                <Status
                  nome="Inativos"
                  quantidade={inativos}
                  total={total}
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
                    Cadastrar, editar e excluir veículos.
                  </p>
                </Link>

                <div className="rounded-xl border bg-slate-50 p-5">
                  <p className="text-2xl">💰</p>
                  <p className="mt-3 font-bold">Financeiro</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Próximo módulo do sistema.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
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