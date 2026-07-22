# Meta Alvo | Xadrez

Site em React para jogar xadrez contra um bot, com três níveis de dificuldade e
análise das jogadas em português. Tudo roda no navegador: o motor é próprio,
escrito do zero, e não depende de servidor, API nem chave de nada.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run preview  # serve o build
```

## Conta, perfil e etiqueta

Entrar com o Google é opcional: dá para jogar como convidado, e nesse caso o
progresso fica salvo só naquele navegador.

Quem entra com e-mail do domínio `metaalvo.com` recebe a etiqueta dourada
**META PLAYER**. Qualquer outra conta recebe **NORMAL PLAYER**. A regra está em
`src/game/perfil.js`, na função `etiquetaDe`, e olha tanto o final do e-mail
quanto o campo `hd` que o Google Workspace envia.

O perfil guarda partidas, vitórias, empates, derrotas, aproveitamento, precisão
média, melhor partida, melhor sequência e o desempenho separado por
dificuldade. Existe também uma patente que sobe com vitórias pesadas pela
dificuldade, de "Iniciante da casa" a "Mestre da Meta Alvo".

### Configurar o login

O `.env` já vem no repositório com o Client ID preenchido, então clonar e rodar
`npm install && npm run dev` é suficiente. O passo a passo para gerar outro
Client ID, se precisar, está dentro do `.env.example`.

Enquanto a chave não existir, a tela de entrada mostra as instruções em vez de
um botão quebrado, e o "Jogar sem conta" continua funcionando.

**Por que o `.env` está versionado.** O Client ID do Google não é segredo: ele é
embutido no JavaScript que todo visitante baixa, então esconder não protegeria
nada. Quem protege a chave é a lista de *Origens JavaScript autorizadas* no
Google Cloud Console, que só deixa o login funcionar a partir dos endereços que
você cadastrar. Ao publicar em produção, lembre de adicionar o domínio novo lá,
senão o botão do Google para de funcionar.

Isso vale só para valores públicos. Chave de API, client secret ou token vão em
`.env.local`, que continua no `.gitignore`. É a convenção do próprio Vite.

### Um aviso honesto sobre a etiqueta

O login roda inteiro no navegador. O app lê o conteúdo do token que o Google
devolve para montar o perfil, mas **não confere a assinatura dele**, porque isso
exige um servidor. Na prática: a etiqueta é enfeite, não credencial. Quem abrir
o console e editar o `localStorage` consegue se dar META PLAYER.

Isso é aceitável enquanto a etiqueta for cosmética. No dia em que ela valer algo
de verdade (ranking oficial, prêmio, acesso a alguma coisa), vai precisar de um
backend que receba o token, valide a assinatura contra as chaves públicas do
Google, confirme o `aud` e o `hd`, e só então grave o resultado. Está anotado
como próximo passo mais abaixo.

## O que tem

**Três dificuldades.** Trocar de nível começa uma partida nova.

| Nível | Profundidade | Como erra |
| --- | --- | --- |
| Iniciante | 2 lances | Sem busca de quietude, então não enxerga o fim das trocas. Deixa peça pendurada e tem 35% de chance de escolher um lance mediano de propósito. |
| Intermediário | até 6 | Calcula táticas curtas e pune peça pendurada. Ruído pequeno na escolha. |
| Avançado | até 20, 2,2s por lance | Sempre o melhor lance que encontrar. Sem ruído. |

**Análise da IA.** Depois de cada lance seu aparece um veredito (Brilhante,
Melhor jogada, Excelente, Boa, Imprecisão, Erro, Erro grave) e um comentário
explicando o que aconteceu: o que o lance fez, qual peça ficou pendurada, como o
bot pune e qual era o melhor lance com a sequência principal.

A perda é medida em pontos de probabilidade de vitória, não em centipeões crus.
Perder 200 centipeões numa posição equilibrada é grave; perder os mesmos 200 com
uma dama a mais quase não muda o jogo.

**Botão "Melhor jogada".** Joga o lance recomendado no tabuleiro, animado, e
segue jogando a continuação prevista, como se a partida estivesse acontecendo.
Dá para pausar, voltar, avançar lance a lance ou clicar direto em qualquer lance
da sequência. Nada disso conta na partida: ao fechar, o tabuleiro volta exato
para onde estava.

**Botão "Ver no tabuleiro como era melhor".** Aparece no painel de análise
quando você erra. Reproduz o lance certo a partir da posição de antes do seu
erro, para comparar com o que você fez.

**Botão "Jogadas".** Lista as 6 melhores opções da posição atual com nota,
motivo ("ganha 3.0 de material", "com xeque", "desenvolve peça") e a sequência
prevista. Passar o mouse destaca a seta daquela opção e clicar reproduz a linha
inteira no tabuleiro.

**Relógio.** Sem tempo, 3+2, 5+3 ou 10+5, com incremento por lance, aviso
visual nos últimos 20 segundos e derrota por tempo. O relógio pausa durante
demonstração e revisão, que são ferramentas de estudo e não parte da partida.

**Relatório da partida.** Precisão de cada lado no fim (e durante), calculada
por perda de probabilidade de vitória, mais a contagem de brilhantes, melhores
lances, imprecisões, erros e erros graves de cada um.

**Gráfico da partida.** A avaliação lance a lance, com os pontos coloridos pela
qualidade do lance. Clicar em qualquer ponto leva o tabuleiro para aquela
posição.

**Revisão.** Clique em qualquer lance do histórico ou use ← e → para andar pela
partida. O tabuleiro anima entre as posições e a análise daquele lance reaparece.

**Setas e círculos seus.** Botão direito arrastando desenha uma seta; botão
direito clicando marca um círculo. Some sozinho no próximo lance.

**Modo treino.** Acende em vermelho as suas peças que o bot pode capturar
ganhando material, calculado por troca estática no motor. Bom para parar de
deixar peça pendurada.

**Livro de aberturas.** O bot escolhe entre lances de livro nos primeiros
lances, então cada partida começa diferente, e o nome da abertura aparece no
topo (Siciliana, Espanhola, Índia do Rei e por aí).

**Dica leve.** Marca só a casa da peça que resolve, sem entregar o lance, para
você tentar achar o resto.

Ainda: barra de avaliação animada, histórico com selo de qualidade em cada
lance, peças capturadas com a vantagem material, voltar lance, desistir, girar
o tabuleiro (tecla F), três temas de tabuleiro, coordenadas opcionais, copiar o
PGN, promoção, arrastar ou clicar para mover, sons sintetizados na hora (sem
arquivo) e atalhos de teclado (← → navegam, F gira, H dá dica, M mostra o
melhor lance, N recomeça, Esc sai da revisão, espaço pausa a demonstração).

**Retoma onde parou.** Preferências e a partida em andamento ficam salvas no
navegador. Ao recarregar, o jogo volta no mesmo ponto. A análise dos lances
anteriores não é refeita para não gastar processamento à toa, então os selos do
histórico voltam vazios.

## Como o motor funciona

`src/engine/` não usa biblioteca nenhuma. A chess.js entra só na interface, como
árbitro das regras e para gerar a notação.

- `core.js`: tabuleiro 0x88, geração de lances, make/unmake, Zobrist e SEE.
- `evaluate.js`: material e tabelas peça/casa interpoladas entre meio-jogo e
  final (PeSTO), estrutura de peões, par de bispos, torre em coluna aberta,
  abrigo do rei e mobilidade.
- `search.js`: negamax com alfa-beta, aprofundamento iterativo, tabela de
  transposição, busca de quietude, poda de lance nulo, poda de futilidade,
  redução de lances tardios, matadores e histórico.
- `engine.worker.js`: roda tudo em Web Worker, então o tabuleiro continua
  animando enquanto o bot pensa.

Por que motor próprio: a geração de lances da chess.js faz cerca de 7 mil
posições por segundo, o que não sustenta uma busca profunda. Esta faz 3,3
milhões.

### Testes

```bash
npm run test:perft     # conta posições e compara com os valores conhecidos
npm run test:taticas   # conjunto Win At Chess + confronto entre profundidades
npm run test:motor     # mates curtos, velocidade e partida do motor contra ele mesmo
```

O perft bate exatamente nas 6 posições padrão (inclusive Kiwipete até
profundidade 4, com 4.085.603 posições). O alfa-beta foi conferido contra um
minimax puro: com as heurísticas desligadas, as notas são idênticas.

No conjunto Win At Chess, acerta 7 de 10 com 3 segundos por posição. As três que
erram (WAC.004, WAC.011 e WAC.002) pedem cálculo longo demais para uma avaliação
simples como esta; desligar podas não resolve, só reduz a profundidade
alcançada.

## Estrutura

```
src/
  engine/     core, avaliação, busca, níveis, worker
  game/       classificação e comentário, precisão, aberturas, opções, sons
  components/ tabuleiro, peças em SVG, painéis, gráfico e relatório
  hooks/      ponte com o worker
  App.jsx     orquestração da partida
  styles.css  identidade visual
scripts/      testes do motor em Node
```

A partida inteira vive numa lista de "quadros": cada quadro é uma foto da
posição depois de um lance, com as peças, a identidade de cada uma, a
avaliação e o veredito. É essa lista que alimenta a animação, a revisão, o
gráfico e o relatório, em vez de cada recurso reconstruir a partida por conta
própria.

## Paleta

Fundo escuro `#0d0618`, roxos `#7c3aed` e `#a855f7`, lilás `#c9b6ff` e dourado
champanhe `#e7c98a`. As peças brancas são douradas e as pretas, ametista.
Nenhum arquivo de imagem: as peças são SVG desenhado no próprio projeto.

## Próximos passos sugeridos

Levantamento do que ainda separa isso de um produto acabado, em ordem de
impacto:

1. **Validar o login no servidor.** Enquanto não houver backend conferindo a
   assinatura do token do Google, a etiqueta META PLAYER é decorativa.
2. **Ranking entre colegas.** Só faz sentido depois do item 1, senão qualquer um
   forja a pontuação. Um endpoint simples com Firebase ou Supabase resolve.
3. **Puzzles táticos.** O motor já sabe achar o melhor lance e medir perda de
   material; falta uma base de posições e a tela de "ache o lance".
4. **Layout de celular com abas.** Hoje a coluna da direita empilha embaixo do
   tabuleiro e fica comprida. Abas (Análise, Jogadas, Histórico) resolveriam.
5. **PWA instalável.** Manifesto e service worker para abrir como aplicativo e
   funcionar sem internet, que o motor já permite por rodar local.
6. **Cartão de resultado para compartilhar.** Uma imagem com placar, precisão e
   a etiqueta, no visual da marca.
7. **Análise da partida inteira de uma vez.** Hoje cada lance é analisado no
   momento em que acontece; um botão "analisar tudo" reprocessaria a partida
   importada por PGN.
8. **Importar PGN e FEN.** Já dá para exportar; falta o caminho inverso para
   estudar posições de fora.
9. **Escolha de conjunto de peças.** Hoje há um só, desenhado no projeto.
10. **Traduzir os textos.** A estrutura já separa o conteúdo em português dos
    componentes, então adicionar inglês é mecânico.
