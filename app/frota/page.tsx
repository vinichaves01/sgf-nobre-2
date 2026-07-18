"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Veiculo = {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  ano: number | null;
  tipo: string;
  status: string;
};

const formularioInicial = {
  placa: "",
  modelo: "",
  marca: "",
  ano: "",
  tipo: "Cavalo mecânico",
  status: "Ativo",
};

export default function FrotaPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [veiculoEditando, setVeiculoEditando] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function carregarVeiculos() {
    const { data, error } = await supabase
      .from("veiculos")
      .select("id, placa, modelo, marca, ano, tipo, status")
      .order("created_at", { ascending: false });

    if (error) {
      setMensagem(`Erro ao carregar: ${error.message}`);
      return;
    }

    setVeiculos(data ?? []);
  }

  useEffect(() => {
    carregarVeiculos();
  }, []);

  function novoVeiculo() {
    setFormulario(formularioInicial);
    setVeiculoEditando(null);
    setMensagem("");
    setMostrarFormulario(true);
  }

  function editarVeiculo(veiculo: Veiculo) {
    setFormulario({
      placa: veiculo.placa,
      modelo: veiculo.modelo,
      marca: veiculo.marca,
      ano: veiculo.ano?.toString() ?? "",
      tipo: veiculo.tipo,
      status: veiculo.status,
    });

    setVeiculoEditando(veiculo.id);
    setMensagem("");
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvarVeiculo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCarregando(true);
    setMensagem("");

    const dados = {
      placa: formulario.placa.trim().toUpperCase(),
      modelo: formulario.modelo.trim(),
      marca: formulario.marca.trim(),
      ano: formulario.ano ? Number(formulario.ano) : null,
      tipo: formulario.tipo,
      status: formulario.status,
    };

    const resultado = veiculoEditando
      ? await supabase.from("veiculos").update(dados).eq("id", veiculoEditando)
      : await supabase.from("veiculos").insert(dados);

    if (resultado.error) {
      setMensagem(
        resultado.error.code === "23505"
          ? "Essa placa já está cadastrada."
          : `Erro ao salvar: ${resultado.error.message}`
      );

      setCarregando(false);
      return;
    }

    const estavaEditando = Boolean(veiculoEditando);

    setFormulario(formularioInicial);
    setVeiculoEditando(null);
    setMostrarFormulario(false);
    setMensagem(
      estavaEditando
        ? "Veículo atualizado com sucesso."
        : "Veículo cadastrado com sucesso."
    );

    await carregarVeiculos();
    setCarregando(false);
  }

  async function excluirVeiculo(veiculo: Veiculo) {
    const confirmar = window.confirm(
      `Deseja realmente excluir o veículo ${veiculo.placa}?`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("veiculos")
      .delete()
      .eq("id", veiculo.id);

    if (error) {
      setMensagem(`Erro ao excluir: ${error.message}`);
      return;
    }

    setMensagem("Veículo excluído com sucesso.");
    await carregarVeiculos();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Frota</h1>
            <p className="mt-1 text-slate-500">
              Cadastro e controle dos veículos da Nobre Transportadora.
            </p>
          </div>

          <button
            onClick={novoVeiculo}
            className="rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950"
          >
            + Novo veículo
          </button>
        </div>

        {mensagem && (
          <div className="mt-6 rounded-xl border bg-white px-4 py-3">
            {mensagem}
          </div>
        )}

        {mostrarFormulario && (
          <form
            onSubmit={salvarVeiculo}
            className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {veiculoEditando ? "Editar veículo" : "Cadastrar veículo"}
              </h2>

              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                className="text-sm text-slate-500"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input
                required
                value={formulario.placa}
                onChange={(e) =>
                  setFormulario({ ...formulario, placa: e.target.value })
                }
                placeholder="Placa"
                className="rounded-xl border px-4 py-3"
              />

              <input
                required
                value={formulario.modelo}
                onChange={(e) =>
                  setFormulario({ ...formulario, modelo: e.target.value })
                }
                placeholder="Modelo"
                className="rounded-xl border px-4 py-3"
              />

              <input
                required
                value={formulario.marca}
                onChange={(e) =>
                  setFormulario({ ...formulario, marca: e.target.value })
                }
                placeholder="Marca"
                className="rounded-xl border px-4 py-3"
              />

              <input
                type="number"
                min="1900"
                max="2100"
                value={formulario.ano}
                onChange={(e) =>
                  setFormulario({ ...formulario, ano: e.target.value })
                }
                placeholder="Ano"
                className="rounded-xl border px-4 py-3"
              />

              <select
                value={formulario.tipo}
                onChange={(e) =>
                  setFormulario({ ...formulario, tipo: e.target.value })
                }
                className="rounded-xl border px-4 py-3"
              >
                <option>Cavalo mecânico</option>
                <option>Carreta</option>
                <option>Truck</option>
                <option>Utilitário</option>
              </select>

              <select
                value={formulario.status}
                onChange={(e) =>
                  setFormulario({ ...formulario, status: e.target.value })
                }
                className="rounded-xl border px-4 py-3"
              >
                <option>Ativo</option>
                <option>Em manutenção</option>
                <option>Inativo</option>
              </select>
            </div>

            <button
              disabled={carregando}
              className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {carregando
                ? "Salvando..."
                : veiculoEditando
                  ? "Salvar alterações"
                  : "Salvar veículo"}
            </button>
          </form>
        )}

        <div className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
          {veiculos.length === 0 ? (
            <p className="p-6 text-slate-500">
              Nenhum veículo cadastrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Placa</th>
                    <th className="px-5 py-4">Veículo</th>
                    <th className="px-5 py-4">Ano</th>
                    <th className="px-5 py-4">Tipo</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {veiculos.map((veiculo) => (
                    <tr key={veiculo.id} className="border-t">
                      <td className="px-5 py-4 font-bold">{veiculo.placa}</td>
                      <td className="px-5 py-4">
                        {veiculo.marca} {veiculo.modelo}
                      </td>
                      <td className="px-5 py-4">{veiculo.ano ?? "—"}</td>
                      <td className="px-5 py-4">{veiculo.tipo}</td>
                      <td className="px-5 py-4">{veiculo.status}</td>

                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => editarVeiculo(veiculo)}
                            className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => excluirVeiculo(veiculo)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
