"use client";

import Link from "next/link";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type StatusMotorista =
  | "Ativo"
  | "Férias"
  | "Afastado"
  | "Inativo";

type TipoMotorista = "Fixo" | "Folguista";

type Veiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  status: string;
};

type Motorista = {
  id: string;
  nome: string;
  cpf: string;
  cnh: string;
  categoria_cnh: string;
  validade_cnh: string;
  telefone: string | null;
  email: string | null;
  data_admissao: string | null;
  status: StatusMotorista;
  tipo_motorista: TipoMotorista;
  observacao: string | null;
  veiculo_id: string | null;
  created_at: string;
};

const formularioInicial = {
  nome: "",
  cpf: "",
  cnh: "",
  categoria_cnh: "E",
  validade_cnh: "",
  telefone: "",
  email: "",
  data_admissao: "",
  status: "Ativo" as StatusMotorista,
  tipo_motorista: "Fixo" as TipoMotorista,
  observacao: "",
  veiculo_id: "",
};

export default function MotoristasPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  const [formulario, setFormulario] =
    useState(formularioInicial);

  const [editandoId, setEditandoId] = useState<
    string | null
  >(null);

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("");

  async function carregarDados() {
    setCarregando(true);

    const [resultadoMotoristas, resultadoVeiculos] =
      await Promise.all([
        supabase
          .from("motoristas")
          .select("*")
          .order("nome", { ascending: true }),

        supabase
          .from("veiculos")
          .select("id, placa, marca, modelo, status")
          .order("placa", { ascending: true }),
      ]);

    if (resultadoMotoristas.error) {
      setMensagem(
        `Erro ao carregar motoristas: ${resultadoMotoristas.error.message}`
      );
      setMotoristas([]);
    } else {
      setMotoristas(resultadoMotoristas.data ?? []);
    }

    if (resultadoVeiculos.error) {
      setMensagem(
        `Erro ao carregar veículos: ${resultadoVeiculos.error.message}`
      );
      setVeiculos([]);
    } else {
      setVeiculos(resultadoVeiculos.data ?? []);
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function novoMotorista() {
    setFormulario(formularioInicial);
    setEditandoId(null);
    setMensagem("");
    setMostrarFormulario(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function fecharFormulario() {
    setMostrarFormulario(false);
    setEditandoId(null);
    setFormulario(formularioInicial);
  }

  function alterarTipoMotorista(tipo: TipoMotorista) {
    setFormulario({
      ...formulario,
      tipo_motorista: tipo,
      veiculo_id:
        tipo === "Folguista"
          ? ""
          : formulario.veiculo_id,
    });
  }

  function editarMotorista(motorista: Motorista) {
    setFormulario({
      nome: motorista.nome,
      cpf: motorista.cpf,
      cnh: motorista.cnh,
      categoria_cnh: motorista.categoria_cnh,
      validade_cnh: motorista.validade_cnh,
      telefone: motorista.telefone ?? "",
      email: motorista.email ?? "",
      data_admissao: motorista.data_admissao ?? "",
      status: motorista.status,
      tipo_motorista:
        motorista.tipo_motorista ?? "Fixo",
      observacao: motorista.observacao ?? "",
      veiculo_id:
        motorista.tipo_motorista === "Folguista"
          ? ""
          : motorista.veiculo_id ?? "",
    });

    setEditandoId(motorista.id);
    setMensagem("");
    setMostrarFormulario(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function salvarMotorista(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setSalvando(true);
    setMensagem("");

    const cpf = somenteNumeros(formulario.cpf);
    const cnh = somenteNumeros(formulario.cnh);

    if (cpf.length !== 11) {
      setMensagem("O CPF deve possuir 11 números.");
      setSalvando(false);
      return;
    }

    if (cnh.length < 9 || cnh.length > 11) {
      setMensagem("Confira o número da CNH informado.");
      setSalvando(false);
      return;
    }

    if (
      formulario.tipo_motorista === "Fixo" &&
      !formulario.veiculo_id
    ) {
      setMensagem(
        "Motorista fixo precisa ter um caminhão vinculado."
      );
      setSalvando(false);
      return;
    }

    if (
      formulario.tipo_motorista === "Fixo" &&
      formulario.veiculo_id
    ) {
      const motoristaDoMesmoCaminhao =
        motoristas.find(
          (motorista) =>
            motorista.id !== editandoId &&
            motorista.tipo_motorista === "Fixo" &&
            motorista.veiculo_id === formulario.veiculo_id
        );

      if (motoristaDoMesmoCaminhao) {
        setMensagem(
          `Este caminhão já está vinculado ao motorista fixo ${motoristaDoMesmoCaminhao.nome}.`
        );
        setSalvando(false);
        return;
      }
    }

    const dados = {
      nome: formulario.nome.trim(),
      cpf,
      cnh,
      categoria_cnh: formulario.categoria_cnh,
      validade_cnh: formulario.validade_cnh,
      telefone: formulario.telefone.trim() || null,
      email: formulario.email.trim() || null,
      data_admissao: formulario.data_admissao || null,
      status: formulario.status,
      tipo_motorista: formulario.tipo_motorista,
      observacao: formulario.observacao.trim() || null,
      veiculo_id:
        formulario.tipo_motorista === "Fixo"
          ? formulario.veiculo_id
          : null,
    };

    const estavaEditando = Boolean(editandoId);

    const resultado = editandoId
      ? await supabase
          .from("motoristas")
          .update(dados)
          .eq("id", editandoId)
      : await supabase.from("motoristas").insert(dados);

    if (resultado.error) {
      if (resultado.error.code === "23505") {
        setMensagem(
          "Já existe um motorista cadastrado com este CPF ou esta CNH."
        );
      } else {
        setMensagem(
          `Erro ao salvar motorista: ${resultado.error.message}`
        );
      }

      setSalvando(false);
      return;
    }

    fecharFormulario();
    await carregarDados();

    setMensagem(
      estavaEditando
        ? "Motorista atualizado com sucesso."
        : "Motorista cadastrado com sucesso."
    );

    setSalvando(false);
  }

  async function requisicaoAdministrativa(url: string, opcoes: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sessão expirada.");

    const resposta = await fetch(url, {
      ...opcoes,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(opcoes.headers ?? {}),
      },
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível concluir a operação.");
    return dados;
  }

  async function alterarStatus(
    motorista: Motorista,
    novoStatus: StatusMotorista
  ) {
    const { error } = await supabase
      .from("motoristas")
      .update({
        status: novoStatus,
      })
      .eq("id", motorista.id);

    if (error) {
      setMensagem(
        `Erro ao alterar status: ${error.message}`
      );
      return;
    }

    await carregarDados();

    setMensagem(
      `Status de ${motorista.nome} alterado para ${novoStatus}.`
    );
  }

  async function removerVeiculo(motorista: Motorista) {
    if (motorista.tipo_motorista === "Fixo") {
      setMensagem(
        "Motorista fixo precisa possuir um caminhão. Use Editar para trocar o caminhão ou transformar o motorista em folguista."
      );
      return;
    }

    const { error } = await supabase
      .from("motoristas")
      .update({
        veiculo_id: null,
      })
      .eq("id", motorista.id);

    if (error) {
      setMensagem(
        `Erro ao remover o veículo: ${error.message}`
      );
      return;
    }

    await carregarDados();

    setMensagem(
      `Caminhão desvinculado de ${motorista.nome}.`
    );
  }

  async function arquivarMotorista(motorista: Motorista) {
    const confirmar = window.confirm(
      `Arquivar ${motorista.nome}? O motorista ficará inativo, será desvinculado do caminhão e sua conta de acesso será bloqueada. O histórico será preservado.`
    );
    if (!confirmar) return;

    try {
      const dados = await requisicaoAdministrativa("/api/admin/motoristas", {
        method: "PATCH",
        body: JSON.stringify({ id: motorista.id, acao: "arquivar" }),
      });
      await carregarDados();
      setMensagem(dados.mensagem ?? "Motorista arquivado com sucesso.");
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao arquivar motorista.");
    }
  }

  async function excluirMotorista(motorista: Motorista) {
    const confirmacao = window.prompt(
      `A exclusão só é permitida sem conta vinculada e sem histórico de viagens. Para excluir ${motorista.nome}, digite EXCLUIR:`
    );
    if (confirmacao !== "EXCLUIR") return;

    try {
      await requisicaoAdministrativa(
        `/api/admin/motoristas?id=${encodeURIComponent(motorista.id)}`,
        { method: "DELETE" }
      );
      await carregarDados();
      setMensagem("Motorista excluído definitivamente.");
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao excluir motorista.");
    }
  }

  function encontrarVeiculo(veiculoId: string | null) {
    if (!veiculoId) return null;

    return (
      veiculos.find(
        (veiculo) => veiculo.id === veiculoId
      ) ?? null
    );
  }

  const motoristasFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoNumerico = somenteNumeros(termo);

    return motoristas.filter((motorista) => {
      const correspondeStatus =
        !filtroStatus ||
        motorista.status === filtroStatus;

      const correspondeTipo =
        !filtroTipo ||
        motorista.tipo_motorista === filtroTipo;

      const correspondeVeiculo =
        !filtroVeiculo ||
        motorista.veiculo_id === filtroVeiculo;

      const correspondeBusca =
        !termo ||
        motorista.nome.toLowerCase().includes(termo) ||
        (termoNumerico.length > 0 &&
          motorista.cpf.includes(termoNumerico)) ||
        (termoNumerico.length > 0 &&
          motorista.cnh.includes(termoNumerico)) ||
        (motorista.telefone ?? "")
          .toLowerCase()
          .includes(termo) ||
        (motorista.email ?? "")
          .toLowerCase()
          .includes(termo);

      return (
        correspondeStatus &&
        correspondeTipo &&
        correspondeVeiculo &&
        correspondeBusca
      );
    });
  }, [
    motoristas,
    busca,
    filtroStatus,
    filtroTipo,
    filtroVeiculo,
  ]);

  const totalMotoristas = motoristas.length;

  const ativos = motoristas.filter(
    (motorista) => motorista.status === "Ativo"
  ).length;

  const fixos = motoristas.filter(
    (motorista) =>
      motorista.tipo_motorista === "Fixo"
  ).length;

  const folguistas = motoristas.filter(
    (motorista) =>
      motorista.tipo_motorista === "Folguista"
  ).length;

  const ferias = motoristas.filter(
    (motorista) => motorista.status === "Férias"
  ).length;

  const afastadosOuInativos = motoristas.filter(
    (motorista) =>
      motorista.status === "Afastado" ||
      motorista.status === "Inativo"
  ).length;

  const vencidas = motoristas.filter(
    (motorista) =>
      situacaoCnh(motorista.validade_cnh).tipo ===
      "vencida"
  ).length;

  const vencendo = motoristas.filter(
    (motorista) =>
      situacaoCnh(motorista.validade_cnh).tipo ===
      "atencao"
  ).length;

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Motoristas
            </h1>

            <p className="mt-1 text-slate-500">
              Motoristas fixos, folguistas, caminhões e
              documentos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border bg-white px-5 py-3 font-semibold"
            >
              Voltar ao Dashboard
            </Link>

            <button
              onClick={novoMotorista}
              className="rounded-xl bg-amber-400 px-5 py-3 font-semibold"
            >
              + Novo motorista
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <CardResumo
            titulo="Total"
            valor={totalMotoristas}
          />

          <CardResumo titulo="Ativos" valor={ativos} />

          <CardResumo titulo="Fixos" valor={fixos} />

          <CardResumo
            titulo="Folguistas"
            valor={folguistas}
          />

          <CardResumo titulo="Em férias" valor={ferias} />

          <CardResumo
            titulo="Afastados/Inativos"
            valor={afastadosOuInativos}
          />

          <CardResumo
            titulo="CNHs vencendo"
            valor={vencendo}
          />

          <CardResumo
            titulo="CNHs vencidas"
            valor={vencidas}
            destaque
          />
        </section>

        {mensagem && (
          <div className="mt-6 rounded-xl border bg-white px-4 py-3">
            {mensagem}
          </div>
        )}

        {mostrarFormulario && (
          <form
            onSubmit={salvarMotorista}
            className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {editandoId
                    ? "Editar motorista"
                    : "Novo motorista"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Motoristas fixos precisam de caminhão.
                  Folguistas escolhem o caminhão ao iniciar
                  cada viagem.
                </p>
              </div>

              <button
                type="button"
                onClick={fecharFormulario}
                className="text-slate-500"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Campo titulo="Nome completo">
                <input
                  required
                  value={formulario.nome}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      nome: evento.target.value,
                    })
                  }
                  placeholder="Nome do motorista"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo titulo="Tipo de motorista">
                <select
                  value={formulario.tipo_motorista}
                  onChange={(evento) =>
                    alterarTipoMotorista(
                      evento.target.value as TipoMotorista
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="Fixo">
                    Motorista fixo
                  </option>

                  <option value="Folguista">
                    Motorista folguista
                  </option>
                </select>
              </Campo>

              <Campo titulo="Status">
                <select
                  value={formulario.status}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      status: evento.target
                        .value as StatusMotorista,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Férias">Férias</option>
                  <option value="Afastado">
                    Afastado
                  </option>
                  <option value="Inativo">Inativo</option>
                </select>
              </Campo>

              <Campo titulo="CPF">
                <input
                  required
                  inputMode="numeric"
                  maxLength={14}
                  value={formatarCpf(formulario.cpf)}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      cpf: somenteNumeros(
                        evento.target.value
                      ).slice(0, 11),
                    })
                  }
                  placeholder="000.000.000-00"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo titulo="Número da CNH">
                <input
                  required
                  inputMode="numeric"
                  maxLength={11}
                  value={formulario.cnh}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      cnh: somenteNumeros(
                        evento.target.value
                      ).slice(0, 11),
                    })
                  }
                  placeholder="Número da CNH"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo titulo="Categoria da CNH">
                <select
                  value={formulario.categoria_cnh}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      categoria_cnh:
                        evento.target.value,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="AB">AB</option>
                  <option value="AC">AC</option>
                  <option value="AD">AD</option>
                  <option value="AE">AE</option>
                </select>
              </Campo>

              <Campo titulo="Validade da CNH">
                <input
                  required
                  type="date"
                  value={formulario.validade_cnh}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      validade_cnh:
                        evento.target.value,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              {formulario.tipo_motorista === "Fixo" ? (
                <Campo titulo="Caminhão fixo obrigatório">
                  <select
                    required
                    value={formulario.veiculo_id}
                    onChange={(evento) =>
                      setFormulario({
                        ...formulario,
                        veiculo_id:
                          evento.target.value,
                      })
                    }
                    className="w-full rounded-xl border px-4 py-3"
                  >
                    <option value="">
                      Selecione o caminhão
                    </option>

                    {veiculos.map((veiculo) => (
                      <option
                        key={veiculo.id}
                        value={veiculo.id}
                      >
                        {veiculo.placa} — {veiculo.marca}{" "}
                        {veiculo.modelo}
                      </option>
                    ))}
                  </select>
                </Campo>
              ) : (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-800">
                    Motorista folguista
                  </p>

                  <p className="mt-1 text-sm text-blue-700">
                    Não possui caminhão fixo. Antes de
                    iniciar cada viagem, ele escolherá um
                    caminhão disponível.
                  </p>
                </div>
              )}

              <Campo titulo="Telefone">
                <input
                  value={formulario.telefone}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      telefone: evento.target.value,
                    })
                  }
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo titulo="E-mail">
                <input
                  type="email"
                  value={formulario.email}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      email: evento.target.value,
                    })
                  }
                  placeholder="motorista@email.com"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo titulo="Data de admissão">
                <input
                  type="date"
                  value={formulario.data_admissao}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      data_admissao:
                        evento.target.value,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <div className="md:col-span-2 xl:col-span-3">
                <Campo titulo="Observações">
                  <textarea
                    rows={3}
                    value={formulario.observacao}
                    onChange={(evento) =>
                      setFormulario({
                        ...formulario,
                        observacao:
                          evento.target.value,
                      })
                    }
                    placeholder="Cursos, restrições e informações adicionais..."
                    className="w-full rounded-xl border px-4 py-3"
                  />
                </Campo>
              </div>
            </div>

            <button
              disabled={salvando}
              className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {salvando
                ? "Salvando..."
                : editandoId
                  ? "Salvar alterações"
                  : "Cadastrar motorista"}
            </button>
          </form>
        )}

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                Motoristas cadastrados
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {motoristasFiltrados.length} registro(s)
                encontrado(s).
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                value={busca}
                onChange={(evento) =>
                  setBusca(evento.target.value)
                }
                placeholder="Buscar nome, CPF ou CNH..."
                className="min-w-64 rounded-xl border px-4 py-3"
              />

              <select
                value={filtroTipo}
                onChange={(evento) =>
                  setFiltroTipo(evento.target.value)
                }
                className="rounded-xl border px-4 py-3"
              >
                <option value="">
                  Todos os tipos
                </option>

                <option value="Fixo">Fixos</option>

                <option value="Folguista">
                  Folguistas
                </option>
              </select>

              <select
                value={filtroStatus}
                onChange={(evento) =>
                  setFiltroStatus(evento.target.value)
                }
                className="rounded-xl border px-4 py-3"
              >
                <option value="">
                  Todos os status
                </option>

                <option value="Ativo">Ativos</option>
                <option value="Férias">Em férias</option>
                <option value="Afastado">
                  Afastados
                </option>
                <option value="Inativo">
                  Inativos
                </option>
              </select>

              <select
                value={filtroVeiculo}
                onChange={(evento) =>
                  setFiltroVeiculo(evento.target.value)
                }
                className="rounded-xl border px-4 py-3"
              >
                <option value="">
                  Todos os caminhões
                </option>

                {veiculos.map((veiculo) => (
                  <option
                    key={veiculo.id}
                    value={veiculo.id}
                  >
                    {veiculo.placa}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {carregando ? (
            <p className="mt-6 text-slate-500">
              Carregando motoristas...
            </p>
          ) : motoristasFiltrados.length === 0 ? (
            <p className="mt-6 text-slate-500">
              Nenhum motorista encontrado.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {motoristasFiltrados.map(
                (motorista) => {
                  const cnh = situacaoCnh(
                    motorista.validade_cnh
                  );

                  const veiculo =
                    encontrarVeiculo(
                      motorista.veiculo_id
                    );

                  return (
                    <article
                      key={motorista.id}
                      className="rounded-2xl border bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-xl font-bold text-white">
                            {iniciais(motorista.nome)}
                          </div>

                          <div>
                            <h3 className="text-lg font-bold">
                              {motorista.nome}
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                              CNH{" "}
                              {
                                motorista.categoria_cnh
                              }{" "}
                              • {motorista.cnh}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classeStatus(
                                  motorista.status
                                )}`}
                              >
                                {motorista.status}
                              </span>

                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  motorista.tipo_motorista ===
                                  "Folguista"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {motorista.tipo_motorista}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${cnh.classe}`}
                        >
                          {cnh.texto}
                        </span>
                      </div>

                      {motorista.tipo_motorista ===
                      "Folguista" ? (
                        <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                            Motorista folguista
                          </p>

                          <p className="mt-2 font-semibold text-purple-900">
                            🚛 Escolherá o caminhão ao
                            iniciar a viagem
                          </p>

                          <p className="mt-1 text-sm text-purple-700">
                            Pode dirigir qualquer caminhão
                            disponível da frota.
                          </p>
                        </div>
                      ) : (
                        <div
                          className={`mt-5 rounded-xl border p-4 ${
                            veiculo
                              ? "border-amber-200 bg-amber-50"
                              : "border-red-200 bg-red-50"
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Caminhão fixo
                          </p>

                          {veiculo ? (
                            <div className="mt-2">
                              <p className="text-lg font-bold">
                                🚛 {veiculo.placa}
                              </p>

                              <p className="text-sm text-slate-600">
                                {veiculo.marca}{" "}
                                {veiculo.modelo} •{" "}
                                {veiculo.status}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-2 font-semibold text-red-700">
                              Caminhão não vinculado
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                        <Informacao
                          titulo="CPF"
                          valor={formatarCpf(
                            motorista.cpf
                          )}
                        />

                        <Informacao
                          titulo="Validade da CNH"
                          valor={formatarData(
                            motorista.validade_cnh
                          )}
                        />

                        <Informacao
                          titulo="Telefone"
                          valor={
                            motorista.telefone ||
                            "Não informado"
                          }
                        />

                        <Informacao
                          titulo="Admissão"
                          valor={
                            motorista.data_admissao
                              ? formatarData(
                                  motorista.data_admissao
                                )
                              : "Não informada"
                          }
                        />

                        <Informacao
                          titulo="E-mail"
                          valor={
                            motorista.email ||
                            "Não informado"
                          }
                        />
                      </div>

                      {motorista.observacao && (
                        <div className="mt-4 rounded-xl border bg-white p-3 text-sm text-slate-600">
                          {motorista.observacao}
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {motorista.status !== "Ativo" && (
                          <button
                            onClick={() =>
                              alterarStatus(
                                motorista,
                                "Ativo"
                              )
                            }
                            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"
                          >
                            Marcar ativo
                          </button>
                        )}

                        {motorista.status === "Ativo" && (
                          <button
                            onClick={() =>
                              alterarStatus(
                                motorista,
                                "Férias"
                              )
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                          >
                            Colocar em férias
                          </button>
                        )}

                        {motorista.status !==
                          "Afastado" && (
                          <button
                            onClick={() =>
                              alterarStatus(
                                motorista,
                                "Afastado"
                              )
                            }
                            className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white"
                          >
                            Afastar
                          </button>
                        )}

                        <button
                          onClick={() =>
                            editarMotorista(motorista)
                          }
                          className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() =>
                            arquivarMotorista(motorista)
                          }
                          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Arquivar
                        </button>

                        <button
                          onClick={() =>
                            excluirMotorista(motorista)
                          }
                          className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Campo({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-slate-600">
        {titulo}
      </span>

      {children}
    </label>
  );
}

function CardResumo({
  titulo,
  valor,
  destaque = false,
}: {
  titulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        destaque && valor > 0
          ? "border-red-200 bg-red-50"
          : "bg-white"
      }`}
    >
      <p className="text-sm text-slate-500">
        {titulo}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${
          destaque && valor > 0
            ? "text-red-700"
            : "text-slate-900"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

function Informacao({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">
        {titulo}
      </p>

      <p className="mt-1 font-semibold">{valor}</p>
    </div>
  );
}

function situacaoCnh(dataTexto: string) {
  const hoje = inicioDoDia(new Date());

  const validade = inicioDoDia(
    new Date(`${dataTexto}T12:00:00`)
  );

  const diferenca = Math.ceil(
    (validade.getTime() - hoje.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (diferenca < 0) {
    return {
      tipo: "vencida",
      texto: `CNH vencida há ${Math.abs(
        diferenca
      )} dia(s)`,
      classe: "bg-red-100 text-red-700",
    };
  }

  if (diferenca === 0) {
    return {
      tipo: "vencida",
      texto: "CNH vence hoje",
      classe: "bg-red-100 text-red-700",
    };
  }

  if (diferenca <= 30) {
    return {
      tipo: "atencao",
      texto: `CNH vence em ${diferenca} dia(s)`,
      classe: "bg-amber-100 text-amber-700",
    };
  }

  return {
    tipo: "regular",
    texto: "CNH regular",
    classe: "bg-green-100 text-green-700",
  };
}

function classeStatus(status: StatusMotorista) {
  if (status === "Ativo") {
    return "bg-green-100 text-green-700";
  }

  if (status === "Férias") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "Afastado") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-slate-200 text-slate-700";
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  return numeros
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarData(data: string) {
  return new Date(
    `${data}T12:00:00`
  ).toLocaleDateString("pt-BR");
}

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) =>
      parte.charAt(0).toUpperCase()
    )
    .join("");
}

function inicioDoDia(data: Date) {
  return new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate()
  );
}