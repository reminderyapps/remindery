"""Erzeugt These, Prinzipien, Gedächtnis-Grafik, Organigramm (Reifegrade!) und Übersetzung auf /method (de + en).

Quelle der Inhalte: C:/privat/hq/ventures/remindery/organisation.md. Reifegrad einer Funktion ändern = ORG-Eintrag
eminderyorganisation.md. Reifegrad einer Funktion ändern = ORG-Eintrag
(6. Feld) in beiden Sprachen anpassen, `python tool/method_prinzipien.py`, Cache-Version ?v= in beiden Seiten erhöhen.
Idempotent über die Marker <!-- prinzipien:start/ende -->. CSS/JS dazu liegen in method/method.css und method.js."""
import re, sys, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parents[1]

# Organigramm-Knoten: k, Reihe, Rolle, Titel, Einzeiler, Stufe, Mandat, [allein], [Entwurf], [nie],
# Takt, [Agents], [Skills], Akte, [läuft], als Nächstes
ORG = {
"en": [
 ("ceo","top","CEO","The human","Priorities, the Go, money, the voice outside.",None,
  "Owns every call that matters – and only those.",
  ["Priorities: the order on the board","The Go: nothing goes live without it","Start or stop a product","Spending money"],
  ["Weekly brief","Review pages for sign-off","Exact go-live steps"],
  ["The Go","Money","Promises to customers"],
  "every day, at three gates",[],[],"the board and the decision log",
  ["Prioritises by drag and drop","Signs off every story, image and voice"],"Fewer, better decisions – as agents earn autonomy."),
 ("cos","staff","Chief of Staff","Operating system","Runs the machine, keeps the human informed.",2,
  "Keeps the operating system running and the human informed. Summarises – never decides.",
  ["Maintains board, control tower and maps","Answers board comments","Queues and starts runs"],
  ["Weekly brief","Monthly learning loop: tighten, loosen, dare","Model choice and token budget"],
  ["Sets priorities","Changes a rule without the human's yes"],
  "continuous · weekly brief · monthly learning loop",["Reply agent","End-of-day agent"],["feierabend","arbeitsbeginn","rechner-einrichten"],
  "the map, the lessons, the board log",
  ["Board with live gate and parallel runs","Control tower: alarms, deadlines, store status","Answers every board comment within a minute"],
  "The weekly brief and the learning loop on a fixed rhythm."),
 ("red","staff","Red Team","Independent challenge","Critic and advocate. Report to the CEO, not the line.",2,
  "Makes sure nothing important goes unchallenged – in either direction.",
  ["Reviews specs, products and listings","Writes blockers with evidence"],
  ["The bolder move every month (advocate)"],
  ["Stops or approves anything itself","Reports to the function it reviews"],
  "every concept · every release · monthly",["Critic · Opus","Advocate · Opus"],["lens: sceptical parent","lens: sceptical buyer"],
  "findings per run",
  ["First outing: 6 real blockers before a line of code","Critic and advocate see the same facts"],
  "Measure the hit rate: how often a blocker was real."),
 ("cpo","line","CPO","Product","What gets built and why.",2,
  "Build the right thing.",
  ["Research from store data and reviews","Concept drafts in parallel strands","Content production","Sorts customer feedback"],
  ["Specs","Pursue or kill an idea","Design studies"],
  ["Decides scope","Ships content without human sign-off"],
  "daily feedback triage · per idea · per release",["Concept · Opus","Editor","Feedback triage"],["bilder-lokal","polly-audio","content-nacharbeit"],
  "the venture file, the spec, the feedback inbox",
  ["Every story passes an editor before image and voice","7,500+ voice clips, every one signed off","Sign-off tools that never lose a verdict"],
  "A monthly review per app: what we assumed vs. what the numbers say."),
 ("cto","line","CTO","Engineering","How it's built and shipped.",3,
  "Build it right and ship it safely.",
  ["Cuts work into packages","Builds, tests and commits","Runs the guards"],
  ["Release bundles with the exact store steps"],
  ["Deploys a server","Uploads to a store","Publishes this website"],
  "every run, often overnight · every release",["Orchestrator · Opus","Builders · Sonnet","QA · Sonnet"],["nachtschicht","aufs-phone","amazon-appstore"],
  "the run's brief with checkboxes, the version log",
  ["121 commits in one night","4,300+ tests; QA caught 2 blockers 368 green tests missed","Guards on production switches, memory pages, server version"],
  "A tech radar: platform deadlines, framework upgrades, crash rates."),
 ("cmo","line","CMO","Growth","How people find us – one brand, one voice.",1,
  "The right people find the apps, and the brand speaks with one voice.",
  ["Listing drafts and screenshots","Website copy within the brand line"],
  ["Positioning","Store experiments","Posts in the founder's voice"],
  ["Speaks for the founder","Spends money on ads"],
  "every release · monthly measurement (next)",["Store"],["store-auftritt","store-texte"],
  "one store core per app, the brand learnings",
  ["One store core feeds Google Play and Amazon","A sceptical-buyer agent scores every headline","Website checked on every release"],
  "Measure keyword ranks and store conversion every month. Paid ads later."),
 ("cfo","line","CFO","Finance","Where every euro comes from and goes.",2,
  "Know where every euro comes from and where it goes.",
  ["Collects receipts","Watches deadlines","Assigns costs to apps"],
  ["Monthly close","Tax preparation"],
  ["Pays anything","Files with authorities"],
  "daily collection · monthly close (next)",[],[],
  "cost ledger, deadlines, key figures",
  ["A missing invoice raises an alarm","Deadlines in the control tower","Revenue per store"],
  "The monthly close: receipts complete, revenue and cost per app, credits, deadlines."),
 ("gc","line","General Counsel","Legal","No legal or policy risk goes unnoticed.",1,
  "No legal or policy risk goes unnoticed.",
  ["Scans primary sources","Assesses what applies to which app","Keeps the risk register"],
  ["Privacy updates","Actions with a deadline, as board cards"],
  ["Decides a legal question","Searches trademark registers by script"],
  "monthly radar (next) · every release with a new SDK, data flow or market",[],[],
  "the risk register, the privacy record",
  ["Privacy policy and imprint for every app","AI Act classification per app"],
  "A monthly regulatory radar: privacy, platform policies, consumer law – new, changed, emerging."),
],
"de": [
 ("ceo","top","CEO","Der Mensch","Prioritäten, das Go, Geld, die Stimme nach außen.",None,
  "Trifft jede Entscheidung, auf die es ankommt – und nur die.",
  ["Prioritäten: die Reihenfolge im Board","Das Go: ohne es geht nichts live","Ein Produkt starten oder einstellen","Geld ausgeben"],
  ["Wochenbriefing","Abnahme-Seiten","Die genauen Go-live-Schritte"],
  ["Das Go","Geld","Zusagen an Kunden"],
  "jeden Tag, an drei Gates",[],[],"das Board und das Entscheidungs-Logbuch",
  ["Priorisiert per Drag & Drop","Nimmt jede Geschichte, jedes Bild, jede Stimme ab"],"Weniger, bessere Entscheidungen – je mehr Autonomie die Agents verdienen."),
 ("cos","staff","Chief of Staff","Betriebssystem","Hält die Maschine am Laufen, den Menschen im Bild.",2,
  "Hält das Betriebssystem am Laufen und den Menschen im Bild. Fasst zusammen – entscheidet nie.",
  ["Pflegt Board, Leitstand und Landkarten","Antwortet auf Board-Kommentare","Reiht Läufe ein und startet sie"],
  ["Wochenbriefing","Monatliche Lern-Schleife: verschärfen, lockern, wagen","Modellwahl und Token-Budget"],
  ["Setzt Prioritäten","Ändert eine Regel ohne das Ja des Menschen"],
  "laufend · wöchentliches Briefing · monatliche Lern-Schleife",["Antwort-Agent","Feierabend-Agent"],["feierabend","arbeitsbeginn","rechner-einrichten"],
  "die Landkarte, die Lehren, das Board-Log",
  ["Board mit Live-Sperre und parallelen Läufen","Leitstand: Alarme, Fristen, Store-Status","Antwortet auf jeden Board-Kommentar in einer Minute"],
  "Wochenbriefing und Lern-Schleife im festen Takt."),
 ("red","staff","Red Team","Unabhängiger Widerspruch","Critic und Advocate. Berichten an den CEO, nicht an die Linie.",2,
  "Sorgt dafür, dass nichts Wichtiges unwidersprochen bleibt – in beide Richtungen.",
  ["Prüft Specs, Produkte und Store-Texte","Schreibt Blocker mit Beleg"],
  ["Den mutigeren Schritt jeden Monat (Advocate)"],
  ["Stoppt oder genehmigt selbst etwas","Berichtet an die Funktion, die es prüft"],
  "jedes Konzept · jedes Release · monatlich",["Critic · Opus","Advocate · Opus"],["Brille: skeptische Eltern","Brille: skeptischer Käufer"],
  "Befunde je Lauf",
  ["Erster Einsatz: 6 echte Blocker vor der ersten Zeile Code","Critic und Advocate sehen dieselben Fakten"],
  "Die Trefferquote messen: Wie oft war ein Blocker echt?"),
 ("cpo","line","CPO","Produkt","Was gebaut wird und warum.",2,
  "Das Richtige bauen.",
  ["Recherche aus Store-Daten und Rezensionen","Konzeptentwürfe in parallelen Strängen","Content-Produktion","Sortiert Kundenfeedback"],
  ["Specs","Idee weiterverfolgen oder einstellen","Design-Studien"],
  ["Entscheidet den Umfang","Liefert Inhalte ohne menschliche Abnahme aus"],
  "täglich Feedback-Triage · je Idee · je Release",["Concept · Opus","Editor","Feedback-Triage"],["bilder-lokal","polly-audio","content-nacharbeit"],
  "die Venture-Akte, die Spec, der Feedback-Eingang",
  ["Jede Geschichte geht durchs Lektorat, bevor Bild und Ton entstehen","7.500+ Sprachclips, jeder einzeln abgenommen","Abnahme-Werkzeuge, die kein Urteil verlieren"],
  "Ein monatlicher Rückblick je App: Was haben wir angenommen, was sagen die Zahlen?"),
 ("cto","line","CTO","Technik","Wie gebaut und ausgeliefert wird.",3,
  "Richtig bauen und sicher ausliefern.",
  ["Schneidet Arbeit in Pakete","Baut, testet, committet","Lässt die Wächter laufen"],
  ["Release-Bundles mit den genauen Store-Schritten"],
  ["Deployt einen Server","Lädt in einen Store hoch","Veröffentlicht diese Website"],
  "jeder Lauf, oft über Nacht · jedes Release",["Orchestrator · Opus","Builders · Sonnet","QA · Sonnet"],["nachtschicht","aufs-phone","amazon-appstore"],
  "der Laufzettel mit Haken, das Versionslog",
  ["121 Commits in einer Nacht","4.300+ Tests; QA fand 2 Blocker, die 368 grüne Tests übersahen","Wächter auf Produktionsschalter, Speicherseiten, Serverstand"],
  "Ein Tech-Radar: Plattform-Fristen, Framework-Upgrades, Absturzraten."),
 ("cmo","line","CMO","Wachstum","Wie Menschen uns finden – eine Marke, eine Stimme.",1,
  "Die richtigen Menschen finden die Apps, und die Marke spricht mit einer Stimme.",
  ["Store-Texte und Screenshots im Entwurf","Website-Texte innerhalb der Markenlinie"],
  ["Positionierung","Store-Experimente","Posts in der Stimme des Gründers"],
  ["Spricht für den Gründer","Gibt Geld für Werbung aus"],
  "jedes Release · monatliche Messung (als Nächstes)",["Store"],["store-auftritt","store-texte"],
  "ein Store-Kern je App, die Marken-Lehren",
  ["Ein Store-Kern speist Google Play und Amazon","Ein skeptischer Käufer-Agent bewertet jede Überschrift","Website-Abgleich bei jedem Release"],
  "Keyword-Ränge und Store-Conversion jeden Monat messen. Bezahlte Werbung später."),
 ("cfo","line","CFO","Finanzen","Woher jeder Euro kommt und wohin er geht.",2,
  "Wissen, woher jeder Euro kommt und wohin er geht.",
  ["Sammelt Belege","Überwacht Fristen","Ordnet Kosten den Apps zu"],
  ["Monatsabschluss","Steuer-Vorbereitung"],
  ["Bezahlt etwas","Reicht bei Behörden ein"],
  "täglich sammeln · monatlicher Abschluss (als Nächstes)",[],[],
  "Kostenbuch, Fristen, Kennzahlen",
  ["Eine fehlende Rechnung löst Alarm aus","Fristen im Leitstand","Umsatz je Store"],
  "Der Monatsabschluss: Belege vollständig, Umsatz und Kosten je App, Guthaben, Fristen."),
 ("gc","line","General Counsel","Recht","Kein rechtliches Risiko bleibt unbemerkt.",1,
  "Kein Rechts- oder Policy-Risiko bleibt unbemerkt.",
  ["Liest Primärquellen","Bewertet, was für welche App gilt","Führt das Risiko-Register"],
  ["Datenschutz-Updates","Maßnahmen mit Frist, als Board-Karten"],
  ["Entscheidet eine Rechtsfrage","Durchsucht Markenregister per Skript"],
  "monatlicher Radar (als Nächstes) · jedes Release mit neuem SDK, Datenfluss oder Markt",[],[],
  "das Risiko-Register, das Verarbeitungsverzeichnis",
  ["Datenschutzerklärung und Impressum für jede App","AI-Act-Einordnung je App"],
  "Ein monatlicher Rechts-Radar: Datenschutz, Plattform-Policies, Verbraucherrecht – neu, geändert, aufkommend."),
]}

T = {
"en": dict(
 title="The Remindery Method – an agentic company, human on the loop",
 desc="How one human runs a company of AI agents: five functions with a mandate, ten agents, three human gates and autonomy earned by evidence – with five apps in the stores as proof.",
 eyebrow="The Remindery Method",
 h1="A company run by agents.<br><em>Steered by one human.</em>",
 lead="Product, engineering, marketing, finance, legal: every function has a mandate, a rhythm and a memory – and AI agents do the work. One human owns every call that matters. Five apps in the stores are the proof. The operating model behind them is the point.",
 b1="Read the principles ↓", b2="Watch a real night",
 th_eb="The thesis",
 th_h2="Most companies add AI to their org chart.<br>We drew the org chart for AI.",
 th_lead="When work costs almost nothing to do, hands are no longer the scarce resource. Judgment, memory and trust are. So we organised around those three – and gave everything else to agents.",
 shifts=[("Headcount","Functions","A department is no longer a group of people. It's a mandate, a rhythm and a file."),
         ("Doing","Deciding","The human doesn't do the work. The human owns the calls – and only those."),
         ("Trust","Evidence","Autonomy isn't granted. It's earned, measured against human judgment."),
         ("Caution","Courage","A company that only learns from its mistakes ends up afraid of everything. Ours has to put a bolder move on the table every month.")],
 pr_eb="The principles",
 pr_h2="Six principles.<br>Everything else is implementation.",
 prin=[("A function is a file, not a person.","An agent's memory isn't a chat history – it's engineered. Every function keeps a file: mandate, rights, limits, open items, lessons. A run starts by reading it and ends by writing back. So any agent can take the chair – and nothing depends on who sat there yesterday."),
       ("Can is not may.","Skills teach an agent how to do something. Whether it's allowed to is written in the mandate – and enforced by code, not by good intentions. An agent that knows how to upload to a store still can't."),
       ("Humans own the calls.","Three gates stay human: what gets built, what's good enough, what goes live. Everything in between runs on its own – often overnight."),
       ("Autonomy is earned.","A step moves up only when the agent's judgment has matched the human's on the same cases, again and again. Some steps never move: taste isn't what gets automated, it's what the automation is for."),
       ("Challenge comes from outside the line.","A critic and an advocate review every function – and report to the human, not to the function they review. An agent supervising its own kind inherits its blind spots."),
       ("Learn in three directions.","Every month: what to tighten, what to loosen, where to be bolder. All three need the human's yes. Otherwise a company only learns from its scars – and slowly stops daring anything.")],
 mem_h3="How memory works",
 mem_lead="Not one endless chat history, but four layers – each loaded exactly when it's needed. That's context engineering.",
 mem=[("The handbook","Maps, rules and lessons learned","every agent, at the start"),
      ("The function's file","Mandate, open items, register","the agent in the chair, first"),
      ("The brief","Packages and checkboxes for one job – if a run dies, the next one picks up","the run working on it"),
      ("The chronicle","Git history and board log: everything ever done","on demand, never whole")],
 mem_note="Memory you can read, version and audit – and that doesn't depend on who sat in the chair yesterday.",
 viz=dict(ctx="context window", run="run", empty="chair empty", start=1201,
  agents=[["Builder","Sonnet"],["QA","Sonnet"],["Critic","Opus"],["Store","Opus"]],
  wb=["handbook","function file","brief · 3 packages","3 commits · on demand"],
  wrote="run #{n}: 3 packages done",
  files=["mandate","open: store steps","lesson: guard 16 KB"],
  steps=["new run · an agent takes the chair","loads the handbook: maps, rules, lessons","loads the function's file: mandate, open items","loads the brief: 3 packages, 3 checkboxes","pulls 3 commits from the chronicle – on demand only","works: packages checked off","writes back: file updated, 4 commits added","run ends · context gone · memory stays"]),
 org_eb="The organisation",
 org_h2="Five functions. Ten agents.<br>One human on top.",
 org_lead="Every function is measured by the same yardstick: how far it has come from a first attempt to measured autonomy. None has reached the top yet. That's the work – and we show it as it is.",
 org_hint="Click a function to see what's behind it.",
 rows=dict(top="Steers",staff="Staff",line="Functions"),
 lv=["","Started","Tooled","Running","Measured"],
 lv_d=["","done once, by hand","skills and scripts, runs on demand","runs on a rhythm, with guardrails","agreement with human judgment proven"],
 lbl=dict(alone="Decides alone",drafts="Drafts for the human",never="Never",alone_ceo="Owns",drafts_ceo="Receives",never_ceo="Never delegates",
          rhythm="Rhythm",agents="Agents",skills="Skills",file="Its file",running="Running today",next="Next",none="scripts only, no agent yet"),
 org_note="Agents are the staff, not the departments. A department is a file and a chair.",
 ro_eb="The translation",
 ro_h2="Same company.<br>Different physics.",
 ro_lead="Everything a classic company has still exists here. It just lives somewhere else.",
 ro=[("Department","Function","a mandate, a rhythm and a file"),("Employee","Agent","a model with a stance and a context, for one run"),
     ("Seniority","Model choice","Opus where judgment matters, Sonnet where the work is specified"),("Salary","Tokens","the budget every run is paid from"),
     ("Handbook & know-how","Skills","versioned recipes any agent can use"),("Machines","Scripts","no judgment, no surprises"),
     ("Filing cabinet","Repository","every function keeps its file in it"),("Ticket system","The board","every run starts on a card"),
     ("Shift","Run","an agent on one job, then gone"),("Access card","Guardrails","enforced in code, not by trust")],
 proc_h2="How work flows<br>through the company.",
 dive='"dive": ["> company.status()", "5 functions · 10 agents · 3 gates · live"],',
 bio_old="to prove a simple thesis: with the right pipeline, one person can ship what used to take a whole team.",
 bio_new="to prove a simple thesis: with the right operating model, one person can run what used to take a whole team.",
 buzz=[("Agentic organisation","Functions with a mandate, staffed by agents, steered by a human."),("Earned autonomy","Agents move up only when their judgment matches the human's.")],
),
"de": dict(
 title="Die Remindery-Methode – ein agentisches Unternehmen, Human on the Loop",
 desc="Wie ein Mensch ein Unternehmen aus KI-Agents führt: fünf Funktionen mit Mandat, zehn Agents, drei menschliche Gates und Autonomie nur mit Beleg – fünf Apps in den Stores als Beweis.",
 eyebrow="Die Remindery-Methode",
 h1="Ein Unternehmen, betrieben von Agents.<br><em>Gesteuert von einem Menschen.</em>",
 lead="Produkt, Technik, Marketing, Finanzen, Recht: Jede Funktion hat ein Mandat, einen Takt und ein Gedächtnis – die Arbeit machen KI-Agents. Ein Mensch trifft jede Entscheidung, auf die es ankommt. Fünf Apps in den Stores sind der Beweis. Worum es eigentlich geht, ist das Betriebsmodell dahinter.",
 b1="Die Prinzipien lesen ↓", b2="Eine echte Nacht ansehen",
 th_eb="Die These",
 th_h2="Die meisten Unternehmen ergänzen ihr Organigramm um KI.<br>Wir haben das Organigramm für KI gezeichnet.",
 th_lead="Wenn Arbeit fast nichts mehr kostet, sind nicht mehr Hände knapp, sondern Urteil, Gedächtnis und Vertrauen. Also haben wir uns um genau diese drei organisiert – und alles andere den Agents gegeben.",
 shifts=[("Köpfe","Funktionen","Eine Abteilung ist keine Gruppe von Menschen mehr, sondern ein Mandat, ein Takt und eine Akte."),
         ("Machen","Entscheiden","Der Mensch macht nicht die Arbeit. Er trifft die Entscheidungen – und nur die."),
         ("Vertrauen","Beleg","Autonomie wird nicht verliehen, sondern verdient – gemessen am Urteil des Menschen."),
         ("Vorsicht","Mut","Wer nur aus Fehlern lernt, traut sich irgendwann nichts mehr. Bei uns muss jeden Monat ein mutigerer Schritt auf den Tisch.")],
 pr_eb="Die Prinzipien",
 pr_h2="Sechs Prinzipien.<br>Alles andere ist Umsetzung.",
 prin=[("Eine Funktion ist eine Akte, keine Person.","Das Gedächtnis eines Agents ist kein Chatverlauf, es ist gebaut. Jede Funktion führt eine Akte: Mandat, Rechte, Grenzen, offene Punkte, Lehren. Ein Lauf beginnt damit, sie zu lesen, und endet damit, zurückzuschreiben. So kann jeder Agent den Stuhl übernehmen – und nichts hängt davon ab, wer gestern darauf saß."),
       ("Können ist nicht Dürfen.","Skills bringen einem Agent bei, wie etwas geht. Ob er es darf, steht im Mandat – und wird von Code durchgesetzt, nicht von guten Absichten. Ein Agent, der weiß, wie man in den Store hochlädt, kann es trotzdem nicht."),
       ("Menschen treffen die Entscheidungen.","Drei Gates bleiben menschlich: was gebaut wird, was gut genug ist, was live geht. Alles dazwischen läuft allein – oft über Nacht."),
       ("Autonomie wird verdient.","Ein Schritt steigt erst auf, wenn das Urteil des Agents auf denselben Fällen immer wieder mit dem des Menschen übereinstimmt. Manche Schritte steigen nie: Geschmack ist nicht das, was automatisiert wird, sondern wofür."),
       ("Widerspruch kommt von außerhalb der Linie.","Ein Critic und ein Advocate prüfen jede Funktion – und berichten an den Menschen, nicht an die Funktion, die sie prüfen. Ein Agent, der seinesgleichen beaufsichtigt, erbt dessen blinde Flecken."),
       ("Lernen in drei Richtungen.","Jeden Monat: was verschärfen, was lockern, wo mutiger werden. Alle drei brauchen das Ja des Menschen. Sonst lernt ein Unternehmen nur aus seinen Narben – und traut sich langsam gar nichts mehr.")],
 mem_h3="So funktioniert das Gedächtnis",
 mem_lead="Kein endloser Chatverlauf, sondern vier Schichten – jede wird genau dann geladen, wenn sie gebraucht wird. Das ist Context Engineering.",
 mem=[("Das Handbuch","Landkarten, Regeln und Lessons Learned","jeder Agent, beim Start"),
      ("Die Akte der Funktion","Mandat, offene Punkte, Register","der Agent auf dem Stuhl, zuerst"),
      ("Der Laufzettel","Pakete und Haken für einen Auftrag – bricht ein Lauf ab, macht der nächste weiter","der Lauf, der ihn abarbeitet"),
      ("Die Chronik","Git-Historie und Board-Log: alles, was je getan wurde","bei Bedarf, nie ganz")],
 mem_note="Ein Gedächtnis, das man lesen, versionieren und prüfen kann – und das nicht davon abhängt, wer gestern auf dem Stuhl saß.",
 viz=dict(ctx="Kontextfenster", run="Lauf", empty="Stuhl frei", start=1201,
  agents=[["Builder","Sonnet"],["QA","Sonnet"],["Critic","Opus"],["Store","Opus"]],
  wb=["Handbuch","Akte der Funktion","Laufzettel · 3 Pakete","3 Commits · bei Bedarf"],
  wrote="Lauf #{n}: 3 Pakete erledigt",
  files=["Mandat","offen: Store-Schritte","Lehre: Wächter 16 KB"],
  steps=["neuer Lauf · ein Agent setzt sich auf den Stuhl","lädt das Handbuch: Landkarten, Regeln, Lehren","lädt die Akte der Funktion: Mandat, offene Punkte","lädt den Laufzettel: 3 Pakete, 3 Haken","holt 3 Commits aus der Chronik – nur bei Bedarf","arbeitet: Pakete abgehakt","schreibt zurück: Akte ergänzt, 4 Commits dazu","Lauf endet · Kontext weg · Gedächtnis bleibt"]),
 org_eb="Die Organisation",
 org_h2="Fünf Funktionen. Zehn Agents.<br>Ein Mensch an der Spitze.",
 org_lead="Jede Funktion wird am selben Maßstab gemessen: wie weit sie vom ersten Versuch bis zur gemessenen Autonomie gekommen ist. Ganz oben ist noch keine. Das ist die Arbeit – und wir zeigen sie, wie sie ist.",
 org_hint="Klick auf eine Funktion, um zu sehen, was dahintersteckt.",
 rows=dict(top="Steuert",staff="Stab",line="Funktionen"),
 lv=["","Begonnen","Mit Werkzeug","Eingespielt","Gemessen"],
 lv_d=["","einmal gemacht, von Hand","Skills und Skripte, läuft auf Zuruf","läuft im Takt, mit Leitplanken","Übereinstimmung mit dem Menschen belegt"],
 lbl=dict(alone="Entscheidet allein",drafts="Entwirft für den Menschen",never="Nie",alone_ceo="Besitzt",drafts_ceo="Bekommt",never_ceo="Gibt nie ab",
          rhythm="Takt",agents="Agents",skills="Skills",file="Ihre Akte",running="Läuft heute",next="Als Nächstes",none="nur Skripte, noch kein Agent"),
 org_note="Agents sind die Mitarbeiter, nicht die Abteilungen. Eine Abteilung ist eine Akte und ein Stuhl.",
 ro_eb="Die Übersetzung",
 ro_h2="Dasselbe Unternehmen.<br>Andere Physik.",
 ro_lead="Alles, was ein klassisches Unternehmen hat, gibt es hier auch. Es wohnt nur woanders.",
 ro=[("Abteilung","Funktion","Mandat, Takt und Akte"),("Mitarbeiter","Agent","ein Modell mit Haltung und Kontext, für einen Lauf"),
     ("Seniorität","Modellwahl","Opus, wo Urteil zählt, Sonnet, wo die Arbeit beschrieben ist"),("Gehalt","Token","das Budget, aus dem jeder Lauf bezahlt wird"),
     ("Handbuch & Know-how","Skills","versionierte Rezepte, die jeder Agent nutzen kann"),("Maschinen","Skripte","kein Urteil, keine Überraschungen"),
     ("Aktenschrank","Repository","jede Funktion hat darin ihre Akte"),("Ticketsystem","Das Board","jeder Lauf beginnt auf einer Karte"),
     ("Schicht","Lauf","ein Agent, ein Auftrag, dann weg"),("Zugangskarte","Leitplanken","im Code durchgesetzt, nicht im Vertrauen")],
 proc_h2="So fließt die Arbeit<br>durchs Unternehmen.",
 dive='"dive": ["> company.status()", "5 Funktionen · 10 Agents · 3 Gates · live"],',
 bio_old="um eine einfache These zu beweisen: Mit der richtigen Pipeline kann ein Mensch ausliefern, wofür es früher ein ganzes Team brauchte.",
 bio_new="um eine einfache These zu beweisen: Mit dem richtigen Betriebsmodell kann ein Mensch führen, wofür es früher ein ganzes Team brauchte.",
 buzz=[("Agentische Organisation","Funktionen mit Mandat, besetzt mit Agents, gesteuert von einem Menschen."),("Verdiente Autonomie","Agents steigen erst auf, wenn ihr Urteil mit dem des Menschen übereinstimmt.")],
),
}

e = html.escape

def meter(n, t):
    segs = "".join(f'<i class="{"on" if k <= n else ""}"></i>' for k in (1, 2, 3, 4))
    return f'<span class="lvl l{n}" title="{t["lv_d"][n]}"><span class="segs">{segs}</span><span>{t["lv"][n]}</span></span>'

def ul(items):
    return "<ul>" + "".join(f"<li>{e(i)}</li>" for i in items) + "</ul>"

def node(o, t):
    k, row, role, title, one, n, mandate, alone, drafts, never, rhythm, agents, skills, file, running, nxt = o
    L = t["lbl"]; ceo = k == "ceo"
    chips = "".join(f'<span class="chip">{e(a)}</span>' for a in agents)
    sk = "".join(f'<code>{e(s)}</code>' for s in skills)
    facts = f'<div><b>{L["rhythm"]}</b><span>{e(rhythm)}</span></div>'
    if not ceo:
        facts += f'<div><b>{L["agents"]}</b><span class="chips">{chips or "<em>" + L["none"] + "</em>"}</span></div>'
        if skills: facts += f'<div><b>{L["skills"]}</b><span class="chips">{sk}</span></div>'
    facts += f'<div><b>{L["file"]}</b><span>{e(file)}</span></div>'
    sfx = "_ceo" if ceo else ""
    det = (f'<div class="det"><div class="d-head"><span class="role">{e(role)}</span><h3>{e(title)}</h3><p>{e(mandate)}</p></div>'
           f'<div class="rights"><div class="r ok"><b>{L["alone"+sfx]}</b>{ul(alone)}</div>'
           f'<div class="r gate"><b>{L["drafts"+sfx]}</b>{ul(drafts)}</div>'
           f'<div class="r no"><b>{L["never"+sfx]}</b>{ul(never)}</div></div>'
           f'<div class="facts">{facts}</div>'
           f'<div class="state"><div><b>{L["running"]}</b>{ul(running)}</div><div class="nx"><b>{L["next"]}</b><p>{e(nxt)}</p></div></div></div>')
    lvl = meter(n, t) if n else ""
    return (f'<div class="tile {k}" role="button" tabindex="0" aria-expanded="false"{" data-open" if k == "cto" else ""}>'
            f'<div class="t-top"><span class="role">{e(role)}</span>{lvl}</div><h3>{e(title)}</h3><p>{e(one)}</p>'
            f'<span class="more" aria-hidden="true">+</span>{det}</div>')

def org(lang, t):
    out = ""
    for row in ("top", "staff", "line"):
        tiles = "".join(node(o, t) for o in ORG[lang] if o[1] == row)
        out += (f'<div class="org-row r-{row}"><div class="row-l">{t["rows"][row]}</div><div class="tiles">{tiles}</div></div>'
                f'<div class="panel" hidden></div>')
    return out

ICONS = {
 "hb": '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6.5c3.5-1.6 7.2-1.6 11 .4v19c-3.8-2-7.5-2-11-.4z M27 6.5c-3.5-1.6-7.2-1.6-11 .4v19c3.8-2 7.5-2 11-.4z"/><path d="M8 11h5M8 15h5M19 11h5M19 15h5"/></svg>',
 "fi": '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 8.5h9l2.5 3H28v14H4z"/><path d="M9 17h14M9 21h9"/></svg>',
 "br": '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="4" width="20" height="24" rx="2"/><path d="M10 11l2 2 3-4M10 18l2 2 3-4M18 11h5M18 18h5M10 24h13"/></svg>',
 "ch": '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="24" r="2.5"/><circle cx="24" cy="16" r="2.5"/><path d="M8 10.5v11M10.3 9.3c6 1 11 3 12 4.6"/></svg>',
}

def memviz(t):
    v = t["viz"]
    keys = ("hb", "fi", "br", "ch")
    live = {
     "hb": '<div class="lv-hb"><i></i><i></i><i></i></div>',
     "fi": '<div class="lv-fi">' + "".join(f"<div>{e(x)}</div>" for x in v["files"]) + "</div>",
     "br": '<div class="lv-br"><i></i><i></i><i></i></div>',
     "ch": '<div class="lv-ch"></div>',
    }
    shelves = "".join(
        f'<div class="shelf s-{k}" data-s="{k}"><div class="ic">{ICONS[k]}</div>'
        f'<div class="tx"><h4>{a}</h4><p>{b}</p><span>{c}</span></div>{live[k]}</div>'
        for k, (a, b, c) in zip(keys, t["mem"]))
    blocks_ = "".join(f'<div class="wb w-{k}" data-s="{k}"><b>{e(w)}</b><i></i><i></i></div>' for k, w in zip(keys, v["wb"]))
    data = __import__("json").dumps(v, ensure_ascii=False).replace("</", "<\\/")
    return (f'<div class="memviz">'
            f'<div class="shelves">{shelves}</div>'
            f'<div class="bus" aria-hidden="true"><span></span></div>'
            f'<div class="ctx" aria-hidden="true"><div class="ctx-h"><span>{v["ctx"]}</span><span class="ctx-run"></span></div>'
            f'<div class="ctx-agent"><span class="seat"></span><span class="who">{v["empty"]}</span></div>'
            f'<div class="ctx-body">{blocks_}</div><div class="ctx-log"></div></div>'
            f'<script type="application/json" class="mv-data">{data}</script></div>')

def blocks(lang, t):
    shifts = "".join(f'<div class="shift"><div class="ft"><s>{a}</s><span class="ar">→</span><b>{b}</b></div><p>{c}</p></div>' for a, b, c in t["shifts"])
    prin = "".join(f'<div class="pr"><div class="pn">{i:02d}</div><h3>{h}</h3><p>{p}</p></div>' for i, (h, p) in enumerate(t["prin"], 1))
    mem = memviz(t)
    legend = "".join(f'<span>{meter(n, t)}<em>{t["lv_d"][n]}</em></span>' for n in (1, 2, 3, 4))
    ro = "".join(f'<div class="ro"><span class="old">{a}</span><span class="ar">→</span><span class="new"><b>{b}</b>{c}</span></div>' for a, b, c in t["ro"])
    return f'''<!-- prinzipien:start -->
    <section class="s" id="thesis">
      <div class="wrap">
        <div class="eyebrow">{t["th_eb"]}</div>
        <h2>{t["th_h2"]}</h2>
        <p class="lead">{t["th_lead"]}</p>
        <div class="shifts">{shifts}</div>
      </div>
    </section>

    <section class="s" id="principles">
      <div class="wrap">
        <div class="eyebrow">{t["pr_eb"]}</div>
        <h2>{t["pr_h2"]}</h2>
        <div class="princ">{prin}</div>
        <div class="memory" id="memory">
          <h3>{t["mem_h3"]}</h3>
          <p class="lead">{t["mem_lead"]}</p>
          {mem}
          <p class="claim-s">{t["mem_note"]}</p>
        </div>
      </div>
    </section>

    <section class="s" id="org">
      <div class="wrap">
        <div class="eyebrow">{t["org_eb"]}</div>
        <h2>{t["org_h2"]}</h2>
        <p class="lead">{t["org_lead"]}</p>
        <div class="lv-legend">{legend}</div>
        <p class="hint">{t["org_hint"]}</p>
        <div class="orgc">{org(lang, t)}</div>
        <p class="note">{t["org_note"]}</p>
      </div>
    </section>

    <section class="s" id="rosetta">
      <div class="wrap">
        <div class="eyebrow">{t["ro_eb"]}</div>
        <h2>{t["ro_h2"]}</h2>
        <p class="lead">{t["ro_lead"]}</p>
        <div class="rosetta">{ro}</div>
      </div>
    </section>
    <!-- prinzipien:ende -->

'''

def sub(pat, rep, s, flags=re.S):
    s2, n = re.subn(pat, lambda m: rep(m) if callable(rep) else rep, s, count=1, flags=flags)
    if n != 1:
        sys.exit(f"Muster nicht gefunden: {pat[:60]}")
    return s2

for lang, path in (("en", ROOT / "en/method/index.html"), ("de", ROOT / "method/index.html")):
    t = T[lang]
    s = path.read_text(encoding="utf-8")
    s = re.sub(r"<!-- prinzipien:start -->.*?<!-- prinzipien:ende -->\n\n", "", s, flags=re.S)
    s = sub(r"<title>.*?</title>", f"<title>{t['title']}</title>", s)
    s = sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + t["desc"], s)
    s = sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + t["title"], s)
    s = sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m.group(1) + t["desc"], s)
    hero = f'''<section class="hero-light">
      <div class="wrap">
        <div class="eyebrow">{t["eyebrow"]}</div>
        <h1>{t["h1"]}</h1>
        <p class="lead">{t["lead"]}</p>
        <div class="btns"><a class="btn pri" href="#principles">{t["b1"]}</a><a class="btn" href="#night">{t["b2"]}</a></div>
      </div>
    </section>'''
    s = sub(r'<section class="hero-light">.*?</section>', hero, s)
    s = re.sub(r'\n\s*<section class="s" id="agents">.*?</section>\n', "\n", s, count=1, flags=re.S)
    s = sub(r'(    <section class="s" id="tempo">)', lambda m: blocks(lang, t) + m.group(1), s)
    s = sub(r'(<section class="s" id="process">.*?<h2>).*?(</h2>)', lambda m: m.group(1) + t["proc_h2"] + m.group(2), s)
    s = sub(r'"dive": \[.*?\],', t["dive"], s)
    if t["bio_old"] in s:
        s = s.replace(t["bio_old"], t["bio_new"])
    elif t["bio_new"] not in s:
        sys.exit(f"Bio nicht gefunden ({lang})")
    if t["buzz"][0][0] not in s:
        bz = "".join(f'\n          <div><b>{a}</b><span>{b}</span></div>' for a, b in t["buzz"])
        s = sub(r'(<div class="buzz">)', lambda m: m.group(1) + bz, s)
    path.write_text(s, encoding="utf-8", newline="\n")
    print(lang, "ok", len(s), s.count('class="tile'))
