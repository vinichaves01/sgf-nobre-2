"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ItemMenu = {
  href: string;
  rotulo: string;
  icone: string;
};

const itensPrincipais: ItemMenu[] = [
  {
    href: "/",
    rotulo: "Início",
    icone: "🏠",
  },
  {
    href: "/viagens",
    rotulo: "Viagens",
    icone: "🗺️",
  },
  {
    href: "/motoristas",
    rotulo: "Motoristas",
    icone: "👨‍💼",
  },
];

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [mostrarMais, setMostrarMais] =
    useState(false);

  const [saindo, setSaindo] = useState(false);

  function itemAtivo(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }

  async function sair() {
    setSaindo(true);

    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {mostrarMais && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          onClick={() => setMostrarMais(false)}
        >
          <div
            className="absolute bottom-24 left-4 right-4 rounded-3xl border bg-white p-4 shadow-2xl"
            onClick={(evento) =>
              evento.stopPropagation()
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Mais opções
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Acesso administrativo
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarMais(false)
                }
                className="rounded-full bg-slate-100 px-3 py-2 text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link
                href="/frota"
                onClick={() =>
                  setMostrarMais(false)
                }
                className="rounded-2xl border bg-slate-50 p-4 text-center font-semibold text-slate-800"
              >
                <span className="block text-2xl">
                  🚚
                </span>

                <span className="mt-2 block">
                  Frota
                </span>
              </Link>

              <Link
                href="/financeiro"
                onClick={() =>
                  setMostrarMais(false)
                }
                className="rounded-2xl border bg-slate-50 p-4 text-center font-semibold text-slate-800"
              >
                <span className="block text-2xl">
                  💰
                </span>

                <span className="mt-2 block">
                  Financeiro
                </span>
              </Link>

              <Link
                href="/relatorios"
                onClick={() =>
                  setMostrarMais(false)
                }
                className="rounded-2xl border bg-slate-50 p-4 text-center font-semibold text-slate-800"
              >
                <span className="block text-2xl">
                  📈
                </span>

                <span className="mt-2 block">
                  Relatórios
                </span>
              </Link>

              <Link
                href="/usuarios"
                onClick={() =>
                  setMostrarMais(false)
                }
                className="rounded-2xl border bg-slate-50 p-4 text-center font-semibold text-slate-800"
              >
                <span className="block text-2xl">
                  👤
                </span>

                <span className="mt-2 block">
                  Usuários
                </span>
              </Link>

              <Link
                href="/viagens/indicadores"
                onClick={() =>
                  setMostrarMais(false)
                }
                className="rounded-2xl border bg-slate-50 p-4 text-center font-semibold text-slate-800"
              >
                <span className="block text-2xl">
                  📊
                </span>

                <span className="mt-2 block">
                  Indicadores
                </span>
              </Link>
            </div>

            <button
              type="button"
              disabled={saindo}
              onClick={sair}
              className="mt-4 w-full rounded-2xl bg-red-600 px-5 py-4 font-bold text-white disabled:opacity-60"
            >
              {saindo
                ? "Saindo..."
                : "Sair do sistema"}
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-2">
          {itensPrincipais.map((item) => {
            const ativo = itemAtivo(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 py-2 text-xs font-semibold transition ${
                  ativo
                    ? "bg-amber-100 text-amber-700"
                    : "text-slate-500"
                }`}
              >
                <span className="text-xl">
                  {item.icone}
                </span>

                <span className="mt-1">
                  {item.rotulo}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() =>
              setMostrarMais(true)
            }
            className="flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 py-2 text-xs font-semibold text-slate-500"
          >
            <span className="text-xl">☰</span>

            <span className="mt-1">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}