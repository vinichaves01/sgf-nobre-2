# SGF Nobre Motorista — aplicativo Android (Etapa 1)

Esta versão mantém o SGF web e acrescenta a base do aplicativo nativo com rastreamento em segundo plano.

## O que foi adicionado

- Capacitor 8;
- plugin nativo `@capgo/background-geolocation`;
- configuração do aplicativo Android;
- rastreamento nativo com notificação permanente;
- endpoint que cria um token temporário de rastreamento;
- endpoint nativo que recebe posições mesmo quando a WebView está suspensa;
- interrupção do rastreamento ao encerrar a jornada ou sair do sistema;
- fallback para o GPS do navegador quando o SGF for aberto como site.

## Variáveis novas na Vercel

Crie estas variáveis somente nos ambientes Production, Preview e Development:

### SUPABASE_SERVICE_ROLE_KEY

Copie a chave `service_role` do Supabase. Esta chave é secreta e NUNCA deve começar com `NEXT_PUBLIC_`.

### MOBILE_TRACKING_SECRET

Use uma sequência aleatória com pelo menos 32 caracteres. Exemplo de formato:

`troque-isto-por-uma-chave-aleatoria-com-64-caracteres`

Depois faça um novo deploy.

## Instalação local para gerar o Android

Requisitos:

- Node.js 22;
- Android Studio atualizado;
- Java 21.

Na pasta do projeto:

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

No Android Studio, aguarde o Gradle terminar e use:

`Build > Build App Bundles or APKs > Build APKs`

## Teste obrigatório

1. Instale o APK no Android.
2. Entre como motorista.
3. Inicie uma jornada.
4. Toque em Ativar GPS.
5. Aceite localização precisa e notificações.
6. Bloqueie a tela por 10 minutos.
7. Confira se a Central de Operações continua recebendo posições.

## Observação sobre iPhone

A mesma base está preparada para iOS, mas a geração do aplicativo exige macOS, Xcode e assinatura Apple Developer.
