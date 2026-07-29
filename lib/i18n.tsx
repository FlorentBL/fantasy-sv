"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const languages = [
  { code: "fr", label: "Français", short: "FR" },
  { code: "en", label: "English", short: "EN" },
  { code: "it", label: "Italiano", short: "IT" },
  { code: "es", label: "Español", short: "ES" },
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "pt", label: "Português", short: "PT" },
] as const;

export type Language = (typeof languages)[number]["code"];
type Variables = Record<string, string | number>;
type TranslationRow = [fr: string, it: string, es: string, de: string, pt: string];

const translationIndex: Record<Exclude<Language, "en">, number> = {
  fr: 0,
  it: 1,
  es: 2,
  de: 3,
  pt: 4,
};

const translations: Record<string, TranslationRow> = {
  "Select language": ["Choisir la langue", "Seleziona lingua", "Seleccionar idioma", "Sprache wählen", "Selecionar idioma"],
  "Main navigation": ["Navigation principale", "Navigazione principale", "Navegación principal", "Hauptnavigation", "Navegação principal"],
  "My team": ["Mon équipe", "La mia squadra", "Mi equipo", "Mein Team", "A minha equipa"],
  "Market": ["Marché", "Mercato", "Mercado", "Markt", "Mercado"],
  "Rules": ["Règles", "Regole", "Reglas", "Regeln", "Regras"],
  "Sign in": ["Connexion", "Accedi", "Iniciar sesión", "Anmelden", "Entrar"],
  "Fantasy SV home": ["Accueil Fantasy SV", "Home Fantasy SV", "Inicio de Fantasy SV", "Fantasy-SV-Startseite", "Início do Fantasy SV"],
  "Build fifteen Premier League players with 100 credits and prepare your season.": [
    "Compose quinze joueurs de Premier League avec 100 crédits et prépare ta saison.",
    "Scegli quindici giocatori di Premier League con 100 crediti e prepara la tua stagione.",
    "Elige quince jugadores de la Premier League con 100 créditos y prepara tu temporada.",
    "Stelle mit 100 Credits fünfzehn Premier-League-Spieler zusammen und bereite deine Saison vor.",
    "Escolhe quinze jogadores da Premier League com 100 créditos e prepara a tua época.",
  ],
  "Competition": ["Compétition", "Competizione", "Competición", "Wettbewerb", "Competição"],
  "England": ["Angleterre", "Inghilterra", "Inglaterra", "England", "Inglaterra"],
  "Soccerverse season": ["Saison Soccerverse", "Stagione Soccerverse", "Temporada Soccerverse", "Soccerverse-Saison", "Época Soccerverse"],
  "Team overview": ["Résumé de l’équipe", "Riepilogo squadra", "Resumen del equipo", "Teamübersicht", "Resumo da equipa"],
  "Squad": ["Effectif", "Rosa", "Plantilla", "Kader", "Plantel"],
  "Remaining budget": ["Budget restant", "Budget rimanente", "Presupuesto restante", "Restbudget", "Orçamento restante"],
  "Gameweek": ["Journée", "Giornata", "Jornada", "Spieltag", "Jornada"],
  "Build your squad": ["Construis ton effectif", "Costruisci la tua rosa", "Construye tu plantilla", "Stelle deinen Kader zusammen", "Constrói o teu plantel"],
  "Every decision counts. Prices reflect the strength of Premier League players.": [
    "Chaque décision compte. Les prix reflètent la force des joueurs de Premier League.",
    "Ogni decisione conta. I prezzi riflettono la forza dei giocatori di Premier League.",
    "Cada decisión cuenta. Los precios reflejan la calidad de los jugadores de la Premier League.",
    "Jede Entscheidung zählt. Die Preise spiegeln die Stärke der Premier-League-Spieler wider.",
    "Cada decisão conta. Os preços refletem a força dos jogadores da Premier League.",
  ],
  "used": ["utilisés", "utilizzati", "usados", "verwendet", "utilizados"],
  "available": ["disponibles", "disponibili", "disponibles", "verfügbar", "disponíveis"],
  "Selected squad": ["Effectif sélectionné", "Rosa selezionata", "Plantilla seleccionada", "Ausgewählter Kader", "Plantel selecionado"],
  "Squad complete": ["Effectif complet", "Rosa completa", "Plantilla completa", "Kader vollständig", "Plantel completo"],
  "{count} spots remaining": ["{count} places restantes", "{count} posti rimasti", "{count} plazas restantes", "{count} Plätze frei", "{count} lugares restantes"],
  "Ready": ["Prêt", "Pronta", "Listo", "Bereit", "Pronto"],
  "Remove {player}": ["Retirer {player}", "Rimuovi {player}", "Quitar a {player}", "{player} entfernen", "Remover {player}"],
  "Save team": ["Enregistrer l’équipe", "Salva la squadra", "Guardar equipo", "Team speichern", "Guardar equipa"],
  "Complete team": ["Compléter l’équipe", "Completa la squadra", "Completar equipo", "Team vervollständigen", "Completar equipa"],
  "Player market": ["Marché des joueurs", "Mercato giocatori", "Mercado de jugadores", "Spielermarkt", "Mercado de jogadores"],
  "Choose a player": ["Choisir un joueur", "Scegli un giocatore", "Elegir un jugador", "Spieler auswählen", "Escolher um jogador"],
  "{count} results": ["{count} résultats", "{count} risultati", "{count} resultados", "{count} Ergebnisse", "{count} resultados"],
  "Search": ["Rechercher", "Cerca", "Buscar", "Suchen", "Pesquisar"],
  "Player or club": ["Joueur ou club", "Giocatore o club", "Jugador o club", "Spieler oder Verein", "Jogador ou clube"],
  "Position": ["Poste", "Ruolo", "Posición", "Position", "Posição"],
  "All positions": ["Tous les postes", "Tutti i ruoli", "Todas las posiciones", "Alle Positionen", "Todas as posições"],
  "Club": ["Club", "Club", "Club", "Verein", "Clube"],
  "All clubs": ["Tous les clubs", "Tutti i club", "Todos los clubes", "Alle Vereine", "Todos os clubes"],
  "Sort": ["Tri", "Ordina", "Ordenar", "Sortieren", "Ordenar"],
  "Highest price": ["Prix décroissant", "Prezzo più alto", "Mayor precio", "Höchster Preis", "Preço mais alto"],
  "Lowest price": ["Prix croissant", "Prezzo più basso", "Menor precio", "Niedrigster Preis", "Preço mais baixo"],
  "Best rating": ["Meilleure note", "Valutazione migliore", "Mejor valoración", "Beste Bewertung", "Melhor avaliação"],
  "Name": ["Nom", "Nome", "Nombre", "Name", "Nome"],
  "Loading player market": ["Chargement du marché", "Caricamento del mercato", "Cargando el mercado", "Spielermarkt wird geladen", "A carregar o mercado"],
  "Market unavailable": ["Le marché ne répond pas", "Il mercato non risponde", "El mercado no responde", "Der Markt ist nicht erreichbar", "O mercado não está disponível"],
  "Soccerverse market unavailable.": ["Marché Soccerverse indisponible.", "Mercato Soccerverse non disponibile.", "Mercado de Soccerverse no disponible.", "Soccerverse-Markt nicht verfügbar.", "Mercado Soccerverse indisponível."],
  "Try again": ["Réessayer", "Riprova", "Reintentar", "Erneut versuchen", "Tentar novamente"],
  "Power {score}": ["Puissance {score}", "Forza {score}", "Potencia {score}", "Stärke {score}", "Força {score}"],
  "credits": ["crédits", "crediti", "créditos", "Credits", "créditos"],
  "Add {player}": ["Ajouter {player}", "Aggiungi {player}", "Añadir a {player}", "{player} hinzufügen", "Adicionar {player}"],
  "No player found": ["Aucun joueur trouvé", "Nessun giocatore trovato", "No se encontró ningún jugador", "Kein Spieler gefunden", "Nenhum jogador encontrado"],
  "Change the filters to broaden your search.": [
    "Modifie les filtres pour élargir la recherche.",
    "Modifica i filtri per ampliare la ricerca.",
    "Cambia los filtros para ampliar la búsqueda.",
    "Ändere die Filter, um die Suche zu erweitern.",
    "Altera os filtros para ampliar a pesquisa.",
  ],
  "Showing the first {count} players. Use search to refine.": [
    "Affichage des {count} premiers joueurs. Utilise la recherche pour affiner.",
    "Sono mostrati i primi {count} giocatori. Usa la ricerca per affinare.",
    "Se muestran los primeros {count} jugadores. Usa la búsqueda para afinar.",
    "Die ersten {count} Spieler werden angezeigt. Nutze die Suche zum Eingrenzen.",
    "São apresentados os primeiros {count} jogadores. Usa a pesquisa para refinar.",
  ],
  "Suspended": ["Suspendu", "Squalificato", "Sancionado", "Gesperrt", "Suspenso"],
  "Injured": ["Blessé", "Infortunato", "Lesionado", "Verletzt", "Lesionado"],
  "{player} joined your team.": ["{player} rejoint ton équipe.", "{player} entra nella tua squadra.", "{player} se une a tu equipo.", "{player} ist jetzt in deinem Team.", "{player} entrou na tua equipa."],
  "{player} was removed.": ["{player} a été retiré.", "{player} è stato rimosso.", "Se ha quitado a {player}.", "{player} wurde entfernt.", "{player} foi removido."],
  "Player removed.": ["Joueur retiré.", "Giocatore rimosso.", "Jugador eliminado.", "Spieler entfernt.", "Jogador removido."],
  "Complete all 15 spots before saving your team.": [
    "Complète les 15 places avant d’enregistrer ton équipe.",
    "Completa tutti i 15 posti prima di salvare la squadra.",
    "Completa las 15 plazas antes de guardar tu equipo.",
    "Besetze alle 15 Plätze, bevor du dein Team speicherst.",
    "Preenche os 15 lugares antes de guardar a equipa.",
  ],
  "Team saved on this device.": ["Équipe enregistrée sur cet appareil.", "Squadra salvata su questo dispositivo.", "Equipo guardado en este dispositivo.", "Team auf diesem Gerät gespeichert.", "Equipa guardada neste dispositivo."],
  "This player is already in your team.": ["Ce joueur est déjà dans ton équipe.", "Questo giocatore è già nella tua squadra.", "Este jugador ya está en tu equipo.", "Dieser Spieler ist bereits in deinem Team.", "Este jogador já está na tua equipa."],
  "Your squad is already complete.": ["Ton effectif est déjà complet.", "La tua rosa è già completa.", "Tu plantilla ya está completa.", "Dein Kader ist bereits vollständig.", "O teu plantel já está completo."],
  "You already have {count} players in this position.": ["Tu as déjà {count} joueurs à ce poste.", "Hai già {count} giocatori in questo ruolo.", "Ya tienes {count} jugadores en esta posición.", "Du hast bereits {count} Spieler auf dieser Position.", "Já tens {count} jogadores nesta posição."],
  "Maximum three players from the same club.": ["Maximum trois joueurs du même club.", "Massimo tre giocatori dello stesso club.", "Máximo tres jugadores del mismo club.", "Maximal drei Spieler desselben Vereins.", "Máximo de três jogadores do mesmo clube."],
  "Not enough budget for this player.": ["Budget insuffisant pour ce joueur.", "Budget insufficiente per questo giocatore.", "Presupuesto insuficiente para este jugador.", "Nicht genug Budget für diesen Spieler.", "Orçamento insuficiente para este jogador."],
  "MVP rules": ["Les règles du MVP", "Regole dell’MVP", "Reglas del MVP", "MVP-Regeln", "Regras do MVP"],
  "A simple foundation to test selection before adding points, transfers and mini-leagues.": [
    "Une base simple pour tester la sélection avant d’ajouter points, transferts et mini-ligues.",
    "Una base semplice per testare la selezione prima di aggiungere punti, trasferimenti e mini-leghe.",
    "Una base sencilla para probar la selección antes de añadir puntos, fichajes y miniligas.",
    "Eine einfache Grundlage, bevor Punkte, Transfers und Mini-Ligen hinzukommen.",
    "Uma base simples para testar a seleção antes de adicionar pontos, transferências e miniligas.",
  ],
  "Prices are normalized by position from Soccerverse ratings.": [
    "Les prix sont normalisés par poste à partir des notes Soccerverse.",
    "I prezzi sono normalizzati per ruolo in base alle valutazioni Soccerverse.",
    "Los precios se normalizan por posición a partir de las valoraciones de Soccerverse.",
    "Die Preise werden je Position aus den Soccerverse-Bewertungen normalisiert.",
    "Os preços são normalizados por posição a partir das avaliações Soccerverse.",
  ],
  "15 players": ["15 joueurs", "15 giocatori", "15 jugadores", "15 Spieler", "15 jogadores"],
  "Two goalkeepers, five defenders, five midfielders and three forwards.": [
    "Deux gardiens, cinq défenseurs, cinq milieux et trois attaquants.",
    "Due portieri, cinque difensori, cinque centrocampisti e tre attaccanti.",
    "Dos porteros, cinco defensas, cinco centrocampistas y tres delanteros.",
    "Zwei Torhüter, fünf Verteidiger, fünf Mittelfeldspieler und drei Stürmer.",
    "Dois guarda-redes, cinco defesas, cinco médios e três avançados.",
  ],
  "One league to refine selection, pricing and future gameweeks.": [
    "Un seul championnat pour affiner la sélection, les prix et les futures journées.",
    "Un solo campionato per perfezionare selezione, prezzi e giornate future.",
    "Una sola liga para perfeccionar la selección, los precios y las futuras jornadas.",
    "Eine Liga, um Auswahl, Preise und künftige Spieltage zu verfeinern.",
    "Uma só liga para aperfeiçoar a seleção, os preços e as jornadas futuras.",
  ],
  "Maximum three": ["Maximum trois", "Massimo tre", "Máximo tres", "Maximal drei", "Máximo três"],
  "No more than {count} players from the same club.": [
    "Pas plus de {count} joueurs appartenant au même club.",
    "Non più di {count} giocatori dello stesso club.",
    "No más de {count} jugadores del mismo club.",
    "Nicht mehr als {count} Spieler desselben Vereins.",
    "Não mais de {count} jogadores do mesmo clube.",
  ],
  "Built on public Soccerverse data.": ["Construit sur les données publiques Soccerverse.", "Basato sui dati pubblici di Soccerverse.", "Creado con datos públicos de Soccerverse.", "Basierend auf öffentlichen Soccerverse-Daten.", "Criado com dados públicos do Soccerverse."],
  "API documentation": ["Documentation API", "Documentazione API", "Documentación de la API", "API-Dokumentation", "Documentação da API"],
  "Back to top": ["Retour en haut", "Torna in alto", "Volver arriba", "Nach oben", "Voltar ao topo"],
  "Account": ["Compte Fantasy SV", "Account Fantasy SV", "Cuenta Fantasy SV", "Fantasy-SV-Konto", "Conta Fantasy SV"],
  "Welcome back.": ["Bon retour.", "Bentornato.", "Bienvenido de nuevo.", "Willkommen zurück.", "Bem-vindo de volta."],
  "Join the season.": ["Rejoins la saison.", "Unisciti alla stagione.", "Únete a la temporada.", "Mach bei der Saison mit.", "Junta-te à época."],
  "Your team and preferences stay attached to your identity.": [
    "Ton équipe et tes préférences resteront attachées à ton identité.",
    "La tua squadra e le tue preferenze restano legate alla tua identità.",
    "Tu equipo y tus preferencias quedan vinculados a tu identidad.",
    "Dein Team und deine Einstellungen bleiben mit deiner Identität verknüpft.",
    "A tua equipa e preferências ficam associadas à tua identidade.",
  ],
  "Continue with Discord": ["Continuer avec Discord", "Continua con Discord", "Continuar con Discord", "Mit Discord fortfahren", "Continuar com Discord"],
  "Discord coming soon": ["Discord bientôt disponible", "Discord disponibile a breve", "Discord estará disponible pronto", "Discord bald verfügbar", "Discord disponível em breve"],
  "or use email": ["ou par email", "oppure usa l’email", "o usa el correo", "oder per E-Mail", "ou usa o e-mail"],
  "Display name": ["Nom affiché", "Nome visualizzato", "Nombre visible", "Anzeigename", "Nome apresentado"],
  "Email": ["Email", "Email", "Correo", "E-Mail", "E-mail"],
  "Password": ["Mot de passe", "Password", "Contraseña", "Passwort", "Palavra-passe"],
  "Please wait…": ["Patiente…", "Attendi…", "Espera…", "Bitte warten…", "Aguarda…"],
  "Create my account": ["Créer mon compte", "Crea il mio account", "Crear mi cuenta", "Konto erstellen", "Criar a minha conta"],
  "New to Fantasy SV? Create an account": ["Nouveau sur Fantasy SV ? Créer un compte", "Nuovo su Fantasy SV? Crea un account", "¿Nuevo en Fantasy SV? Crea una cuenta", "Neu bei Fantasy SV? Konto erstellen", "Novo no Fantasy SV? Criar uma conta"],
  "Already registered? Sign in": ["Déjà inscrit ? Se connecter", "Hai già un account? Accedi", "¿Ya tienes cuenta? Inicia sesión", "Bereits registriert? Anmelden", "Já tens conta? Entrar"],
  "Close": ["Fermer", "Chiudi", "Cerrar", "Schließen", "Fechar"],
  "Settings": ["Paramètres", "Impostazioni", "Ajustes", "Einstellungen", "Definições"],
  "Names and logos": ["Noms et logos", "Nomi e loghi", "Nombres y logos", "Namen und Logos", "Nomes e logótipos"],
  "Soccerverse standard": ["Soccerverse standard", "Soccerverse standard", "Soccerverse estándar", "Soccerverse Standard", "Soccerverse padrão"],
  "Official names and simplified badges.": ["Noms officiels et écussons simplifiés.", "Nomi ufficiali e stemmi semplificati.", "Nombres oficiales y escudos simplificados.", "Offizielle Namen und vereinfachte Wappen.", "Nomes oficiais e emblemas simplificados."],
  "Community pack": ["Pack communautaire", "Pacchetto community", "Pack comunitario", "Community-Paket", "Pack comunitário"],
  "Common names and El Rincón logos.": ["Noms usuels et logos El Rincón.", "Nomi comuni e loghi El Rincón.", "Nombres habituales y logos de El Rincón.", "Gebräuchliche Namen und El-Rincón-Logos.", "Nomes comuns e logótipos El Rincón."],
  "Sign out": ["Se déconnecter", "Esci", "Cerrar sesión", "Abmelden", "Sair"],
  "Preferences unavailable.": ["Préférences indisponibles.", "Preferenze non disponibili.", "Preferencias no disponibles.", "Einstellungen nicht verfügbar.", "Preferências indisponíveis."],
  "Sign-in failed.": ["La connexion a échoué.", "Accesso non riuscito.", "Error al iniciar sesión.", "Anmeldung fehlgeschlagen.", "Falha ao iniciar sessão."],
  "Discord sign-in is not configured yet.": ["La connexion Discord n’est pas encore configurée.", "L’accesso Discord non è ancora configurato.", "El inicio de sesión con Discord aún no está configurado.", "Die Discord-Anmeldung ist noch nicht konfiguriert.", "O início de sessão com Discord ainda não está configurado."],
  "Discord credentials must be added to the Worker.": ["Les identifiants Discord doivent être ajoutés au Worker.", "Le credenziali Discord devono essere aggiunte al Worker.", "Las credenciales de Discord deben añadirse al Worker.", "Die Discord-Zugangsdaten müssen zum Worker hinzugefügt werden.", "As credenciais Discord devem ser adicionadas ao Worker."],
  "The preference could not be saved.": ["La préférence n’a pas été enregistrée.", "Impossibile salvare la preferenza.", "No se pudo guardar la preferencia.", "Die Einstellung konnte nicht gespeichert werden.", "Não foi possível guardar a preferência."],
  "Community names and logos are active.": ["Les noms et logos du pack communautaire sont actifs.", "I nomi e i loghi della community sono attivi.", "Los nombres y logos comunitarios están activos.", "Community-Namen und -Logos sind aktiv.", "Os nomes e logótipos comunitários estão ativos."],
  "Soccerverse names and simplified badges are active.": ["Les noms Soccerverse et les écussons simplifiés sont actifs.", "I nomi Soccerverse e gli stemmi semplificati sono attivi.", "Los nombres de Soccerverse y los escudos simplificados están activos.", "Soccerverse-Namen und vereinfachte Wappen sind aktiv.", "Os nomes Soccerverse e os emblemas simplificados estão ativos."],
  "Goalkeepers": ["Gardiens", "Portieri", "Porteros", "Torhüter", "Guarda-redes"],
  "Defenders": ["Défenseurs", "Difensori", "Defensas", "Verteidiger", "Defesas"],
  "Midfielders": ["Milieux", "Centrocampisti", "Centrocampistas", "Mittelfeldspieler", "Médios"],
  "Forwards": ["Attaquants", "Attaccanti", "Delanteros", "Stürmer", "Avançados"],
  "GK": ["GAR", "POR", "POR", "TW", "GR"],
  "DEF": ["DEF", "DIF", "DEF", "ABW", "DEF"],
  "MID": ["MIL", "CEN", "MED", "MIT", "MED"],
  "FWD": ["ATT", "ATT", "DEL", "ST", "ATA"],
};

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, variables?: Variables) => string;
  locale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "fantasy-sv-language";
const locales: Record<Language, string> = {
  fr: "fr-FR",
  en: "en-GB",
  it: "it-IT",
  es: "es-ES",
  de: "de-DE",
  pt: "pt-PT",
};

function supportedLanguage(value: string | null | undefined): Language | null {
  const code = value?.toLowerCase().split("-")[0];
  return languages.some((language) => language.code === code) ? code as Language : null;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = supportedLanguage(window.localStorage.getItem(STORAGE_KEY));
    const detected = supportedLanguage(window.navigator.language);
    queueMicrotask(() => setLanguageState(saved || detected || "en"));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The language still changes for this session when storage is unavailable.
    }
  }, []);

  const t = useCallback((key: string, variables: Variables = {}) => {
    const template = language === "en"
      ? key
      : translations[key]?.[translationIndex[language]] || key;
    return Object.entries(variables).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      template,
    );
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, locale: locales[language] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside LanguageProvider");
  return value;
}
