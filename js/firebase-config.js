// Dados do seu projeto Firebase.
//
// Onde pegar: console.firebase.google.com → seu projeto → ⚙ Configurações do
// projeto → aba Geral → role até "Seus aplicativos" → app da Web (</>) →
// "Configuração do SDK" → copie os valores do objeto firebaseConfig.
//
// Pode deixar no repositório sem medo: estes valores são públicos por natureza
// (todo site com Firebase os expõe no navegador). Quem protege os dados são as
// regras do Firestore — veja firestore.rules — e não o segredo destas chaves.
//
// Enquanto estiver vazio, o app roda em modo local: tudo funciona, só que os
// dados ficam guardados apenas no aparelho, sem login e sem sincronizar.
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",     // ex.: caloriquest.firebaseapp.com
  projectId: "",      // ex.: caloriquest
  appId: "",
};

// Versão do SDK do Firebase carregada do CDN do Google. Dá para atualizar aqui.
const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/10.12.2";
