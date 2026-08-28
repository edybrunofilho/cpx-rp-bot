# cpx guardian — painel exclusivo de joaodayz.

Este módulo acrescenta `/cpxpainel`, com `/guardian` como atalho, `/warn` e `/userinfo`. O acesso é conferido no servidor pelo ID **1300178869319635004**, não pelo nome de usuário nem pelo cargo. O Application ID informado é **1542567571255984168**.

**Não foi instalado no seu servidor automaticamente.** O código e os arquivos de hospedagem estão prontos para configurar. Nenhum token foi incluído. Os testes usam respostas simuladas do Discord.

## O painel oferece

- Membros: consulta por ID, cargos, entrada no servidor e advertências privadas.
- Warn, timeout (0 remove; máximo 24 horas), kick e ban, todos com revisão e confirmação.
- Anúncios em um canal permitido, com prévia e confirmação, sem notificações de menções.
- Logs privados persistentes de ações solicitadas, aplicadas, recusadas e incertas.
- Configurações: consulta dos IDs de servidor, cargos, canal de anúncios e link do site. Alterações desses IDs são feitas nas variáveis privadas da hospedagem. Não há editor de tokens no Discord.
- Painel web em `/owner`, usando o login Discord existente do CPX ROLEPLAY.

As funções anteriores de RP em `/cpx` conservam suas permissões: cidadãos, administração, prefeitura e governo. Este módulo não transforma todos os comandos do RP em comandos exclusivos. As advertências de `/warn` são privadas nesta central, separadas das advertências da administração do RP.

## 1. Preparar o aplicativo Discord

1. Acesse https://discord.com/developers/applications e abra o aplicativo `1542567571255984168`.
2. Nome do aplicativo e do bot: **cpx guardian**. Configure a foto CPX.
3. Em OAuth2, adicione exatamente este Redirect:
   `https://cpx-roleplay.flowy-shell-1951.chatgpt.site/api/cpx/auth/callback`
4. Copie Application ID, Public Key, Client Secret e Bot Token para os campos privados da hospedagem. Não envie os dois segredos no chat ou no repositório.
5. Abra o arquivo `public/invite.html`, clique em **Gerar convite** e depois **Adicionar ao Discord**. Pode abri-lo como arquivo local, sem servidor.
6. Autorize o bot no seu servidor. As permissões são: Ver canais, Enviar mensagens, Ler histórico, Gerenciar canais, Moderar membros, Expulsar membros e Banir membros. Não conceda Administrador. Gerenciar canais é necessário para criar a categoria.
7. Posicione o cargo do bot acima dos membros que serão moderados. Sua conta também precisa ter a permissão correspondente e hierarquia suficiente. Donos do servidor, administradores, bots e sua própria conta são protegidos pelo módulo.
8. O bot usa interações HTTP: não precisa de Message Content Intent nem de Server Members Intent para a consulta individual por ID. Pode aparecer offline na lista, pois não mantém conexão Gateway de presença; isso não indica sozinho que os comandos HTTP falharam.

## 2. Escolher UMA hospedagem

As configurações Render e Railway hospedam somente o serviço Node do bot e banco. O frontend continua no endereço privado do CPX. Não faça duas instâncias: SQLite exige uma única instância com disco persistente.

### Render

1. Coloque os arquivos extraídos em um repositório Git privado seu; inclua a pasta `backend`,`lib/cpx`, `public/cpx-brand.png`, `Dockerfile.backend` e `render.yaml`. Não inclua `.env` ou dados reais.
2. No Render, crie um **Blueprint** ligado a esse repositório e revise o `render.yaml` antes de confirmar.
3. O arquivo configura um serviço Docker com disco de 1 GB em `/data` e plano pago compatível. **Revise o custo antes de criar.** Este projeto não é adequado ao disco temporário do plano Free.
4. Preencha os campos solicitados com os valores reais. O Render gera `CPX_PROXY_SECRET`; copie esse valor somente para a configuração privada do siteərlər.
5. O serviço expõe `/healthz` para verificação de saúde. O Docker inicia `node backend/server.mjs` e lê a porta fornecida pela hospedagem.
6. Anote o endereço HTTPS do serviço. Não confunda com o endereço do frontend.

### Railway

1. Crie um serviço a partir do repositório privado com `Dockerfile.backend` e `railway.toml` na raiz. Revise o custo antes de publicar.
2. O arquivo Railway seleciona Docker. Caso a interface não importe essa configuração, escolha `Dockerfile.backend` manualmente, defina o health check `/healthz` e mantenha **uma réplica**.
3. Adicione **um Volume** montado em `/data` e defina `DATA_DIR=/data`. O arquivo TOML não cria o volume automaticamente.
4. Preencha as variáveis abaixo em **Variables**. Gere um domínio HTTPS para o serviço.
5. Se o painel pedir Start Command: `node backend/server.mjs`. O `Procfile` também contém esse comando para plataformas que o reconheçam. Não use `npm start` da raiz, pois ele pertence ao frontend Sites.

### Variáveis do serviço

Use `backend/.env.example` como referência. Na hospedagem, use campos privados em vez de enviar `.env` ao Git.

| Variável | Valor |
|---|---|
| `DISCORD_CLIENT_ID` | `1542567571255984168` |
| `DISCORD_CLIENT_SECRET` | Segredo OAuth2 do aplicativo |
| `DISCORD_BOT_TOKEN` | Token privado do bot |
| `DISCORD_PUBLIC_KEY` | Public Key do aplicativo |
| `DISCORD_GUILD_ID` | ID numérico do seu servidor |
| `DISCORD_ADMIN_ROLE_ID` | ID do cargo administrador do RP |
| `DISCORD_MAYOR_ROLE_ID` | ID do cargo prefeito |
| `DISCORD_GOVERNMENT_ROLE_ID` | ID do cargo governo |
| `DISCORD_ANNOUNCEMENT_CHANNEL_ID` | ID do canal permitido para anúncios |
| `PUBLIC_ORIGIN` | `https://cpx-roleplay.flowy-shell-1951.chatgpt.site` |
| `CPX_PROXY_SECRET` | Segredo aleatório de pelo menos 32 caracteres, igual no site e no serviço |
| `DATA_DIR` | `/data` no volume persistente |
| `CPX_AI_ENABLED` | `false` inicialmente |

Os três cargos de RP precisam existir e precisam ser configurados para iniciar o serviço. O ID autorizado do painel privado está fixado no código; alterar esses cargos não transfere acesso ao painel.

Para gerar uma chave privada no seu computador, use:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 3 Conectar e registrar

1. No Developer Portal, configure **Interactions Endpoint URL** para `https://SEU-SERVICO/discord/interactions`. Substitua SEU-SERVICO pelo domínio HTTPS da hospedagem. O serviço precisa responder ao teste assinado do Discord.
2. Nas variáveis privadas do site, configure `CPX_BACKEND_URL=https://SEU-SERVICO` e `CPX_PROXY_SECRET` com o mesmo segredo do serviço. Publique essa configuração. Não coloque o token do Discord no frontend.
3. No terminal da hospedagem, a partir da raiz do projeto, execute `node backend/register-commands.mjs`. O registro atualiza somente os cinco comandos CPX, preservando os demais.
4. Em **Configurações do servidor → Integrações → cpx guardian**, libere `/cpxpainel`, `/guardian`, `/warn` e `/userinfo` para o usuário `1300178869319635004`. Esses comandos têm permissões padrão desativadas. Administradores ainda podem vê-los na lista, mas o código recusa qualquer outro ID.
5. No site, entre com Discord e abra `/owner`. Na demonstração, o painel permanece bloqueado.

## 4. Criar a categoria privada

Execute no terminal da instância que possui o volume `/data`, a partir da raiz:

```bash
CONFIRM_PRIVATE_SETUP=true node backend/setup-private.mjs
```

No Windows, dentro da pasta `backend`, com `.env` preenchido:

```bat
set CONFIRM_PRIVATE_SETUP=true
node --env-file=.env setup-private.mjs
set CONFIRM_PRIVATE_SETUP=
```

O instalador cria a categoria **cpx guardian · privado**, o canal **painel-joaodayz** e uma mensagem com os botões do painel. Ele salva os IDs no mesmo SQLite e os reutiliza nas próximas execuções. Não é executado automaticamente na inicialização. Não rode dois instaladores juntos. Se uma criação for interrompida, confira o Discord antes de repetir.

**Limite do Discord:** dono do servidor e membros com Administrador podem enxergar canais privados. O bot também tem acesso técnico ao canal. Mesmo assim, os controles verificam seu ID e não aceitam ações de outros usuários.

## 5. Testar antes de usar

1. Use `/cpxpainel` com sua conta. Confira Membros, Postar anúncio, Logs e Configurações.
2. Confirme que outra conta é recusada, inclusive se tiver Administrador.
3. Consulte um membro de teste. Prepare um warn e cancele; depois prepare outro e confirme.
4. Confira os logs. Teste timeout curto apenas com um membro que concordou com o teste.
5. Envie um anúncio inofensivo para o canal configurado e confira o texto antes de confirmar.
6. Kick e ban são ações reais. Use apenas em membros que você pretende moderar.

Se o resultado aparecer como **incerto**, confira o estado no Discord. A aplicação não repete automaticamente ações após falhas de rede ou reinícios. Confirmações expiram após 5 minutos.

Faça backups do SQLite com o serviço parado ou com a ferramenta de backup SQLite. Nunca exponha o arquivo de dados, tokens ou logs privados. Para restaurar, pare o serviço e preserve o volume.

## Documentação oficial

- [Permissões Discord](https://docs.discord.com/developers/topics/permissions)
- [Interações Discord](https://docs.discord.com/developers/interactions/receiving-and-responding)
- [Render Blueprint](https://render.com/docs/blueprint-spec)
- [Discos persistentes Render](https://render.com/docs/disks)
- [Configuração Railway](https://docs.railway.com/config-as-code/reference)
- [Volumes Railway](https://docs.railway.com/volumes)
