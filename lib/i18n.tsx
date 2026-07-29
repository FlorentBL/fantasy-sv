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
  "Leagues": ["Ligues", "Leghe", "Ligas", "Ligen", "Ligas"],
  "Sign in": ["Connexion", "Accedi", "Iniciar sesión", "Anmelden", "Entrar"],
  "Fantasy SV home": ["Accueil Fantasy SV", "Home Fantasy SV", "Inicio de Fantasy SV", "Fantasy-SV-Startseite", "Início do Fantasy SV"],
  "Fantasy football on Soccerverse": [
    "Fantasy football sur Soccerverse",
    "Fantasy football su Soccerverse",
    "Fantasy football en Soccerverse",
    "Fantasy Football auf Soccerverse",
    "Fantasy football no Soccerverse",
  ],
  "Your squad.": ["Ton équipe.", "La tua squadra.", "Tu equipo.", "Dein Team.", "A tua equipa."],
  "Your season.": ["Ta saison.", "La tua stagione.", "Tu temporada.", "Deine Saison.", "A tua época."],
  "Build my squad": [
    "Composer mon équipe",
    "Crea la mia squadra",
    "Crear mi equipo",
    "Mein Team aufstellen",
    "Criar a minha equipa",
  ],
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
  "Live season": ["Saison en direct", "Stagione live", "Temporada en directo", "Live-Saison", "Época em direto"],
  "Gameweek command centre": ["Centre de contrôle de la journée", "Centro di controllo giornata", "Centro de control de la jornada", "Spieltagszentrale", "Centro de controlo da jornada"],
  "Set your eleven, choose your captain and follow every Soccerverse result.": [
    "Compose ton onze, choisis ton capitaine et suis chaque résultat Soccerverse.",
    "Schiera l'undici, scegli il capitano e segui ogni risultato Soccerverse.",
    "Configura tu once, elige capitán y sigue cada resultado de Soccerverse.",
    "Stelle deine Elf auf, wähle den Kapitän und verfolge jedes Soccerverse-Ergebnis.",
    "Define o onze, escolhe o capitão e acompanha cada resultado do Soccerverse.",
  ],
  "Gameweek {gameweek} deadline": ["Date limite J{gameweek}", "Scadenza G{gameweek}", "Cierre J{gameweek}", "Deadline ST {gameweek}", "Prazo J{gameweek}"],
  "Loading…": ["Chargement…", "Caricamento…", "Cargando…", "Lädt…", "A carregar…"],
  "Total points": ["Points totaux", "Punti totali", "Puntos totales", "Gesamtpunkte", "Pontos totais"],
  "Overall rank": ["Classement général", "Classifica generale", "Clasificación general", "Gesamtrang", "Classificação geral"],
  "Free transfers": ["Transferts gratuits", "Trasferimenti gratuiti", "Fichajes gratuitos", "Freie Transfers", "Transferências gratuitas"],
  "In the bank": ["En banque", "In cassa", "En el banco", "Auf der Bank", "No banco"],
  "My gameweek": ["Ma journée", "La mia giornata", "Mi jornada", "Mein Spieltag", "A minha jornada"],
  "Starting XI": ["Onze titulaire", "Undici titolare", "Once titular", "Startelf", "Onze inicial"],
  "Tap two players to swap": ["Touche deux joueurs pour les permuter", "Tocca due giocatori per scambiarli", "Pulsa dos jugadores para cambiarlos", "Tippe zwei Spieler zum Tauschen", "Toca em dois jogadores para trocar"],
  "Bench": ["Banc", "Panchina", "Banquillo", "Bank", "Banco"],
  "Build your 15-player squad below": ["Construis ton effectif de 15 joueurs ci-dessous", "Crea la rosa di 15 giocatori qui sotto", "Crea tu plantilla de 15 jugadores abajo", "Stelle unten deinen 15er-Kader zusammen", "Constrói abaixo o plantel de 15 jogadores"],
  "Your starting eleven will appear here.": ["Ton onze apparaîtra ici.", "Il tuo undici apparirà qui.", "Tu once aparecerá aquí.", "Deine Startelf erscheint hier.", "O teu onze aparecerá aqui."],
  "Save gameweek team": ["Enregistrer la composition", "Salva la formazione", "Guardar alineación", "Aufstellung speichern", "Guardar equipa da jornada"],
  "Enter the season": ["Inscrire mon équipe", "Iscrivi la squadra", "Inscribir mi equipo", "Team anmelden", "Inscrever a equipa"],
  "Fixtures": ["Rencontres", "Partite", "Partidos", "Spiele", "Jogos"],
  "Gameweek {gameweek}": ["Journée {gameweek}", "Giornata {gameweek}", "Jornada {gameweek}", "Spieltag {gameweek}", "Jornada {gameweek}"],
  "Fixtures are loading.": ["Chargement des rencontres.", "Caricamento partite.", "Cargando partidos.", "Spiele werden geladen.", "Jogos a carregar."],
  "Boosts": ["Bonus", "Bonus", "Potenciadores", "Boosts", "Bónus"],
  "Your chips": ["Tes bonus", "I tuoi bonus", "Tus comodines", "Deine Chips", "Os teus bónus"],
  "Wildcard": ["Wildcard", "Wildcard", "Comodín", "Wildcard", "Wildcard"],
  "Free Hit": ["Coup gratuit", "Free Hit", "Fichaje libre", "Free Hit", "Free Hit"],
  "Bench Boost": ["Banc boosté", "Panchina boost", "Impulso de banquillo", "Bank-Boost", "Banco reforçado"],
  "Triple Captain": ["Triple capitaine", "Triplo capitano", "Capitán triple", "Dreifach-Kapitän", "Capitão triplo"],
  "Used": ["Utilisé", "Usato", "Usado", "Verwendet", "Usado"],
  "Available": ["Disponible", "Disponibile", "Disponible", "Verfügbar", "Disponível"],
  "Active": ["Actif", "Attivo", "Activo", "Aktiv", "Ativo"],
  "Make a transfer": ["Effectuer un transfert", "Effettua un trasferimento", "Hacer un fichaje", "Transfer durchführen", "Fazer uma transferência"],
  "Sell": ["Vendre", "Vendi", "Vender", "Verkaufen", "Vender"],
  "Buy": ["Acheter", "Acquista", "Comprar", "Kaufen", "Comprar"],
  "Choose from your squad": ["Choisir dans ton effectif", "Scegli dalla rosa", "Elegir de tu plantilla", "Aus deinem Kader wählen", "Escolher do plantel"],
  "Choose a replacement": ["Choisir son remplaçant", "Scegli il sostituto", "Elegir sustituto", "Ersatz wählen", "Escolher substituto"],
  "Confirm transfer": ["Confirmer le transfert", "Conferma trasferimento", "Confirmar fichaje", "Transfer bestätigen", "Confirmar transferência"],
  "Community": ["Communauté", "Community", "Comunidad", "Community", "Comunidade"],
  "Private leagues": ["Mini-ligues privées", "Mini-leghe private", "Miniligas privadas", "Private Ligen", "Miniligas privadas"],
  "Create a league and invite your friends with a code.": ["Crée une ligue et invite tes amis avec un code.", "Crea una lega e invita gli amici con un codice.", "Crea una liga e invita a tus amigos con un código.", "Erstelle eine Liga und lade Freunde per Code ein.", "Cria uma liga e convida amigos com um código."],
  "League name": ["Nom de la ligue", "Nome della lega", "Nombre de la liga", "Liganame", "Nome da liga"],
  "Create": ["Créer", "Crea", "Crear", "Erstellen", "Criar"],
  "Invite code": ["Code d'invitation", "Codice invito", "Código de invitación", "Einladungscode", "Código de convite"],
  "Join": ["Rejoindre", "Entra", "Unirse", "Beitreten", "Entrar"],
  "Season": ["Saison", "Stagione", "Temporada", "Saison", "Época"],
  "Points history": ["Historique des points", "Storico punti", "Historial de puntos", "Punkteverlauf", "Histórico de pontos"],
  "Your first score will appear after the next completed gameweek.": ["Ton premier score apparaîtra après la prochaine journée terminée.", "Il primo punteggio apparirà dopo la prossima giornata.", "Tu primera puntuación aparecerá tras la próxima jornada.", "Deine ersten Punkte erscheinen nach dem nächsten Spieltag.", "A primeira pontuação aparecerá após a próxima jornada."],
  "Sign in to save your team for the gameweek.": ["Connecte-toi pour enregistrer ton équipe.", "Accedi per salvare la squadra.", "Inicia sesión para guardar tu equipo.", "Melde dich an, um dein Team zu speichern.", "Inicia sessão para guardar a equipa."],
  "Team locked in for gameweek {gameweek}.": ["Équipe enregistrée pour la journée {gameweek}.", "Squadra salvata per la giornata {gameweek}.", "Equipo guardado para la jornada {gameweek}.", "Team für Spieltag {gameweek} gespeichert.", "Equipa guardada para a jornada {gameweek}."],
  "This swap would create an invalid formation.": ["Cette permutation créerait une formation invalide.", "Lo scambio creerebbe una formazione non valida.", "El cambio crearía una formación no válida.", "Dieser Tausch ergäbe eine ungültige Formation.", "Esta troca criaria uma formação inválida."],
  "Free transfer completed.": ["Transfert gratuit effectué.", "Trasferimento gratuito completato.", "Fichaje gratuito completado.", "Freier Transfer abgeschlossen.", "Transferência gratuita concluída."],
  "Transfer completed with a -4 point cost.": ["Transfert effectué avec une pénalité de 4 points.", "Trasferimento completato con -4 punti.", "Fichaje completado con -4 puntos.", "Transfer mit 4 Punkten Abzug abgeschlossen.", "Transferência concluída com penalização de 4 pontos."],
  "Private league created.": ["Mini-ligue créée.", "Mini-lega creata.", "Miniliga creada.", "Private Liga erstellt.", "Miniliga criada."],
  "Private league joined.": ["Mini-ligue rejointe.", "Mini-lega raggiunta.", "Te has unido a la miniliga.", "Privater Liga beigetreten.", "Miniliga aderida."],
  "Team unavailable.": ["Équipe indisponible.", "Squadra non disponibile.", "Equipo no disponible.", "Team nicht verfügbar.", "Equipa indisponível."],
  "Season data is temporarily unavailable.": ["Les données de saison sont temporairement indisponibles.", "I dati stagionali non sono disponibili.", "Los datos de temporada no están disponibles.", "Saisondaten sind vorübergehend nicht verfügbar.", "Os dados da época estão indisponíveis."],
  "The team could not be saved.": ["L'équipe n'a pas pu être enregistrée.", "Impossibile salvare la squadra.", "No se pudo guardar el equipo.", "Das Team konnte nicht gespeichert werden.", "Não foi possível guardar a equipa."],
  "Transfer failed.": ["Le transfert a échoué.", "Trasferimento fallito.", "El fichaje falló.", "Transfer fehlgeschlagen.", "A transferência falhou."],
  "The chip could not be activated.": ["Le bonus n'a pas pu être activé.", "Impossibile attivare il bonus.", "No se pudo activar el comodín.", "Der Chip konnte nicht aktiviert werden.", "Não foi possível ativar o bónus."],
  "{chip} activated for gameweek {gameweek}.": ["{chip} activé pour la journée {gameweek}.", "{chip} attivato per la giornata {gameweek}.", "{chip} activado para la jornada {gameweek}.", "{chip} für Spieltag {gameweek} aktiviert.", "{chip} ativado para a jornada {gameweek}."],
  "League operation failed.": ["L'opération sur la ligue a échoué.", "Operazione lega fallita.", "La operación de liga falló.", "Liga-Aktion fehlgeschlagen.", "A operação da liga falhou."],
  "League table unavailable.": ["Classement de ligue indisponible.", "Classifica della lega non disponibile.", "Clasificación de liga no disponible.", "Ligatabelle nicht verfügbar.", "Classificação da liga indisponível."],
  "Use the transfer panel to change a registered squad.": ["Utilise le panneau des transferts pour modifier un effectif inscrit.", "Usa il pannello trasferimenti per modificare una rosa iscritta.", "Usa el panel de fichajes para cambiar una plantilla inscrita.", "Nutze den Transferbereich, um einen registrierten Kader zu ändern.", "Usa o painel de transferências para alterar um plantel inscrito."],
  "Fantasy SV rules": ["Règles Fantasy SV", "Regole Fantasy SV", "Reglas de Fantasy SV", "Fantasy-SV-Regeln", "Regras do Fantasy SV"],
  "Build a squad, score from Soccerverse matches and compete across all 38 gameweeks.": ["Compose un effectif, marque des points sur les matchs Soccerverse et joue les 38 journées.", "Crea una rosa, segna punti dalle partite Soccerverse e gioca tutte le 38 giornate.", "Crea una plantilla, suma puntos con los partidos de Soccerverse y compite las 38 jornadas.", "Stelle einen Kader zusammen, sammle Punkte aus Soccerverse-Spielen und bestreite alle 38 Spieltage.", "Constrói um plantel, pontua nos jogos do Soccerverse e compete nas 38 jornadas."],
  "Live scoring": ["Points en direct", "Punteggio live", "Puntuación en directo", "Live-Punkte", "Pontuação em direto"],
  "Minutes, goals, assists, clean sheets, saves, cards, defensive actions and bonus points.": ["Minutes, buts, passes, clean sheets, arrêts, cartons, actions défensives et bonus.", "Minuti, gol, assist, porte inviolate, parate, cartellini, azioni difensive e bonus.", "Minutos, goles, asistencias, porterías a cero, paradas, tarjetas, acciones defensivas y bonus.", "Minuten, Tore, Vorlagen, weiße Westen, Paraden, Karten, Defensivaktionen und Bonuspunkte.", "Minutos, golos, assistências, balizas invioladas, defesas, cartões, ações defensivas e bónus."],
  "Captain x2": ["Capitaine x2", "Capitano x2", "Capitán x2", "Kapitän x2", "Capitão x2"],
  "Your captain doubles his score. The vice-captain takes over if needed.": ["Ton capitaine double son score. Le vice-capitaine prend le relais si nécessaire.", "Il capitano raddoppia il punteggio; il vice subentra se necessario.", "Tu capitán duplica puntos; el vice le sustituye si hace falta.", "Dein Kapitän punktet doppelt; bei Bedarf übernimmt der Vize.", "O capitão duplica a pontuação; o vice assume se necessário."],
  "Transfers": ["Transferts", "Trasferimenti", "Fichajes", "Transfers", "Transferências"],
  "Bank up to five free transfers. Each extra transfer costs four points.": ["Cumule jusqu'à cinq transferts gratuits. Chaque transfert supplémentaire coûte quatre points.", "Accumula fino a cinque trasferimenti gratuiti; ogni extra costa quattro punti.", "Acumula hasta cinco fichajes gratuitos; cada extra cuesta cuatro puntos.", "Spare bis zu fünf freie Transfers; jeder weitere kostet vier Punkte.", "Acumula até cinco transferências gratuitas; cada extra custa quatro pontos."],
  "Four chips": ["Quatre bonus", "Quattro bonus", "Cuatro comodines", "Vier Chips", "Quatro bónus"],
  "Wildcard, Free Hit, Bench Boost and Triple Captain are available in each half of the season.": ["Wildcard, Free Hit, Banc boosté et Triple capitaine sont disponibles à chaque moitié de saison.", "Wildcard, Free Hit, Panchina boost e Triplo capitano sono disponibili in ogni metà stagione.", "Comodín, Fichaje libre, Impulso de banquillo y Capitán triple están disponibles cada media temporada.", "Wildcard, Free Hit, Bank-Boost und Dreifach-Kapitän gibt es in jeder Saisonhälfte.", "Wildcard, Free Hit, Banco reforçado e Capitão triplo estão disponíveis em cada metade da época."],
  "Rankings": ["Classements", "Classifiche", "Clasificaciones", "Ranglisten", "Classificações"],
  "Help": ["Aide", "Aiuto", "Ayuda", "Hilfe", "Ajuda"],
  "Home": ["Accueil", "Home", "Inicio", "Start", "Início"],
  "Help and feedback": ["Aide et retours", "Aiuto e feedback", "Ayuda y comentarios", "Hilfe und Feedback", "Ajuda e feedback"],
  "Alerts and support": ["Alertes et assistance", "Avvisi e supporto", "Alertas y soporte", "Benachrichtigungen und Hilfe", "Alertas e apoio"],
  "Administration": ["Administration", "Amministrazione", "Administración", "Administration", "Administração"],
  "Overall ranking": ["Classement général", "Classifica generale", "Clasificación general", "Gesamtrangliste", "Classificação geral"],
  "The ranking will appear after teams join the season.": ["Le classement apparaîtra lorsque des équipes auront rejoint la saison.", "La classifica apparirà quando le squadre entreranno nella stagione.", "La clasificación aparecerá cuando los equipos entren en la temporada.", "Die Rangliste erscheint, sobald Teams teilnehmen.", "A classificação aparecerá quando as equipas entrarem na época."],
  "Transparency": ["Transparence", "Trasparenza", "Transparencia", "Transparenz", "Transparência"],
  "Player points detail": ["Détail des points joueurs", "Dettaglio punti giocatori", "Detalle de puntos", "Spielerpunkte im Detail", "Detalhe dos pontos"],
  "Manual correction": ["Correction manuelle", "Correzione manuale", "Corrección manual", "Manuelle Korrektur", "Correção manual"],
  "No settled player points for this gameweek yet.": ["Aucun point joueur définitif pour cette journée.", "Nessun punto definitivo per questa giornata.", "Aún no hay puntos definitivos para esta jornada.", "Noch keine endgültigen Spielerpunkte für diesen Spieltag.", "Ainda não há pontos definitivos nesta jornada."],
  "appearance": ["Présence", "Presenza", "Participación", "Einsatz", "Presença"],
  "goals": ["Buts", "Gol", "Goles", "Tore", "Golos"],
  "assists": ["Passes décisives", "Assist", "Asistencias", "Vorlagen", "Assistências"],
  "cleanSheet": ["Clean sheet", "Porta inviolata", "Portería a cero", "Weiße Weste", "Baliza inviolada"],
  "saves": ["Arrêts", "Parate", "Paradas", "Paraden", "Defesas"],
  "cards": ["Cartons", "Cartellini", "Tarjetas", "Karten", "Cartões"],
  "goalsConceded": ["Buts encaissés", "Gol subiti", "Goles encajados", "Gegentore", "Golos sofridos"],
  "defensiveContribution": ["Contribution défensive", "Contributo difensivo", "Contribución defensiva", "Defensivbeitrag", "Contribuição defensiva"],
  "bonus": ["Bonus", "Bonus", "Bonus", "Bonus", "Bónus"],
  "Private beta": ["Bêta privée", "Beta privata", "Beta privada", "Private Beta", "Beta privada"],
  "Rules, alerts and support.": ["Règles, alertes et assistance.", "Regole, avvisi e supporto.", "Reglas, alertas y soporte.", "Regeln, Benachrichtigungen und Hilfe.", "Regras, alertas e apoio."],
  "Everything testers need to understand the game and help us improve it before the public launch.": ["Tout ce qu’il faut aux testeurs pour comprendre le jeu et nous aider avant l’ouverture publique.", "Tutto ciò che serve ai tester per capire il gioco e aiutarci prima del lancio.", "Todo lo necesario para entender el juego y ayudarnos antes del lanzamiento.", "Alles, was Tester zum Verstehen und Verbessern vor dem Start brauchen.", "Tudo o que os testadores precisam para compreender e melhorar o jogo antes do lançamento."],
  "Help centre": ["Centre d’aide", "Centro assistenza", "Centro de ayuda", "Hilfezentrum", "Centro de ajuda"],
  "Rules log": ["Journal des règles", "Registro regole", "Registro de reglas", "Regelprotokoll", "Registo de regras"],
  "Current beta rules": ["Règles actuelles", "Regole beta attuali", "Reglas beta actuales", "Aktuelle Beta-Regeln", "Regras atuais da beta"],
  "Deadline alerts": ["Alertes de deadline", "Avvisi scadenza", "Alertas de cierre", "Deadline-Erinnerungen", "Alertas de prazo"],
  "Choose your reminders": ["Choisis tes rappels", "Scegli i promemoria", "Elige tus recordatorios", "Wähle deine Erinnerungen", "Escolhe os lembretes"],
  "Email reminder": ["Rappel email", "Promemoria email", "Recordatorio por email", "E-Mail-Erinnerung", "Lembrete por e-mail"],
  "Discord reminder": ["Rappel Discord", "Promemoria Discord", "Recordatorio por Discord", "Discord-Erinnerung", "Lembrete Discord"],
  "Discord account connected": ["Compte Discord connecté", "Account Discord collegato", "Cuenta Discord conectada", "Discord-Konto verbunden", "Conta Discord ligada"],
  "Connect with Discord first": ["Connecte d’abord Discord", "Collega prima Discord", "Conecta Discord primero", "Verbinde zuerst Discord", "Liga primeiro o Discord"],
  "Send before deadline": ["Envoyer avant la deadline", "Invia prima della scadenza", "Enviar antes del cierre", "Vor der Deadline senden", "Enviar antes do prazo"],
  "Save alerts": ["Enregistrer les alertes", "Salva avvisi", "Guardar alertas", "Erinnerungen speichern", "Guardar alertas"],
  "Sign in to configure email and Discord deadline reminders.": ["Connecte-toi pour configurer les rappels email et Discord.", "Accedi per configurare i promemoria.", "Inicia sesión para configurar recordatorios.", "Melde dich an, um Erinnerungen einzurichten.", "Inicia sessão para configurar os lembretes."],
  "Tester feedback": ["Retours des testeurs", "Feedback tester", "Comentarios de testers", "Tester-Feedback", "Feedback dos testadores"],
  "Tell us what happened": ["Dis-nous ce qui s’est passé", "Raccontaci cosa è successo", "Cuéntanos qué ocurrió", "Sag uns, was passiert ist", "Conta-nos o que aconteceu"],
  "Category": ["Catégorie", "Categoria", "Categoría", "Kategorie", "Categoria"],
  "General feedback": ["Retour général", "Feedback generale", "Comentario general", "Allgemeines Feedback", "Feedback geral"],
  "Bug": ["Bug", "Bug", "Error", "Fehler", "Erro"],
  "Idea": ["Idée", "Idea", "Idea", "Idee", "Ideia"],
  "Scoring question": ["Question sur les points", "Domanda sui punti", "Pregunta de puntuación", "Frage zur Wertung", "Questão de pontuação"],
  "Message": ["Message", "Messaggio", "Mensaje", "Nachricht", "Mensagem"],
  "Describe what you expected and what happened.": ["Décris ce que tu attendais et ce qui s’est passé.", "Descrivi cosa ti aspettavi e cosa è successo.", "Describe qué esperabas y qué ocurrió.", "Beschreibe Erwartung und Ergebnis.", "Descreve o que esperavas e o que aconteceu."],
  "Send feedback": ["Envoyer le retour", "Invia feedback", "Enviar comentario", "Feedback senden", "Enviar feedback"],
  "Notification settings saved.": ["Préférences d’alertes enregistrées.", "Impostazioni salvate.", "Alertas guardadas.", "Benachrichtigungen gespeichert.", "Alertas guardados."],
  "Notification settings could not be saved.": ["Les alertes n’ont pas pu être enregistrées.", "Impossibile salvare gli avvisi.", "No se pudieron guardar las alertas.", "Benachrichtigungen konnten nicht gespeichert werden.", "Não foi possível guardar os alertas."],
  "Your feedback could not be sent.": ["Ton retour n’a pas pu être envoyé.", "Impossibile inviare il feedback.", "No se pudo enviar el comentario.", "Feedback konnte nicht gesendet werden.", "Não foi possível enviar o feedback."],
  "Thank you. Your feedback was sent to the Fantasy SV team.": ["Merci. Ton retour a été transmis à l’équipe Fantasy SV.", "Grazie. Il feedback è stato inviato.", "Gracias. Tu comentario fue enviado.", "Danke. Dein Feedback wurde gesendet.", "Obrigado. O feedback foi enviado."],
  "How are player prices calculated?": ["Comment les prix sont-ils calculés ?", "Come si calcolano i prezzi?", "¿Cómo se calculan los precios?", "Wie werden Preise berechnet?", "Como são calculados os preços?"],
  "Prices are normalized by position from Soccerverse ratings and stay fixed during the season.": ["Les prix sont normalisés par poste selon les notes Soccerverse et restent fixes pendant la saison.", "I prezzi dipendono dal ruolo e restano fissi.", "Los precios dependen de la posición y permanecen fijos.", "Preise werden nach Position normiert und bleiben fest.", "Os preços são normalizados por posição e ficam fixos."],
  "Soccerverse ratings and role-specific attributes rank players by position. FPL-calibrated price bands then keep premium players rare and squad building balanced.": ["Les notes Soccerverse et les attributs propres au rôle classent les joueurs par poste. Des paliers calibrés sur FPL rendent ensuite les premiums rares et équilibrent la construction d’équipe.", "Le valutazioni Soccerverse e gli attributi del ruolo classificano i giocatori per posizione. Fasce calibrate su FPL mantengono rari i premium e bilanciano la rosa.", "Las valoraciones de Soccerverse y los atributos del rol clasifican a los jugadores por posición. Los tramos calibrados con FPL mantienen escasos a los premium y equilibran la plantilla.", "Soccerverse-Werte und rollenspezifische Attribute ordnen Spieler nach Position. An FPL kalibrierte Preisstufen halten Premiumspieler selten und den Kader ausgeglichen.", "As notas Soccerverse e os atributos da função ordenam os jogadores por posição. Escalões calibrados pelo FPL mantêm os premium raros e equilibram o plantel."],
  "When is my team locked?": ["Quand mon équipe est-elle verrouillée ?", "Quando si blocca la squadra?", "¿Cuándo se bloquea mi equipo?", "Wann wird mein Team gesperrt?", "Quando fica a equipa bloqueada?"],
  "Your squad, starting eleven, captain and chips lock at the Soccerverse gameweek deadline.": ["Effectif, onze, capitaine et bonus sont verrouillés à la deadline Soccerverse.", "Rosa, undici, capitano e bonus si bloccano alla scadenza.", "Plantilla, once, capitán y comodines se bloquean al cierre.", "Kader, Elf, Kapitän und Chips sperren zur Deadline.", "Plantel, onze, capitão e bónus bloqueiam no prazo."],
  "How do automatic substitutions work?": ["Comment fonctionnent les remplacements automatiques ?", "Come funzionano le sostituzioni automatiche?", "¿Cómo funcionan los cambios automáticos?", "Wie funktionieren automatische Wechsel?", "Como funcionam as substituições automáticas?"],
  "A non-playing starter is replaced by the first eligible bench player while keeping a valid formation.": ["Un titulaire absent est remplacé par le premier joueur éligible du banc en conservant une formation valide.", "Un titolare assente viene sostituito dal primo panchinaro idoneo.", "Un titular ausente es sustituido por el primer suplente válido.", "Ein fehlender Starter wird durch den ersten zulässigen Bankspieler ersetzt.", "Um titular ausente é substituído pelo primeiro suplente elegível."],
  "What happens when my captain does not play?": ["Que se passe-t-il si mon capitaine ne joue pas ?", "Cosa accade se il capitano non gioca?", "¿Qué pasa si no juega mi capitán?", "Was passiert, wenn mein Kapitän nicht spielt?", "O que acontece se o capitão não jogar?"],
  "The vice-captain receives the captain multiplier when the captain plays zero minutes.": ["Le vice-capitaine récupère le multiplicateur si le capitaine joue zéro minute.", "Il vice riceve il moltiplicatore se il capitano non gioca.", "El vice recibe el multiplicador si el capitán no juega.", "Der Vize erhält den Multiplikator bei null Minuten.", "O vice recebe o multiplicador se o capitão não jogar."],
  "How are bonus points awarded?": ["Comment sont attribués les bonus ?", "Come si assegnano i bonus?", "¿Cómo se otorgan los bonus?", "Wie werden Bonuspunkte vergeben?", "Como são atribuídos os bónus?"],
  "The three strongest match performances receive three, two and one bonus points.": ["Les trois meilleures performances reçoivent trois, deux et un points bonus.", "Le tre migliori prestazioni ricevono 3, 2 e 1 punti.", "Las tres mejores actuaciones reciben 3, 2 y 1 puntos.", "Die drei besten Leistungen erhalten 3, 2 und 1 Punkt.", "As três melhores exibições recebem 3, 2 e 1 pontos."],
  "Can an administrator change points?": ["Un administrateur peut-il modifier les points ?", "Un amministratore può cambiare i punti?", "¿Puede un administrador cambiar puntos?", "Kann ein Admin Punkte ändern?", "Um administrador pode alterar pontos?"],
  "Only audited corrections with a written reason are allowed, and every correction remains visible in the operations log.": ["Seules les corrections justifiées et auditées sont permises ; chacune reste visible dans le journal.", "Sono ammesse solo correzioni motivate e tracciate.", "Solo se permiten correcciones justificadas y auditadas.", "Nur begründete, protokollierte Korrekturen sind erlaubt.", "Só são permitidas correções justificadas e auditadas."],
  "Full game loop launched: lineups, points, transfers, chips and private leagues.": ["Boucle complète lancée : compositions, points, transferts, bonus et mini-ligues.", "Gioco completo: formazioni, punti, trasferimenti, bonus e leghe.", "Juego completo: alineaciones, puntos, fichajes, comodines y ligas.", "Kompletter Spielkreislauf gestartet.", "Jogo completo lançado: equipas, pontos, transferências, bónus e ligas."],
  "Player prices recalibrated so a strong balanced squad fits the 100-credit budget.": ["Prix recalibrés pour qu’une équipe forte et équilibrée tienne dans 100 crédits.", "Prezzi ricalibrati per una rosa forte entro 100 crediti.", "Precios recalibrados para una plantilla fuerte dentro de 100 créditos.", "Preise für einen starken 100-Credit-Kader neu kalibriert.", "Preços recalibrados para um plantel forte dentro de 100 créditos."],
  "Premier League restricted to Soccerverse division zero.": ["Premier League limitée à la division zéro Soccerverse.", "Premier League limitata alla divisione zero.", "Premier League limitada a la división cero.", "Premier League auf Division null begrenzt.", "Premier League limitada à divisão zero."],
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
