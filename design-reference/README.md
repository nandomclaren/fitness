# Referências de design

Screenshots de outros apps (ex.: Alpha Progression) usados como referência visual/UX
pra trazer ideias pro Maromba. **Não é usado pelo app** — não fica em `src/` nem
`public/`, então nunca entra no build nem no bundle do PWA.

## Como adicionar imagens

Mais rápido pelo GitHub direto, sem precisar de git na sua máquina:

1. Abra a pasta [`design-reference`](https://github.com/nandomclaren/fitness/tree/main/design-reference)
   no navegador (ou crie uma subpasta, ex. `design-reference/alpha-progression/`).
2. Clique em **Add file → Upload files**.
3. Arraste as imagens (dá pra soltar várias de uma vez, até 100 arquivos por upload).
4. Escreva uma mensagem de commit curta e clique em **Commit changes** (direto na
   branch que estiver aberta, ou crie uma nova branch se preferir).
5. Me avisa aqui no chat que subiu — eu dou um `git pull` e já consigo ver as imagens.

## Organização sugerida

Uma subpasta por app/fonte, com nomes de arquivo que digam o que é a tela (o nome
original do print geralmente não ajuda nada):

```
design-reference/
  alpha-progression/
    01-home.png
    02-onboarding-objetivo.png
    03-tela-treino-serie.png
    04-resumo-pos-treino.png
    ...
```

Não precisa ser rigoroso — só ajuda eu entender o contexto de cada print sem
precisar perguntar "essa tela é de quê?" pra cada uma.
