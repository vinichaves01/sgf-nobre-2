# Correção de viagens — instalação

Esta versão corrige:

- cronômetro calculado a partir de `iniciado_em`, igual em computador e celular;
- sincronização em tempo real e atualização ao voltar para a tela;
- KM inicial obrigatório e limitado a 9.999.999 km;
- KM final maior ou igual ao inicial;
- distância máxima de 10.000 km por viagem;
- finalização/cancelamento pelo motorista que iniciou ou por administrador;
- registro de quem iniciou e quem encerrou;
- mensagens amigáveis no lugar dos erros técnicos do banco.

## Etapa obrigatória 1 — Supabase

1. Abra o projeto no Supabase.
2. Entre em **SQL Editor**.
3. Clique em **New query**.
4. Copie todo o conteúdo de:
   `supabase/migrations/20260721_corrigir_viagens.sql`
5. Clique em **Run**.

Sem essa etapa, os novos botões de finalizar/cancelar não funcionarão.

## Etapa 2 — GitHub/Vercel

Substitua o projeto antigo por esta versão, faça commit no GitHub e aguarde o novo deploy da Vercel.

## Teste final

1. Inicie uma viagem com KM realista.
2. Abra o sistema em outro aparelho com o mesmo usuário.
3. Confira se o cronômetro mostra o mesmo tempo.
4. Finalize no outro aparelho.
5. Confira se a viagem desapareceu de “Em andamento” nos dois aparelhos.
