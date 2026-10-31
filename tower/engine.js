// Tower game – simulation engine (no DOM). Loaded by index.html and by tool/sim_check.js.
// Time unit: game seconds since midnight. Floors: 0 = lobby, 1..MAX_FLOOR above, MIN_FLOOR..-1 basements.
// Floor arrays are indexed with fi(f) = f - MIN_FLOOR (TOWER-a0010 P1).
(function (root) {
  'use strict';

  const CFG = {
    W: 56,                 // tiles of the world: tower A [0, TW), gap, tower B [TWIN_X, W) (TOWER-a0011 P7, E40)
    TW: 24,                // tiles per floor of one tower
    TWIN_X: 32,            // tower B starts here (★★★★★); the gap TW … TWIN_X − 1 only takes a bridge (E43/E60)
    TWIN_STAR: 5,          // tower B, its half of the EG and the bridge from this star on (E42/E69)
    MAX_FLOOR: 200,        // ★★★★★ builds up to 200 (TOWER-a0011 P1, E1); the stars unlock the height
    MIN_FLOOR: -12,        // deepest basement any star can reach (arrays reserve it; stars unlock the depth)
    SKY_EVERY: 15,         // sky lobbies only on 15, 30, 45 (★★★: 60, 75, 90 too)
    // plant floors (P5, E13/E32): above these floors one may only build once a plant floor (`tech`) stands on them
    techFloors: [50, 75, 100, 125, 150, 175],
    DAY_START: 6 * 3600,
    DAY_END: 24 * 3600,
    ENTRANCE_X: 12,
    walkSpeed: 0.25,       // tiles per game second
    // energy: every part of a trip costs some, rooms give it back. A trip that would push energy
    // below 0 is impossible; tired people feel every minute longer (rating).
    energy: {
      min: 70, max: 130,   // personal maximum, drawn per person from the game seed
      ref: 100,            // energy used to decide whether a room is reachable at all
      corridor: 0.5,       // per tile walked (whole floor = 24 tiles = 12)
      waitPerMin: 1,       // standing in an elevator queue
      ridePerMin: 0,       // riding an elevator
      recoverPerHour: 30,  // resting in a room or outside
      mealPerHour: 120,    // eating in a restaurant
      tiredBelow: 0.5,     // below this share of the maximum people get tired ...
      tiredFactor: 1.0,    // ... and at 0 energy every minute counts (1 + tiredFactor)-fold
      step: 4,             // routing: energy is discretised in steps of this size
    },
    // routing estimates (felt minutes) – the real wait is only known afterwards
    route: { waitGuess: 3, perFloor: { normal: 0.35, express: 0.15, double: 0.35, service: 0.35, twin: 0.35, multi: 0.07, maglev: 0.03 }, queuePenalty: 0.2 },
    doorTime: 6,
    boardTime: 1.5,
    goodMin: 12,           // avg trip minutes: <= good, <= ok, above = bad
    okMin: 25,
    energyGood: 0.6,       // heatmap "Energie": Ø share left on arrival >= good, >= ok, below = exhausted
    energyOk: 0.35,
    startMoney: 500000,
    // economy (TOWER-a0006 P1): every used floor above the lobby costs upkeep per day, more the
    // higher it is (blocks of 5 floors); rent = potential rent × fulfilment; a small loan as lifeline
    economy: {
      floorUpkeep: 12000,    // € per day for a floor with floor (room or shell), EG free (P2: 13000 → 12000, office lunch costs ~5 % rent)
      floorUpkeepStep: 0.25, // + this share per block of floorBlock floors
      floorBlock: 5,
      // above the 100. OG (TOWER-a0011 P1, E5; nothing changes up to 100): floors cost at most floorUpkeepCap (= the 100. OG),
      // office/flat rent × (1 + per × (f − from)) for f > from (150. OG × 1.5, 200. OG × 2) – height pays at the top
      floorUpkeepCap: 72000,
      heightRent: { from: 100, per: 0.01 },
      loanStep: 100000, loanMax: 300000,
      loanRate: 0.01,        // interest per day on the loan
      loanBlockDays: 3,      // no new loan after this many loss days in a row
      heatEven: 2000,        // heatmap "Geld": |floor net| below this = even, below heatStrong = low
      // basements (TOWER-a0010 P1, E3): digging costs, rooms pay a surcharge; upkeep per basement floor =
      // floorUpkeep × (base + perFloor × depth) – ventilation, pumps, light around the clock; no height step
      basementShell: 2000,   // € per shell tile below 0 (above: shell.cost)
      basementRoom: 1.5,     // room price × this below 0
      basementUpkeep: { base: 1.5, perFloor: 0.25 },
      heatStrong: 10000,
    },
    // wear and maintenance: cars wear per stop with people and per floor driven (CFG.shafts),
    // slow down from slowAt, break down at 100; workshops send mechanics, emergency service on click
    wear: { slowAt: 70, slowFactor: 0.8 },
    serviceAt: 75,           // default wear that opens a job (workshop panel: serviceMin–serviceMax)
    serviceMin: 40, serviceMax: 90,
    repair: { sec: 30 * 60, parts: 5000, blockSec: 30 * 60 },   // blockSec: job pause after a mechanic gave up
    emergency: { cost: 40000, delaySec: 60 * 60 },
    mechanics: { perWorkshop: 2, shiftStart: 6 * 3600, shiftEnd: 22 * 3600 },
    // basement: true = may be built below 0 (whitelist, E23; no daylight: nobody lives or works there),
    // basementOnly: true = only below 0. Everything else is above ground only.
    // star = from which star it can be built (default 0). Providers (TOWER-a0006 P2) have seats,
    // a price per visit (Kita: per child and day) and upkeep per day; `no` = text when none is there.
    // P1 money scale: a provider with the traffic of ~10 upscale rooms around it about carries its own
    // upkeep – the profit is in the upgrades it makes possible (+60 % rent net, see tiers)
    rooms: {
      office:      { w: 4, cost: 40000,  rent: 5000, cap: 6, label: 'Büro',       icon: '💼' },
      condo:       { w: 3, cost: 50000,  rent: 3000, cap: 3, label: 'Wohnung',    icon: '🏠' },
      restaurant:  { w: 6, cost: 80000,  price: 80, seats: 24, basement: true, label: 'Restaurant', icon: '🍽️', no: 'kein Restaurant' },
      skylobby:    { w: 6, cost: 100000, star: 1, label: 'Sky-Lobby', icon: '🛋️' },
      workshop:    { w: 4, cost: 60000,  upkeep: 5000, basement: true, label: 'Werkstatt', icon: '🔧' },
      cafe:        { w: 3, cost: 45000,  seats: 8,  price: 60,  upkeep: 2000, star: 1, label: 'Café',       icon: '☕', no: 'kein Café' },
      daycare:     { w: 4, cost: 70000,  seats: 10, price: 600, upkeep: 4000, star: 1, label: 'Kita',       icon: '🧸', no: 'keine Kita' },
      supermarket: { w: 6, cost: 120000, seats: 16, price: 150, upkeep: 6000, star: 1, walkIn: 30, basement: true, label: 'Supermarkt', icon: '🛒', no: 'kein Supermarkt' },
      gym:         { w: 5, cost: 90000,  seats: 12, price: 200, upkeep: 2000, star: 1, basement: true, label: 'Fitness',    icon: '🏋️', no: 'kein Fitness' },
      // ★★ luxury providers and the hotel (TOWER-a0010 P3, E9/E10/E27/E29). rooftop: only under the open sky
      // (`open`: nothing built above it; built over later = half the guests and half its share for the need),
      // `guests` = its own guests from outside per evening (like the restaurant's, not `walkIn`).
      // hotel: `suites` (not seats – seats make a provider), fixed tier luxury, `night` € per guest and night
      spa:         { w: 5, cost: 200000, seats: 10, price: 300, upkeep: 8000, star: 2, basement: true, label: 'Spa',        icon: '💆', no: 'kein Spa' },
      rooftop:     { w: 6, cost: 250000, seats: 20, price: 120, upkeep: 8000, star: 2, open: true, guests: 30, label: 'Rooftop-Bar', icon: '🍸', no: 'keine Rooftop-Bar' },
      hotel:       { w: 6, cost: 300000, upkeep: 6000, suites: 6, night: 1500, tier: 2, star: 2, label: 'Hotel', icon: '🛎️' },
      // underground garage (P4, E11/E27/E29): only below 0, spaces (not seats), perUser = € per user and day
      // ★★ parcel lockers (TOWER-a0011 P2, E15): couriers of the day leave their parcel here instead of riding up to the room
      // (the nearest reachable one by way from the entrance, while `parcels` last); `fee` € per parcel
      // upkeep 500 → 200 (Setzung P2): with couriers only for luxury (E65) 20 luxury rooms bring 12 parcels = 240 €
      lockers:     { w: 2, cost: 30000, upkeep: 200, star: 2, basement: true, parcels: 40, fee: 20, label: 'Paketschrank', icon: '📦' },
      garage:      { w: 8, cost: 400000, upkeep: 5000, spaces: 60, perUser: 200, basement: true, basementOnly: true, star: 2, label: 'Tiefgarage', icon: '🚗' },
      // ★★★ providers of several needs (TOWER-a0011 P3, E18/E74): `provides` = needs it serves next to their main provider
      // (CFG.needs.<k>.provider). cinema: the evening without the open sky, basement too, `guests` from outside in
      // guestWhen (weekend × 2); pool: sport and spa; library: a big quiet coffee place with walk-in customers in
      // walkInHours on walkInDays (weekday index, Mo = 0). Upkeep cinema 4,800 / library 2,400 (E74: full ≥ 1.1 × upkeep)
      cinema:      { w: 8, cost: 400000, upkeep: 4800, seats: 40, price: 100, star: 3, basement: true, provides: ['evening'], guests: 40, guestWhen: [19 * 3600, 22 * 3600], label: 'Kino', icon: '🎬', no: 'kein Kino' },
      pool:        { w: 6, cost: 350000, upkeep: 6000, seats: 20, price: 250, star: 3, basement: true, provides: ['sport', 'spa'], label: 'Pool', icon: '🏊', no: 'kein Pool' },
      library:     { w: 6, cost: 250000, upkeep: 2400, seats: 20, price: 40, star: 3, provides: ['coffee'], walkIn: 20, walkInHours: [14 * 3600, 18 * 3600], walkInDays: [0, 1, 2, 3, 4], label: 'Bibliothek', icon: '📚', no: 'keine Bibliothek' },
      // ★★★★ district lobby (TOWER-a0011 P4, E22/E74/E78): only on floors f % every = 0 (50, 100, 150, 200), counts as a lobby
      // (`lobby`: change of car, the express stops) and serves coffee and shopping at the change – `prices` per need like café
      // and supermarket (price = the café's for anything else). Upkeep 6,400 (E74: full ≥ 1.1 × upkeep)
      // ★★★★ logistics centre (E23/E75): the cleaning of up to `rooms` rooms a day starts here (the nearest centre by way) and runs
      // in CFG.cleaning.center instead of coming from the street in the waves. No takings – it saves the tenants waiting time
      logistics:   { w: 6, cost: 300000, upkeep: 10000, star: 4, basement: true, rooms: 200, label: 'Logistikzentrale', icon: '🧺' },
      // ★★★★ deep station (TOWER-a0011 P5, E28/E74): only from the 6th basement down (minDepth), its floor counts as a lobby (`lobby`:
      // change of car, the express stops – commuters without the EG); an entry room like the garage (CFG.entries.station: share of the
      // tenants up to `spaces`), public guests coming by train (E29) pay perUser too. Upkeep 24,000 (E74); perUser 100 (E89, qa-P5 F1: with 50 a
      // ★★★★ tower of ~1,500 people took 90,150 € a week against 168,000 €)
      station:     { w: 12, cost: 8000000, upkeep: 24000, star: 4, basement: true, basementOnly: true, minDepth: -6, lobby: true, spaces: 400, perUser: 100, event: 'train', label: 'Tiefbahnhof', icon: '🚇' },
      // ★★★★ heliport (E30/E69/E78): only from the 100th floor up (fromFloor) and at the tower's outer edge (x = 0 or x + w = W – never
      // towards the gap of a second tower, P7); an entry room in the middle of the tower for luxury offices from the 100th floor
      // (CFG.entries.heliport), 40 spaces, 600 € per user, event 'heli' {room}. Full 24,000 > 15,000
      heliport:    { w: 4, cost: 3000000, upkeep: 15000, star: 4, fromFloor: 100, edge: true, spaces: 40, perUser: 600, event: 'heli', label: 'Heliport', icon: '🚁' },
      // ★★★★★ airship port (TOWER-a0011 P8, E48/E69/E81): from the 150th floor up at the outer edge (never towards the gap); an entry room
      // (CFG.entries.airship, before the garage) for luxury residents from the 150th – they come and go sideways instead of 150 floors down.
      // Closed on a storm day (r.closed, E49: they take the street). Upkeep 30,000 → 22,000 (Setzung P8): residents go out on ~75 % of the days,
      // so 30 spaces assigned bring 22–23 users = ~27,400 € a day (measured, sim_check luftschiff) – 30,000 was a loss even when full
      airship:     { w: 6, cost: 8000000, upkeep: 22000, star: 5, fromFloor: 150, edge: true, spaces: 30, perUser: 1200, label: 'Luftschiffhafen', icon: '🛩️' },
      // ★★★★ checkpoint (E31): its floor is secured – every way that ends at an office/flat there counts CFG.checkpoint.extraSec
      // felt seconds more; luxury offices there pay rent × CFG.checkpoint.rentK (later bank, embassy, ministry need it, P6/P8)
      checkpoint:  { w: 2, cost: 200000, upkeep: 3000, star: 4, label: 'Schleuse', icon: '🚪' },
      // ★★★★ facade gondola (TOWER-a0011 P6, E34/E60/E78): from the 120th floor up (fromFloor); protects the floors f − reach … f of its
      // tower from the ice above the cloud line (CFG.weather, like damperAt for quakes). No takings – a tool
      gondola:     { w: 3, cost: 600000, upkeep: 4000, star: 4, fromFloor: 120, reach: 60, label: 'Fassadengondel', icon: '🚡' },
      // ★★★★ tenants without people (TOWER-a0011 P6, E36/E74/E78): `noPeople` – always let (occupied), no move-in, no needs, no people (they do
      // not count as people); `rent` every evening. server: the full rent only with a plant floor (tech) at most `cool` floors away in its tower
      // (cooling), else the half. storage (self-storage, 🗄️): walk-in customers in walkInHours on walkInDays (own stream like the library) who
      // pay `price` and stay `stay` – `seats` = customers at once. The problem: floors 100–120 do not carry themselves; the tool: rent without traffic
      server:      { w: 6, cost: 400000, upkeep: 2000, rent: 22000, star: 4, noPeople: true, cool: 10, label: 'Serverraum', icon: '🖥️' },
      storage:     { w: 6, cost: 150000, upkeep: 1000, rent: 6000, star: 4, basement: true, noPeople: true, seats: 5, price: 50, stay: 15 * 60, walkIn: 10, walkInHours: [10 * 3600, 18 * 3600], walkInDays: [0, 1, 2, 3, 4, 5], label: 'Self-Storage', icon: '🗄️' },
      // ★★★★ public rooms (E29/E65/E78): no tenants – visitors from the own stream CFG.publicVisits (× trip rating 1 / 0.7 / 0.4 like the
      // restaurant's guests), a share from a reachable station, else from the street; they pay `price` and stay `stay` s (the school:
      // until `until` + up to 30 min.). visitWhen = arrival windows, visitDays = weekdays (Mo = 0), visitK = factor per weekday
      passage:     { w: 12, cost: 600000, upkeep: 15000, seats: 40, price: 120, star: 4, public: true, visitors: 150, visitWhen: [[10 * 3600, 19.5 * 3600]], visitDays: [0, 1, 2, 3, 4, 5], visitK: { 5: 2 }, stay: 30 * 60, label: 'Einkaufspassage', icon: '🛍️' },
      clinic:      { w: 6, cost: 300000, upkeep: 8000, seats: 15, price: 150, star: 4, public: true, visitors: 80, visitWhen: [[8 * 3600, 11.5 * 3600], [14 * 3600, 16.5 * 3600]], visitDays: [0, 1, 2, 3, 4], stay: 30 * 60, label: 'Ärztehaus', icon: '🩺' },
      school:      { w: 10, cost: 500000, upkeep: 10000, seats: 60, price: 250, star: 4, public: true, visitors: 60, visitWhen: [[7.75 * 3600, 8.25 * 3600]], visitDays: [0, 1, 2, 3, 4], until: 13 * 3600, label: 'Schule', icon: '🏫' },
      townhall:    { w: 8, cost: 400000, upkeep: 8000, seats: 20, price: 100, star: 4, public: true, visitors: 100, visitWhen: [[9 * 3600, 11.75 * 3600]], visitDays: [0, 1, 2, 3, 4], stay: 20 * 60, label: 'Bürgeramt', icon: '🏛️' },
      district:    { w: 10, cost: 1500000, upkeep: 6400, seats: 26, price: 60, prices: { coffee: 60, shopping: 150 }, star: 4, lobby: true, every: 50, provides: ['coffee', 'shopping'], label: 'Stadtviertel-Lobby', icon: '🏘️', no: 'keine Stadtviertel-Lobby' },
      // ★★★ (P5, E13/E15): plant floor (no tenants, loud like the workshop; required on CFG.techFloors before building
      // above them) and the tuned mass damper: protects `reach` floors below itself and its own floor; levels via
      // „▲ Aufwerten“ (cost = price of the level, its upkeep replaces the one before); level n takes n steps off a quake
      tech:        { w: 6, cost: 150000, upkeep: 3000, star: 3, label: 'Technikebene', icon: '⚙️' },
      // bridge (TOWER-a0011 P7, E43): floor across the gap (x TW … TWIN_X − 1) on f % 50 = 0, only with floor on both sides; a lobby in
      // both towers (change there), its passage is a noise source (CFG.noise.bridge). Infrastructure: no takings
      bridge:      { w: 8, cost: 5000000, upkeep: 20000, star: 5, lobby: true, bothTowers: true, every: 50, label: 'Brücke', icon: '🌉' },
      // power ★★★★★ (TOWER-a0011 P8, E52/E78): geothermal plant only on the deepest floor (onlyFloor) – it bores itself (`bore`: no dug floor
      // above needed, T1-E20 does not apply; only its own floor costs upkeep); wind turbine from the 150th under the open sky (built over or in a
      // storm: nothing). `power` = MW it adds to CFG.power.grid. Infrastructure: no takings
      geothermal:  { w: 8, cost: 10000000, upkeep: 20000, star: 5, basement: true, basementOnly: true, onlyFloor: -12, bore: true, power: 40, label: 'Geothermie', icon: '🌋' },
      wind:        { w: 2, cost: 1000000, upkeep: 2000, star: 5, fromFloor: 150, open: true, power: 3, label: 'Windrad', icon: '🌬️' },
      // ★★★★★ sky garden (TOWER-a0011 P8, E50/E74/E81): above the clouds (fromFloor 121) under the open sky, evening and sport for the luxury up
      // there without the long ride down; closed on a fog day (r.closed – nobody goes, the need counts 0 for those who wanted it)
      skygarden:   { w: 6, cost: 500000, upkeep: 3000, seats: 30, price: 40, star: 5, fromFloor: 121, open: true, provides: ['evening', 'sport'], label: 'Wolkengarten', icon: '🌿', no: 'kein Wolkengarten' },
      // ★★★★★ antenna (E50/E73): a tenant without people (`noPeople`, like the server) – its lease `rent` only while nothing stands in its columns
      // above it (`skyAll`: every floor above, not just the next; a station elsewhere does not disturb) and from the 180th (fromFloor); the
      // studio (whole office floor, P8f) wants one
      antenna:     { w: 2, cost: 2000000, upkeep: 2000, rent: 30000, star: 5, fromFloor: 180, open: true, skyAll: true, noPeople: true, label: 'Antenne', icon: '📡' },
      // ★★★★★ space elevator station (TOWER-a0011 P9, E54/E65/E81): only on the 200th (onlyFloor) under the open sky. Tourists (visitors, role
      // 'tourist', own stream CFG.tourists) arrive in visitWhen every day – a share by the airship port (CFG.tourists.fromAirship), a share by train
      // (publicVisits.fromStation), the rest from the street –, stay `stay` and go back the way they came; `tourists` × trip rating (1 / 0.7 / 0.4
      // like the public rooms), each pays `price`. The problem: long-distance traffic EG → 200; the tool: maglev, MULTI. Its panel builds the
      // platform (CFG.goal, r.platform) – the goal
      spacestation: { w: 12, cost: 40000000, upkeep: 60000, star: 5, onlyFloor: 200, open: true, seats: 20, price: 5000, tourists: 20, visitWhen: [[10 * 3600, 15 * 3600]], stay: 60 * 60, label: 'Weltraumstation', icon: '🛰️' },
      damper:      { w: 6, cost: 2000000, upkeep: 5000, star: 3, reach: 60, label: 'Schwingungsdämpfer', icon: '🌀',
        levels: [{ label: 'Dämpfer', cost: 2000000, upkeep: 5000 }, { label: 'Aktiver Dämpfer', cost: 6000000, upkeep: 10000 }, { label: 'Isolierte Gründung', cost: 18000000, upkeep: 15000 }] },
    },
    shafts: {
      normal:  { base: 30000, perFloor: 2000, car: 15000, upkeep: 3000, cap: 10, speed: 1 / 20, maxSpan: 15, maxCars: 4, wearPerStop: 0.015, wearPerFloor: 0.016, label: 'Aufzug' },
      // lobbyOnly (TOWER-a0011 E62): stops only in lobbies (serves/stopAllowed read it, index.html too)
      express: { base: 80000, perFloor: 3000, car: 30000, upkeep: 6000, cap: 20, speed: 1 / 8,  maxSpan: 50, maxCars: 4, wearPerStop: 0.015, wearPerFloor: 0.006, star: 1, lobbyOnly: true, label: 'Express' },
      // ★★★ fire lift (TOWER-a0011 E14/E59): no passengers (`noRiders`: not in the routing graph, mechanics do not use it
      // either); building above fireLift.from needs one from the EG up to at least f − fireLift.gap (new building only)
      // ★★★ double deck (E13/E63): two cars on top of each other – the car stops only on floors f0, f0 + 2, …: lower deck
      // there, upper deck one floor higher, both at once; `cap` for both decks together (cap / 2 each); routing joins only
      // doors of the same parity, a rider keeps his deck (p.deck)
      double:  { base: 120000, perFloor: 5000, car: 60000, upkeep: 8000, cap: 20, speed: 1 / 20, maxSpan: 30, maxCars: 3, wearPerStop: 0.015, wearPerFloor: 0.016, star: 3, decks: 2, label: 'Doppeldecker' },
      fire:    { base: 150000, perFloor: 3000, car: 40000, upkeep: 4000, cap: 8, speed: 1 / 12, maxSpan: 200, maxCars: 1, wearPerStop: 0.015, wearPerFloor: 0.016, star: 3, noRiders: true, label: 'Feuerwehraufzug' },
      // ★★★★ service lift (TOWER-a0011 P4, E24): like the normal one, `svcOnly` – tenants and visitors never use it; cleaners and
      // mechanics take a way over service lifts, stairs and escalators only when there is one (routing table svcCache, lazy), else the
      // public way
      service: { base: 30000, perFloor: 2000, car: 15000, upkeep: 3000, cap: 10, speed: 1 / 20, maxSpan: 15, maxCars: 4, wearPerStop: 0.015, wearPerFloor: 0.016, star: 4, svcOnly: true, label: 'Dienstaufzug' },
      // ★★★★ TWIN (E25/E63): exactly `cars` cars in one shaft (the second one's price in the build cost) – car 0 rides f0…split,
      // car 1 split…f1 (car.lo/car.hi); at the split one changes like in a lobby (no lobby room), the lower car takes only those
      // going down there, the upper only those going up. s.split (default the middle, panel ▲/▼) is saved
      twin:    { base: 60000, perFloor: 2000, car: 30000, upkeep: 3000, cap: 10, speed: 1 / 20, maxSpan: 30, maxCars: 2, cars: 2, wearPerStop: 0.015, wearPerFloor: 0.016, star: 4, twin: true, label: 'TWIN' },
      // ★★★★★ MULTI (TOWER-a0011 P7, E44/E78): rope-less cars, up to 8 in one shaft, fast and as far as one likes; stops only in lobbies
      // (like the express). Sideways at a bridge floor (s.c2/s.fb) is a later step (open, finding)
      multi:   { base: 400000, perFloor: 20000, car: 300000, upkeep: 15000, cap: 12, speed: 1 / 4, maxSpan: 200, maxCars: 8, wearPerStop: 0.015, wearPerFloor: 0.006, star: 5, lobbyOnly: true, label: 'MULTI' },
      // ★★★★★ maglev (TOWER-a0011 P8, E47/E62/E78): magnetic express, 100 floors ≈ 3 min. – stops only on the EG, a station floor and floors
      // f % stopEvery = 0 that are a lobby (district lobby, bridge, a sky lobby on 150); no private stop. The problem: 200 floors = ½ h of
      // express chain
      maglev:  { base: 5000000, perFloor: 50000, car: 2000000, upkeep: 40000, cap: 40, speed: 1 / 1.8, maxSpan: 200, maxCars: 2, wearPerStop: 0.015, wearPerFloor: 0.006, star: 5, lobbyOnly: true, stopEvery: 50, label: 'Maglev' },
    },
    fireLift: { from: 50, gap: 10 },
    // ★★ deliveries (E15/E65): Mo–Sa 9–17 couriers (visitors, role 'courier', not rated) from the street to an occupied tenant
    // room and back after `stay` s; per room and day perRoom[tier] × merged, the fractions carried along the rooms from a phase
    // that moves on every day (golden ratio) – the tower gets ⌊Σ⌋ or ⌈Σ⌉ a day (20 luxury rooms: 12), every room its share over
    // the days; times and street positions from the own stream seed ^ salt + day
    delivery: { star: 2, perRoom: [0, 0, 0.6], hours: [9 * 3600, 17 * 3600], stay: 3 * 60, salt: 0x9AC5E7, closed: [6] },
    // ★★★★ cleaning (TOWER-a0011 P4, E23/E65/E75 – the second traffic): every day one cleaner (visitor, role 'cleaner', not rated)
    // per occupied office/flat from tier 1; without a logistics centre from the street, alternately in street[0] and street[1]
    // (in the waves), else from the centre in `center`; `stay` s in the room, then back. Times, street positions and exits from
    // the own stream seed ^ salt + day (this.rand untouched); cleaners and mechanics prefer the service lift (E24)
    cleaning: { star: 4, salt: 0x10C157, stay: 30 * 60, street: [[6 * 3600, 8 * 3600], [18 * 3600, 21 * 3600]], center: [20 * 3600, 23.5 * 3600] },
    // ★★ destination dispatch (E12/E61, panel „🎯 Zielwahl“ per shaft, s.dd): at a lobby (and the shaft's lowest floor) with at
    // least 2 running cars a car going up takes the first in the queue and then those for the same band of stops (band =
    // ⌈stops above / running cars⌉ stops wide) – fewer stops per round. free: who rides at most this many floors is in every
    // band (fallback „Offene Punkte 6“); fill: room left after the band is filled with the next in the queue (Setzung P2 –
    // pure E61 with free 0 / fill false made the morning wait × 1.36, see protocol). Bought once, upkeep per day
    dispatch: { cost: 50000, upkeep: 1000, star: 2, kinds: ['normal', 'express'], free: 3, fill: true },
    // ★★★ private stop (TOWER-a0011 P3, E21): an express (lobbyOnly shaft) may stop on one floor with a merged room of at least
    // minMerged rooms (s.priv = f, one per shaft, paid once + upkeep per day) – no change of car, no lobby on the way. Law firm
    // and penthouse (`tenants`) on such a floor pay rent × rentK. The problem: every private stop slows the express for all
    // ★★★★ checkpoint (E31): + felt seconds per way to an office/flat on a secured floor, rent factor of luxury offices there
    checkpoint: { extraSec: 90, rentK: 1.15 },
    // ★★★★ public visitors (E29/E65): own stream seed ^ salt + day; fromStation = share coming by train when a station is reachable
    publicVisits: { salt: 0x5B11C, fromStation: 0.6, leaveSpread: 30 * 60 },
    // ★★★★ visitors of tenant types (TOWER-a0011 P6, E38/E65): the public mechanics (E29) with a tenant room as the destination – per occupied
    // room of a type with `visitors` (CFG.tenants) that many a day × trip rating (1 / 0.7 / 0.4) in its visitWhen on its visitDays, a share by
    // train (publicVisits.fromStation), the rest from the street; they stay the type's `stay` and leave the way they came. Own stream
    callers: { salt: 0xCA11E5 },
    // ★★★★★ tourists of the space station (TOWER-a0011 P9, E54/E65): own stream seed ^ salt + day; fromAirship = share coming by a reachable,
    // open airship port (they start and end there and pay its perUser), else the station share as the public visitors, else the street
    tourists: { salt: 0x70E157, fromAirship: 0.3 },
    // the goal (TOWER-a0011 P9, E55/E68/E81): the platform on a space station (its panel, `cost`), then `days` evenings in a row with satisfaction
    // ≥ `sat` → goal.done; the day after at `launchAt` the first cabin rides up the rope (event 'launch', game.onLaunch, game.launchT). No end
    // screen, no certificate – the tower goes on
    goal: { cost: 60000000, days: 7, sat: 0.85, launchAt: 12 * 3600 },
    priv: { star: 3, cost: 300000, upkeep: 3000, minMerged: 3, rentK: 1.15, tenants: ['lawfirm', 'penthouse', 'hq', 'embassy', 'authority', 'maisonette', 'loft', 'studio', 'ministry', 'clan', 'spaceagency'] },   // E21: and the P6/P8/P9 types
    // ----- needs, penalties, tiers (TOWER-a0006 P2, concept sections 3–5) -----
    // fulfilment of a need from the felt minutes t to the provider: 1 up to t0, 1 − ((t − t0)/(t1 − t0))^k
    // between, 0 from t1 or unreachable
    needCurve: { t0: 4, t1: 20, k: 2 },
    // who goes where: provider room type (street: the entrance counts as a provider too), start point of the
    // trip ('room' or 'entrance' – forecast and measurement use the same), stay in s, share of people
    // (sport: a trait from the seed, coffee: drawn each day), when = time windows, every = every n-th day
    needs: {
      lunch:     { provider: 'restaurant', street: true, from: 'room', label: 'Mittagessen' },   // the old meal trip (60 % of office people)
      coffee:    { provider: 'cafe', from: 'room', stay: 15 * 60, share: 0.5, when: [[10 * 3600, 10.5 * 3600], [15 * 3600, 15.5 * 3600]], label: 'Kaffee' },
      childcare: { provider: 'daycare', from: 'entrance', stay: 10 * 60, pickup: 16.5 * 3600, label: 'Kinderbetreuung' },
      shopping:  { provider: 'supermarket', from: 'entrance', stay: 20 * 60, every: 2, label: 'Einkauf' },
      sport:     { provider: 'gym', from: 'room', stay: 45 * 60, share: 0.3, when: [[6 * 3600, 8 * 3600], [18 * 3600, 20 * 3600]], label: 'Sport' },
      // ★★ luxury (P3): residents from their flat in the evening (weekend: during the day); luxury offices
      // go 18–19 and visit the rooftop (evening) or the gym (sport) on the way out (E30)
      spa:       { provider: 'spa', from: 'room', stay: 60 * 60, share: 0.5, when: [[17 * 3600, 21 * 3600]], weekendWhen: [[10 * 3600, 20 * 3600]], label: 'Spa' },
      evening:   { provider: 'rooftop', from: 'room', stay: 60 * 60, share: 0.4, when: [[18 * 3600, 22 * 3600]], label: 'Abend (Bar)' },
    },
    // hotel guests (P3, E10/K15): requests per day = suites × min(1, base × fulfilment yesterday × trip quality
    // (like the restaurant: 1 / 0.7 / 0.4) × (Fr/Sa: busy)); they come 16–22 from the street, stay 1–3 nights,
    // leave 7–10; staying guests make an outing during the day and in the evening eat (lunch: restaurant or
    // street) and go to the bar (evening). Own random stream (seed, day), never this.rand
    hotel: { base: 0.5, busyDays: [4, 5], busy: 2, arrive: [16 * 3600, 22 * 3600], nights: [1, 3], leave: [7 * 3600, 10 * 3600],
      outing: { leave: [9.5 * 3600, 13 * 3600], stay: [2 * 3600, 5 * 3600] }, dine: [18 * 3600, 19.5 * 3600], bar: [20 * 3600, 21.5 * 3600] },
    luxuryOffice: { leave: [18 * 3600, 19 * 3600] },   // luxury offices stay later (E30)
    visitGiveUp: 20 * 60,     // waiting longer than this at a full provider: give up (= 0 for the need)
    walkInHours: [8 * 3600, 20 * 3600],   // walk-in customers (supermarket) from outside
    // tiers 0 standard, 1 upscale, 2 luxury: needs per room type, rent factor, extra upkeep per day as a
    // share of the standard rent (also when vacant), penalty sensitivity
    tiers: [
      { label: 'Standard', star: 0, rent: 1,   upkeep: 0,   sens: { office: 0.5, condo: 1.0 }, needs: { office: ['lunch'], condo: [] } },
      { label: 'Gehoben',  star: 1, rent: 1.8, upkeep: 0.2, sens: { office: 1.5, condo: 1.5 }, needs: { office: ['lunch', 'coffee', 'childcare'], condo: ['shopping', 'sport'] } },
      // luxury (★★, TOWER-a0010 P3, E8); the hotel is fixed on this tier (its guests' needs, no penalty)
      { label: 'Luxus',    star: 2, rent: 3,   upkeep: 0.6, sens: { office: 2.0, condo: 2.0 }, needs: { office: ['lunch', 'coffee', 'childcare', 'sport', 'evening'], condo: ['shopping', 'sport', 'spa', 'evening'], hotel: ['lunch', 'evening'] } },
    ],
    upgradeShare: 0.5,        // upgrading costs this share of the room's build price
    warnBelow: 0.5,           // fulfilment at most this (whole percent as shown) = below the threshold. Not "below":
                              // a flat with one of two needs gone sits at exactly 50 %
    // crumbling instead of jumping (TOWER-a0007): a room is below the threshold on a day with a bad trip
    // rating (score > okMin) or fulfilment at most warnBelow; warnDays counts such days in a row, one good
    // day resets it. While warnDays >= 1 the tenants may go any hour in moveOutHours, with the day's
    // probability moveOutP[warnDays - 1] (last entry from then on) spread over those hours
    moveOutP: [0.05, 0.10, 0.20, 0.30, 0.40],   // card: 0.10 … 0.90 – tuned (README: Balance-Befund TOWER-a0007)
    moveOutHours: [7, 20],
    warnNearWait: 0.8,        // yellow sign: trip rating above this share of okMin ...
    warnNearNeed: 0.6,        // ... or fulfilment at most this (but above warnBelow)
    // demand instead of everyone at once: per hour in demandHours at most ceil(occupied offices+flats /
    // demandPer) move-ins (at least 1), each into a random vacant reachable room
    demandPer: 100,           // card: 25 – tuned; below 100 rooms the minimum of 1 per hour rules
    demandHours: [7, 18],
    moveInMin: 0.6,           // new tenants only if the forecast is at least this ...
    moveInRamp: 0.3,          // ... and only for sure from moveInMin + this (in between: chance grows linearly)
    // penalties (noise, smell) go through walls: d = max(|Δfloor|, gap between room edges / 6),
    // penalty s × (1 − d / r) for d < r, the strongest source counts, × sensitivity of the room
    noise: {
      workshop:    { r: 1.5, s: 0.3 },
      daycare:     { r: 1.5, s: 0.2 },
      supermarket: { r: 1.5, s: 0.2 },
      gym:         { r: 1,   s: 0.15 },
      restaurant:  { r: 1,   s: 0.1 },
      rooftop:     { r: 1,   s: 0.1 },
      cinema:      { r: 1,   s: 0.1 },    // TOWER-a0011 E18
      passage:     { r: 1,   s: 0.15 },   // E29 public rooms
      clinic:      { r: 1,   s: 0.15 },
      school:      { r: 1,   s: 0.15 },
      townhall:    { r: 1,   s: 0.15 },
      server:      { r: 1,   s: 0.2 },    // E36: fans and cooling
      garage:      { r: 1.5, s: 0.3 },
      tech:        { r: 1.5, s: 0.3 },
      bridge:      { r: 1,   s: 0.15 },   // E43: people crossing (rooms up to 6 tiles from the bridge)
    },
    // entry rooms (P4 garage, E11; generalised TOWER-a0011 P5, E27): in this order a tenant gets at most one entry room of a type
    // with `spaces` – share per tier (standard / upscale / luxury) who come and go through it instead of the street while its spaces
    // last, fixed per person by hash (own salt per type; the garage keeps its roll, never this.rand – K23); fromFloor = only rooms
    // from this floor up, kind = only offices / flats. Revenue perUser € per user and day (CFG.rooms.<type>)
    entries: {
      heliport: { share: [0, 0, 0.3], fromFloor: 100, kind: 'office', salt: 0x4E11 },
      airship:  { share: [0, 0, 0.3], fromFloor: 150, kind: 'condo', salt: 0xA125 },   // P8 (E48): luxury residents from the 150th
      garage:   { share: [0.1, 0.3, 0.3] },
      station:  { share: [0.2, 0.2, 0.1], salt: 0x57A7 },
    },
    needHeat: { good: 0.8 },             // heatmap "Bedürfnisse": fulfilment >= good, above warnBelow ok, else bad
    noiseHeat: { ok: 0.01, bad: 0.15 },  // heatmap "Lärm": penalty below ok = good, below bad = ok
    // stairs/escalators connect floor f with f+1; no waiting, but slow and less comfortable.
    // up/down = game seconds per floor, comfort = factor on the felt time of that part of the trip,
    // energyUp/energyDown = energy per floor
    links: {
      stairs:    { w: 2, cost: 5000,  upkeep: 0,    up: 60, down: 40, comfort: 2.0, energyUp: 15, energyDown: 8, label: 'Treppe',     icon: '🪜' },
      escalator: { w: 3, cost: 20000, upkeep: 1000, up: 30, down: 30, comfort: 1.2, energyUp: 4,  energyDown: 4, label: 'Rolltreppe', icon: '↗️' },
    },
    // shell floor ("Rohbau"): bare floor to close gaps; people only walk and queue on built floor
    // (rooms, shell, the lobby). Building fills the whole gap around the tapped tile.
    shell: { cost: 1000, label: 'Rohbau', icon: '🧱' },
    seasonDays: 7,         // days per season (spring, summer, autumn, winter) – looks only; a week since TOWER-a0009
    // week (TOWER-a0009): day 1 is a Monday, the weekday follows from the day number
    week: {
      names: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      // day profile per weekday: half (Mo, Fr: home office), full (Tu–Th), weekend (Sa, Su)
      kind: ['half', 'full', 'full', 'full', 'half', 'weekend', 'weekend'],
      officeShare: 0.5,       // half days: this share of each office's people comes (fixed per person and day from the seed)
      closed: ['office', 'cafe', 'daycare', 'workshop'],   // closed on the weekend (workshop: mechanics stay home, only the emergency service)
      guests: 2,              // weekend: restaurant guests from outside × this (no office lunch, the offices are closed)
      walkIn: 2,              // weekend: walk-in customers × this
      shopEvery: 1,           // weekend: every upscale flat shops (otherwise every needs.shopping.every-th day)
      sport: 2,               // weekend: needs.sport.share × this residents go to the gym ...
      sportWhen: [[9 * 3600, 18 * 3600]],   // ... spread over the day
      outing: { leave: [9.5 * 3600, 14 * 3600], stay: [1.5 * 3600, 4 * 3600] },   // weekend: residents go out and come back
    },
    // index = stars (PO 30.10.2026: a game starts with 0 stars); requirement to REACH this star
    // (pop, sat, restaurants, upgraded, optional luxury = occupied luxury rooms, TOWER-a0010 P3 sets it on ★★★;
    // game.starInfo() and the star check read these generically), maxFloor / minFloor (deepest basement,
    // TOWER-a0010 P1) unlocked with it; baseCost = fixed costs per day at this star (€, TOWER-a0010 P2, E7:
    // administration, insurance, security – money alone must not make the late game easy)
    stars: [
      { maxFloor: 15, minFloor: -1, baseCost: 0 },
      { pop: 100, sat: 0.70, maxFloor: 30, minFloor: -2, baseCost: 2000 },
      { pop: 300, sat: 0.75, restaurants: 1, upgraded: 10, maxFloor: 50, minFloor: -3, baseCost: 6000 },   // upgraded: rooms on tier ≥ 1 (occupied)
      { pop: 700, sat: 0.80, luxury: 10, maxFloor: 100, minFloor: -5, baseCost: 15000 },   // luxury: game.luxuryRooms() (P3, E25)
      { pop: 1500, sat: 0.80, luxury: 25, maxFloor: 150, minFloor: -8, baseCost: 40000 },   // ★★★★ (TOWER-a0011 P1, E1)
      { pop: 3000, sat: 0.85, luxury: 50, maxFloor: 200, minFloor: -12, baseCost: 100000 },  // ★★★★★
    ],
    // in-between goals (TOWER-a0010 P2, E6): only a message + a diary entry, no reward; once per game;
    // the order is the check order. 'calmWeek' and 'merge' are not derived from the state (see _checkMilestones)
    milestones: [
      { key: 'pop50',    text: '50 Leute im Turm' },
      { key: 'upgrade',  text: 'Die erste Aufwertung' },
      { key: 'calmWeek', text: 'Eine ganze Woche ohne Auszug' },
      { key: 'pop200',   text: '200 Leute im Turm' },
      { key: 'basement', text: 'Der erste Keller' },
      { key: 'pop500',   text: '500 Leute im Turm' },
      { key: 'luxury',   text: 'Die erste Luxus-Belegung' },
      { key: 'merge',    text: 'Das erste Zusammenlegen' },
      { key: 'pop1000',  text: '1.000 Leute im Turm' },    // TOWER-a0011 P1 (E10)
      { key: 'pop2000',  text: '2.000 Leute im Turm' },
    ],
    // looks (TOWER-a0011 P1, E10): rewards for milestones, chosen by the player in Menü → 🎨 Aussehen, never switched
    // automatically; `from` = milestone key that unlocks it (none = always). The look track draws them (world.look)
    looks: {
      facade: [{ key: 'plain', label: 'Putz' }, { key: 'brick', label: 'Ziegel', from: 'calmWeek' }, { key: 'glass', label: 'Glas', from: 'pop500' }, { key: 'deco', label: 'Art déco', from: 'pop2000' }],
      cabin: [{ key: 'classic', label: 'Klassisch' }, { key: 'red', label: 'Rot', from: 'upgrade' }, { key: 'brass', label: 'Messing', from: 'luxury' }, { key: 'wood', label: 'Holz', from: 'merge' }],
      windows: [{ key: 'plain', label: 'Normal' }, { key: 'lit', label: 'Nachts beleuchtet', from: 'pop1000' }],
    },
    lookNames: { facade: 'Fassade', cabin: 'Kabinen', windows: 'Fenster' },
    diaryMax: 200,
    // merging side by side (★★★, TOWER-a0010 P6, E12/E34): a luxury office or flat and its direct neighbour of the same
    // kind become one room (at most `max` rooms), for `share` of the build price of each room not merged before (a 3er: of all three, E41). Who moves in is decided
    // by the surroundings when the tenants move in (Game.tenantRule, in this order); cafe/daycare/supermarket = at most
    // this many floors apart, lawfirm = restaurant at most lawfirmMin felt minutes and from floor lawfirmFloor,
    // penthouse = in the top penthouseTop built floors and a spa reachable
    merge: { star: 3, max: 3, share: 0.5, cafe: 2, daycare: 3, supermarket: 3, lawfirmMin: 15, lawfirmFloor: 20, penthouseTop: 5,
      // ★★★★ block of four (TOWER-a0011 P6, E37/E67): a luxury 2er and the same 2er directly above (same x, same width) become one room over two
      // floors (merged 4, h 2) for vertShare of the four build prices; maisonette = Kita and spa each at most maisonetteMin felt minutes
      vertStar: 4, vertShare: 0.25, maisonetteMin: 10,
      practice: 3,   // E38: practice = clinic or passage at most this many floors away
      // ★★★★★ whole floor (TOWER-a0011 P8, E51/E67): from a luxury 3er, every tenant room of the floor in its tower of the same kind, luxury,
      // without a warning, side by side without a gap, nothing else on the floor; rooms = Σ merged (offices 5–6, flats 6–8); share = of the build
      // prices of the rooms not merged before; clanMin = spa, gym and supermarket each at most this many felt minutes; agencyFrom = the space
      // agency's floors from here up (P9, E56)
      whole: { star: 5, share: 0.25, office: [5, 6], condo: [6, 8], clanMin: 8, agencyFrom: 190 } },
    // tenant types (keys shared with the look track, E38): rent = factor on the sum of the luxury rents; people = factor
    // on the people; tier = needs and noise sensitivity of that tier instead of luxury; needs = own list; addNeeds = on top;
    // sens = own noise sensitivity; arrive/leave = office hours instead of 7:30–9:00 / 17:00–18:30 (the same draws mapped);
    // stays = never moves out; hours = every trip of the residents squeezed into this window; outings = residents of the
    // flat who go out per day
    tenants: {
      agency:     { label: 'Agentur', icon: '🎨', rent: 1.2 },
      startup:    { label: 'Startup', icon: '🚀', rent: 0.8, stays: true, arrive: [10 * 3600, 10.5 * 3600], leave: [19.5 * 3600, 20.5 * 3600] },
      callcenter: { label: 'Callcenter', icon: '📞', rent: 0.7, people: 2, tier: 0 },
      lawfirm:    { label: 'Kanzlei', icon: '⚖️', rent: 1.5 },
      family:     { label: 'Familienwohnung', icon: '👪', rent: 1.2, addNeeds: ['childcare'] },
      flatshare:  { label: 'WG', icon: '🎸', rent: 1.0, people: 1.5, needs: ['sport', 'coffee'], sens: 0 },
      penthouse:  { label: 'Penthouse', icon: '🌇', rent: 1.5, outings: 1 },
      seniors:    { label: 'Senioren-Residenz', icon: '🧓', rent: 1.3, hours: [10 * 3600, 16 * 3600] },
      // ★★★★ new tenants of the 2er/3er where P5 rooms are near (TOWER-a0011 P6, E38/E81): practice (before the agency: clinic or passage at most
      // merge.practice floors away; patients 8–12 on weekdays), bank (before the call centre: checkpoint on its floor; never moves out)
      practice:   { label: 'Praxis', icon: '🩺', rent: 1.3, visitors: 10, visitWhen: [[8 * 3600, 12 * 3600]], visitDays: [0, 1, 2, 3, 4], stay: 30 * 60 },
      bank:       { label: 'Bank', icon: '🏦', rent: 1.4, stays: true },
      // ★★★★ block of four (TOWER-a0011 P6, E37/E38/E81): offices – headquarters (private stop on its floor; everyone 8:00–8:30), embassy
      // (checkpoint on its floor), authority (else); flats – maisonette (Kita and spa near), artists' loft (else, noise does not matter)
      hq:         { label: 'Konzernzentrale', icon: '🏢', rent: 1.8, arrive: [8 * 3600, 8.5 * 3600] },
      // visitors (E38): embassy 20 and authority 30 on weekday mornings 9–12, the authority's couriers × 2; the loft 10 in the evening 19–22
      embassy:    { label: 'Botschaft', icon: '🏳️', rent: 1.1, stays: true, visitors: 20, visitWhen: [[9 * 3600, 12 * 3600]], visitDays: [0, 1, 2, 3, 4], stay: 20 * 60 },
      authority:  { label: 'Behörde', icon: '🗂️', rent: 1.0, stays: true, visitors: 30, visitWhen: [[9 * 3600, 12 * 3600]], visitDays: [0, 1, 2, 3, 4], stay: 20 * 60, couriers: 2 },
      maisonette: { label: 'Maisonette', icon: '🏡', rent: 1.6 },
      loft:       { label: 'Künstlerloft', icon: '🎭', rent: 1.1, sens: 0, visitors: 10, visitWhen: [[19 * 3600, 22 * 3600]], visitDays: [0, 1, 2, 3, 4, 5, 6], stay: 60 * 60 },
      // ★★★★★ whole floor (TOWER-a0011 P8, E51/E67/E81): offices – studio (an antenna on air reachable from the floor), ministry (checkpoint on its
      // floor; never moves out; 40 visitors 9–12 on weekdays); flats – clan residence (spa, gym and supermarket each at most merge.whole.clanMin
      // felt minutes; nobody goes out). Else „Luxus-Etage“ (no type, rent × 1)
      studio:     { label: 'Fernsehstudio', icon: '📺', rent: 1.8 },
      ministry:   { label: 'Ministerium', icon: '🏛️', rent: 1.6, stays: true, visitors: 40, visitWhen: [[9 * 3600, 12 * 3600]], visitDays: [0, 1, 2, 3, 4], stay: 20 * 60 },
      clan:       { label: 'Clan-Residenz', icon: '👑', rent: 1.7, outings: 0 },
      // ★★★★★ space agency (TOWER-a0011 P9, E56/E81): a whole office floor from merge.whole.agencyFrom with a space station in its tower – the rule
      // before the studio; never moves out
      spaceagency: { label: 'Raumfahrtagentur', icon: '🚀', rent: 2.5, stays: true },
    },
    // earthquakes from ★★★ (P5, E14/E33): each day `chance`, then strength 1 light / 2 medium / 3 heavy by `levels`;
    // never within minGap days of the last one, none in the first `calm` days after ★★★ (older ★★★ saves: from the
    // day they were loaded), the first one is always light. Own random stream (seed ^ salt + day), never this.rand.
    // Effects by the strength felt on a floor (strength − the strongest damper level covering it):
    // ≥ 1 cars stop for an inspection (inspectSec, emergency fee without an open workshop) and wear + wear[n];
    // ≥ 2 rooms in the top `top[n]` share of the built floors are damaged (rent 0 until repaired for repairShare
    // of the build price, repairSec), their fulfilment −satDrop for satDays days; 3: the highest shaft breaks
    // down and every room below the threshold moves out at once
    // star = from which star quakes come (TOWER-a0011 E2: no longer "the last star")
    quake: { star: 3, chance: 0.02, levels: [0.6, 0.3, 0.1], minGap: 14, calm: 7, salt: 0x51ED27, hours: [8, 20],
      wear: [0, 10, 30, 30], top: [0, 0, 0.2, 0.5], inspectSec: 3600, repairShare: 0.3, repairSec: 3600, satDrop: 0.2, satDays: 3,
      names: ['', 'leicht', 'mittel', 'schwer'] },
    // incidents from ★★★ (TOWER-a0011 P3, E19/E72): each day at most one, drawn by kinds (chance per day each), never on a
    // quake day, never within minGap days of the last one, none in the first `calm` days after ★★★ (same start as the
    // quakes); own random stream (seed ^ salt + day), never this.rand; strikes at a whole hour in `hours`.
    // fire: in an occupied office/flat (floor drawn) – a fire lift from the EG up to that floor = only that room damaged,
    // else every office/flat on f and f + 1; everyone in a room on f goes out. lift: a running car breaks down (wear 100,
    // the usual breakdown way). outage: every car stands outageSec (backup power: backupSec), no wear, no fee, the routing
    // stays. water: offices/flats on f and f − 1 pay no rent today (not damaged); with the leak warning only a message.
    // upg = plant-floor upgrades (panel of a `tech` room, r.upg; one in the tower is enough)
    incidents: { star: 3, salt: 0x1C1DE5, minGap: 5, calm: 7, hours: [8, 20],
      kinds: { fire: 0.010, lift: 0.015, outage: 0.010, water: 0.010 },
      outageSec: 30 * 60, backupSec: 2 * 60,
      // early (TOWER-a0011 P6, E35, ★★★★): the earthquake early warning – the cars stop at the next floor before the quake: no inspection,
      // no wear, no shaft broken; the rooms are hit as before (the cheap step before damper level 2)
      upg: { backup: { cost: 300000, upkeep: 1000, label: 'Notstrom', icon: '🔋' }, leak: { cost: 200000, upkeep: 500, label: 'Leckwarnung', icon: '💧' },
        early: { cost: 800000, upkeep: 2000, label: 'Frühwarnung', icon: '📳', star: 4 } },
      names: { fire: 'Brand', lift: 'Aufzugsausfall', outage: 'Stromausfall', water: 'Wasserschaden' } },
    // weather from ★★★★ (TOWER-a0011 P6, E33/E66/E76): drawn each morning from the own stream (seed ^ salt + day, never this.rand), chance per
    // season (spring, summer, autumn, winter); it only works above the cloud line (f > line). fog: luxury offices/flats up there book their
    // rent today without the height surcharge (E5; only the booking, not potentialRent – forecasts and move-ins stay calm); ice: offices/flats
    // up there without a facade gondola covering them lose iceDrop of their fulfilment tonight (r.wxDrop, not saved, a load replays the day)
    weather: { star: 4, line: 120, salt: 0x3EA7, fog: [0.15, 0.15, 0.30, 0.35], ice: [0, 0, 0.05, 0.30], iceDrop: 0.15,
      // ★★★★★ storm (TOWER-a0011 P8, E49/E76/E81), drawn after fog and ice from the same stream (chance per season): bridges are no floor today
      // (structure change in the morning, open again with the next calm morning), heliport and airship port closed (their users take the
      // street), wind turbines give nothing (P8d), luxury offices/flats above `line` without a damper covering them lose `drop` of their
      // fulfilment tonight (r.wxDrop next to the ice). r.closed marks the closed rooms for the drawing
      storm: { star: 5, p: [0.03, 0.03, 0.08, 0.10], line: 150, drop: 0.10, closes: ['bridge', 'heliport', 'airship'] } },
    // ★★★★★ power (TOWER-a0011 P8, E52/E66): checked only from `star` (T1 … P7 towers stay at powerK 1). Need (MW) = floor per used floor (each
    // tower, basements too) + car[kind] per car + server per server room; have = grid + the `power` of every geothermal plant and wind turbine
    // (0 in a storm or built over). powerK = min(1, max(min, have / need)), set in _startDay and after every change: every car rides × powerK,
    // server rent × powerK. g.off.power = off. grid 50 → 75 (Setzung P8, konzept „Offene Punkte 9“: tuned on the dev tower ★★★★★ frisch – 120 + 60
    // floors, 144 cars need 80.2 MW; with 50 its cars rode at 62 % and 88 % satisfied fell to 50 %, with 75 they ride at 94 % and 82 % are satisfied – short, not stuck)
    power: { star: 5, grid: 75, floor: 0.15, car: { normal: 0.3, express: 0.5, double: 0.6, twin: 0.3, fire: 0.2, service: 0.3, multi: 0.8, maglev: 5 }, server: 2, min: 0.5 },
  };

  // ---------- small helpers ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(e) {
      const a = this.a; a.push(e);
      let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p].t <= a[i].t) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < a.length && a[l].t < a[m].t) m = l;
          if (r < a.length && a[r].t < a[m].t) m = r;
          if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
        }
      }
      return top;
    }
  }

  const hm = (h, m) => h * 3600 + (m || 0) * 60;
  const NOQ = Object.freeze([]);                     // TWIN (E25): the empty queue of a floor a car does not serve
  const fi = f => f - CFG.MIN_FLOOR;                // floor → index into every per-floor array
  const nFloors = () => CFG.MAX_FLOOR - CFG.MIN_FLOOR + 1;
  const corrMin = d => d / CFG.walkSpeed / 60;     // corridor: felt minutes for d tiles
  const corrEn = d => d * CFG.energy.corridor;     // corridor: energy for d tiles
  function floorName(f) { return f === 0 ? 'EG' : f > 0 ? f + '. OG' : -f + '. UG'; }
  function fmtTime(t) {
    const m = Math.floor(t / 60) % (24 * 60);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  const isTenantRoom = r => r.type === 'office' || r.type === 'condo';
  // tower of a column (E40/E60): 0 = tower A [0, TW) (the gap counts to A), 1 = the twin tower B from CFG.TWIN_X on (P7)
  function towerOf(x) { return x >= CFG.TWIN_X ? 1 : 0; }
  // the columns of x's tower, half-open [lo, hi) (E60)
  function towerSpan(x) { return x >= CFG.TWIN_X ? [CFG.TWIN_X, CFG.W] : [0, CFG.TW]; }
  // a requested column snaps to a tower: the gap belongs to the nearer one
  const towerPick = x => x >= (CFG.TW + CFG.TWIN_X) / 2 ? CFG.TWIN_X : 0;
  // clamp a piece of width w at x into its tower (x in the gap: the nearer tower)
  function clampTower(x, w) { const [lo, hi] = towerSpan(towerPick(x)); return Math.max(lo, Math.min(hi - w, x)); }
  const inGap = x => x >= CFG.TW && x < CFG.TWIN_X;
  // fulfilment of a need for `min` felt minutes to the provider (null = unreachable)
  function needShare(min) {
    const C = CFG.needCurve;
    if (min == null) return 0;
    if (min <= C.t0) return 1;
    if (min >= C.t1) return 0;
    return 1 - Math.pow((min - C.t0) / (C.t1 - C.t0), C.k);
  }
  // how long a visit to a provider type lasts (walk-in customers too)
  function stayAt(type) {
    if (CFG.rooms[type] && CFG.rooms[type].stay) return CFG.rooms[type].stay;   // E29 public rooms
    for (const k in CFG.needs) { const N = CFG.needs[k]; if (N.provider === type && N.stay) return N.stay; }
    return 20 * 60;
  }
  // E17 several providers per need: the main provider (needs.<k>.provider) first, then every room type whose `provides`
  // lists the need (CFG order); typeNeeds = the needs a room type serves. Built once from CFG
  let NEED_TYPES = null, TYPE_NEEDS = null;
  function needTypes(need) {
    if (!NEED_TYPES) {
      NEED_TYPES = {}; TYPE_NEEDS = {};
      for (const k in CFG.needs) NEED_TYPES[k] = [CFG.needs[k].provider];
      for (const t in CFG.rooms) for (const k of CFG.rooms[t].provides || []) if (NEED_TYPES[k] && !NEED_TYPES[k].includes(t)) NEED_TYPES[k].push(t);
      for (const k in NEED_TYPES) for (const t of NEED_TYPES[k]) (TYPE_NEEDS[t] || (TYPE_NEEDS[t] = [])).push(k);
    }
    return NEED_TYPES[need] || [];
  }
  function typeNeeds(type) { needTypes(''); return TYPE_NEEDS[type] || []; }
  // stay of a visit for `need` at room type `type` (E70: the need's stay, else the type's)
  const stayFor = (need, type) => (need && CFG.needs[need] && CFG.needs[need].stay) || stayAt(type);
  // warning level as the player sees it (whole percent): at most warnBelow
  function needWarn(v) { return v != null && Math.round(v * 100) <= Math.round(CFG.warnBelow * 100); }
  // merged rooms (TOWER-a0010 P6, E12/E34): r.merged = how many rooms of the type it is (missing = 1), r.tenantType =
  // key in CFG.tenants (missing = none). People, needs, penalty sensitivity, rent follow from both
  const tenantOf = r => (r && r.tenantType && CFG.tenants[r.tenantType]) || null;
  function capOf(r) {
    const def = CFG.rooms[r.type], T = tenantOf(r);
    return def && def.cap ? Math.round(def.cap * (r.merged || 1) * ((T && T.people) || 1)) : 0;
  }
  // needs of room r on a tier (default its own): a tenant type may bring its own list (needs), stay on a lower tier's
  // list (tier) or add needs (addNeeds)
  function needsOf(r, tier) {
    const T = tenantOf(r), t = T && T.tier != null ? T.tier : tier ?? r.tier ?? 0;
    const list = (T && T.needs) || (CFG.tiers[t] && CFG.tiers[t].needs[r.type]) || [];
    return T && T.addNeeds ? list.concat(T.addNeeds) : list;
  }
  function penaltySens(r, tier) {
    const T = tenantOf(r);
    if (T && T.sens != null) return T.sens;
    const TT = CFG.tiers[T && T.tier != null ? T.tier : tier ?? r.tier ?? 0];
    return (TT && TT.sens[r.type]) || 0;
  }
  // raw penalty of a source {type, f, x, w} on room r (before the room's sensitivity)
  function penaltyRaw(type, f, x, w, r) {
    const N = CFG.noise[type]; if (!N) return 0;
    if (type !== 'bridge' && towerOf(x) !== towerOf(r.x)) return 0;   // E60: noise does not cross the gap (the bridge stands in it)
    const gap = Math.max(0, r.x - (x + w), x - (r.x + r.w));
    const df = r.h === 2 ? (f < r.f ? r.f - f : f > r.f + 1 ? f - r.f - 1 : 0) : Math.abs(r.f - f);   // E37: the nearer of its two floors
    const d = Math.max(df, gap / 6);
    return d < N.r ? N.s * (1 - d / N.r) : 0;
  }

  // ---------- game ----------
  class Game {
    constructor(saved) {
      const s = saved || {};
      this.money = s.money ?? CFG.startMoney;
      this.day = s.day ?? 1;
      // stars count from 0 since 30.10.2026 (starsFrom: 0 in the save); older saves and plain objects
      // (sim_check) count from 1 and step down by one – same level, one star less shown
      this.stars = s.starsFrom === 0 ? s.stars : Math.max(0, (s.stars ?? 1) - 1);
      this.seed = s.seed ?? ((Math.random() * 1e9) | 0);
      this.nextId = s.nextId ?? 1;
      this.sat = s.sat ?? 1;
      this.won = s.won ?? false;
      // P2: day each star was reached (index = star number, null = unknown), milestones {key: day} (0 = already
      // true when an older save was loaded), diary [{day, text, kind}], calm days in a row (E17: all optional)
      this.starDays = Array.isArray(s.starDays) ? s.starDays.slice() : [];
      this.diary = Array.isArray(s.diary) ? s.diary.slice(-CFG.diaryMax) : [];
      this.calmDays = s.calmDays ?? 0;
      this.milestones = s.milestones ? { ...s.milestones } : {};
      this.onMilestone = null;    // (key) hook, next to the engine event 'milestone'
      // E10 looks { facade, cabin, windows } (optional in the save, default = the first of each list; an unknown key too)
      this.look = {};
      for (const k of Object.keys(CFG.looks)) this.look[k] = CFG.looks[k].some(e => e.key === (s.look || {})[k]) ? s.look[k] : CFG.looks[k][0].key;
      // P5 earthquakes (E14/E33, all optional in the save): last = day of the last one, n = how many so far,
      // from = start of the calm period for ★★★ saves without starDays[3] (the day they were first loaded)
      const qs = s.quake || {};
      this.quakes = { last: qs.last ?? null, n: qs.n || 0, from: qs.from ?? null };
      if (this.stars >= CFG.quake.star && this.starDays[CFG.quake.star] == null && this.quakes.from == null) this.quakes.from = this.day;
      this.quakeToday = null;     // { level 1..3, t } after today's quake (drawing: shake), null otherwise
      this.onQuake = null;        // (level) hook, next to the engine event 'quake' { level }
      // P3 incidents (E19/E68, optional in the save): last = day of the last one, n = how many so far; incidentToday
      // { kind, f, t } after today's (drawing, panel); outageUntil = game time until which every car stands (E72, live)
      const is = s.incidents || {};
      this.incidents = { last: is.last ?? null, n: is.n || 0 };
      this.incidentToday = null; this.outageUntil = 0;
      this.onIncident = null;     // (kind, f) hook, next to the engine event 'incident' { kind, f } (E81)
      // P6 weather (E33/E81): today's weather above the cloud line (follows from the day, not saved); onWeather(kind) hook next to the
      // engine event 'weather' { kind: fog | ice | storm }
      this.weatherToday = { fog: false, ice: false, storm: false };
      this.onWeather = null;
      this.powerK = 1; this._power = { need: 0, have: 0 }; this._powerMsg = 0;   // P8 (E52): derived, not saved
      // P9 goal (E55/E68, optional in the save): platform = a space station has its platform (derived from the rooms), streak = evenings in a
      // row with sat ≥ CFG.goal.sat since then, done = the day the streak was full, launched = the day the first cabin started (null before);
      // launchT = game time of the launch for the drawing (day × 86400 + CFG.goal.launchAt – a new value starts the animation, E81),
      // onLaunch() hook next to the engine event 'launch'
      const gl = s.goal || {};
      this.goal = { platform: false, streak: gl.streak || 0, done: gl.done ?? null, launched: gl.launched ?? null };
      this.launchT = this.goal.launched != null ? this.goal.launched * 86400 + CFG.goal.launchAt : null;
      this.onLaunch = null;
      // test switches (TOWER-a0011 E66, not saved): { quake, incidents, weather, power, delivery, cleaning (P4) } – true = that system is off
      this.off = { ...(s.off || {}) };   // a test may pass them in (sim_check), so day 1 is planned with them
      this.loan = s.loan ?? 0;
      this.negDays = s.negDays ?? 0;
      this.serviceAt = Math.max(CFG.serviceMin, Math.min(CFG.serviceMax, s.serviceAt ?? CFG.serviceAt));
      this.floorNet = null;       // net per floor yesterday (rent + sales − upkeep − repairs), null before the first evening
      this.fcGen = 0;             // forecasts (P2) are cached per room until this changes (structure, evening)
      this.rand = mulberry32(this.seed + this.day * 7919);
      this.rooms = (s.rooms || []).map(r => this._makeRoom(r));
      this.shafts = (s.shafts || []).map(sh => this._makeShaft(sh));
      this.links = (s.links || []).map(l => this._makeLink(l));
      this.shellRows = [];
      for (let f = CFG.MIN_FLOOR; f <= CFG.MAX_FLOOR; f++) this.shellRows.push(new Uint8Array(CFG.W));
      for (const r of s.shells || []) for (let x = r.x; x < r.x + r.w; x++) this.shellRows[fi(r.f)][x] = 1;
      this.msgs = [];
      this.onMessage = null;
      this.onEvent = null;        // (type, data) for sound: door, movein, moveout, star, day
      this.t = CFG.DAY_START;
      this.persons = new Set();
      this.walking = new Set();
      this.climbing = new Set();
      this.events = new Heap();
      this.today = this._newToday();
      // tenants are not saved: occupied rooms get their people back on load
      for (const r of this.rooms) if (r.occupied && (r.type === 'office' || r.type === 'condo')) {
        for (let i = 0; i < capOf(r); i++) this._newPerson(r.type === 'office' ? 'worker' : 'resident', r);
      }
      for (const r of this.rooms) if (r.type === 'workshop') this._hire(r);
      this.roomJobs = this.rooms.filter(r => r.repairPaid);   // P3 (E20): open room repair orders, in order
      this.goal.platform = this._hasPlatform();   // P9 (E55)
      for (const r of this.rooms) if (r.type === 'hotel') for (const g of r.guests) this._newGuest(r, g);   // hotel guests like tenants
      this._structureChanged();
      // saves from before the shell floor walked over gaps: close them, so the tower works as before
      if (saved && !s.shells) this.closeAllGaps();
      // saves without milestones: what is already true is set silently (no flood of messages, K11)
      if (saved && !s.milestones) for (const m of CFG.milestones) if (this._milestoneTrue(m.key)) this.milestones[m.key] = 0;
      this._startDay();
    }

    // ----- persistence -----
    // a load always restarts the day at 06:00 (people are not saved): mid-day saves (rewind) take back
    // today's sales and repairs, so the replayed day books them once; building costs stay paid
    serialize(rewind) {
      // P3 fix (qa-P3 F1): a room repair paid today and already done stays paid (the room is saved whole)
      const money = rewind ? this.money - this.today.sales + this.today.repairs - (this.today.repairsDone || 0) : this.money;
      return {
        v: 1, money, day: this.day, stars: this.stars, starsFrom: 0, seed: this.seed,
        nextId: this.nextId, sat: this.sat, won: this.won,
        loan: this.loan, negDays: this.negDays, serviceAt: this.serviceAt,
        starDays: Array.from({ length: this.stars + 1 }, (_, i) => this.starDays[i] ?? null),
        look: Object.keys(CFG.looks).some(k => this.look[k] !== CFG.looks[k][0].key) ? { ...this.look } : undefined,
        milestones: { ...this.milestones }, diary: this.diary.map(d => ({ ...d })), calmDays: this.calmDays,
        quake: this.quakes.n || this.quakes.from != null ? { ...this.quakes } : undefined,
        incidents: this.incidents.n ? { ...this.incidents } : undefined,
        // P9 (E55/E68): the goal only once something happened (older saves stay as they were)
        goal: this.goal.platform || this.goal.streak || this.goal.done != null ? { platform: this.goal.platform, streak: this.goal.streak, done: this.goal.done, launched: this.goal.launched } : undefined,
        rooms: this.rooms.map(r => ({ id: r.id, type: r.type, f: r.f, x: r.x, occupied: r.occupied, score: r.score, tenancy: r.tenancy,
          tier: r.tier, fulfil: r.fulfil, warnDays: r.warnDays, warnCause: r.warnDays ? r.warnCause || undefined : undefined, needOut: r.needOut || undefined, lastQ: r.lastQ ? Math.round(r.lastQ * 100) / 100 : undefined, lastGU: r.lastGU ? Math.round(r.lastGU * 1000) / 1000 : undefined,
          meas: Object.keys(r.meas).length ? Object.fromEntries(Object.entries(r.meas).map(([k, m]) => [k, [Math.round(m.v * 1000) / 1000, m.min == null ? null : Math.round(m.min * 10) / 10]])) : undefined,
          ...(r.type === 'hotel' ? { guests: r.guestsNight.map(g => ({ nights: g.nights, key: g.key })), lastOcc: r.lastOcc ?? undefined } : {}),
          ...(CFG.rooms[r.type].spaces && r.lastUsers ? { lastUsers: r.lastUsers } : {}),   // E27/E68: every entry room
          // P5: damaged (a repair under way counts as done – it is paid; a rewind takes the payment back), shaken days, damper level
          damaged: r.damaged ? true : undefined, shaken: r.shaken || undefined,
          // P3 (E20/E68): a paid repair order – only from an earlier day (a mid-day save takes today's payment back)
          ...(r.damaged && r.repairPaid && r.paidDay < this.day ? { repairPaid: true, paidDay: r.paidDay, emerg: r.emerg || undefined } : {}),
          ...(r.type === 'damper' ? { damperLevel: r.damperLevel } : {}),
          upg: r.upg && Object.values(r.upg).some(Boolean) ? { ...r.upg } : undefined,
          platform: r.platform || undefined,   // P9 (E55/E68): the space station's platform
          ...(r.merged > 1 ? { merged: r.merged, tenantType: r.tenantType || null, h: r.h || undefined, whole: r.whole || undefined } : {}) })),   // E39/E68: h of a block of four, E53 whole floor
        shafts: this.shafts.map(s => ({ id: s.id, kind: s.kind, c: s.c, f0: s.f0, f1: s.f1, stops: s.stops.slice(), nCars: s.cars.length, name: s.name,
          wears: s.cars.map(c => Math.round(c.wear * 100) / 100), lastWait: s.lastWait == null ? undefined : Math.round(s.lastWait * 100) / 100, dd: s.dd || undefined,
          priv: s.priv ?? undefined, split: s.twin ? s.split : undefined })),
        links: this.links.map(l => ({ id: l.id, kind: l.kind, f: l.f, x: l.x })),
        shells: this.shells.map(r => ({ f: r.f, x: r.x, w: r.w })),
      };
    }

    _makeLink(l) { return { id: l.id, kind: l.kind, f: l.f, x: l.x, w: CFG.links[l.kind].w, used: 0, isLink: true }; }

    _makeRoom(r) {
      const tenant = r.type === 'office' || r.type === 'condo';
      return {
        // E37/E67: a block of four (merged 4, h 2) stands on f and f + 1 – w = def.w × merged / h
        id: r.id, type: r.type, f: r.f, x: r.x, w: CFG.rooms[r.type].w * (tenant && r.merged > 1 ? r.merged : 1) / (tenant && r.merged === 4 && r.h === 2 ? 2 : 1),
        ...(tenant && r.merged === 4 && r.h === 2 ? { h: 2 } : {}),
        // P6: merged = rooms of the type joined into this one (2–3, missing = 1), tenantType = key in CFG.tenants
        ...(tenant && r.merged > 1 ? { merged: r.merged, tenantType: r.tenantType && CFG.tenants[r.tenantType] ? r.tenantType : null } : {}),
        ...(tenant && r.merged > 1 && r.whole ? { whole: true } : {}),   // P8 (E51/E53): a whole floor
        occupied: !!r.occupied || !!CFG.rooms[r.type].noPeople, score: r.score ?? null, tenancy: r.tenancy || 0,   // E36: tenants without people are always let
        // tier 0 standard, 1 upscale, 2 luxury; fulfil 0..1 (rent factor; P1: always 1 for offices
        // and flats, needs come with P2), warnDays: days in a row below the threshold (trips or needs;
        // saves from before TOWER-a0007 kept bad trip days apart in badNights), warn: sign 0/1 yellow/2 red
        tier: CFG.rooms[r.type].tier ?? (r.tier || 0), fulfil: r.fulfil ?? (tenant ? 1 : null), warnDays: Math.max(r.warnDays || 0, r.badNights || 0), warn: 0,
        // why the warning came ('trip' | 'needs'): an office keeps its warning through a good half day (TOWER-a0009)
        // while warnWhy is null again – the panel text and the kind of move-out follow this
        warnCause: r.warnCause || null,
        tripSum: 0, tripN: 0, inside: 0, people: [], eSum: 0, eN: 0, eLast: null, failN: 0,
        // P2: measured needs {need: {v 0..1, min}} (yesterday or older, saved), today's samples nd, queue at
        // a provider, penalty (pen after sensitivity, penRaw before), needOut = moved out for needs, waits
        // for a structure change before new tenants come; fc = cached forecasts per tier
        meas: Object.fromEntries(Object.entries(r.meas || {}).map(([k, a]) => [k, { v: a[0], min: a[1] }])),
        nd: {}, queue: [], pen: 0, penRaw: 0, penSrc: null, needOut: !!r.needOut, fc: null, fcGen: -1, vN: 0,
        // provider: yesterday's Ø minutes in its queue (of those who got a seat) and share who gave up (forecast)
        lastQ: r.lastQ || 0, lastGU: r.lastGU || 0, qSum: 0, qN: 0, guN: 0,
        // P3 rooftop: roofed = something built above it (set in _structureChanged)
        roofed: false,
        // P5 quake: damaged = rent 0 and no new tenants until repaired (repairEnd = repair under way, live), shaken =
        // evenings left with fulfilment −CFG.quake.satDrop; damperLevel 1..3 of a damper
        damaged: !!r.damaged, repairEnd: 0, shaken: r.shaken || 0,
        // P3 (E20): repair order paid (repairPaid, paidDay; emerg = paid with the emergency service), mech = who comes / works
        repairPaid: !!(r.damaged && r.repairPaid), paidDay: r.paidDay ?? 0, emerg: !!(r.damaged && r.repairPaid && r.emerg), mech: null, jobBlock: 0,
        ...(r.type === 'damper' ? { damperLevel: Math.max(1, Math.min(CFG.rooms.damper.levels.length, r.damperLevel || 1)) } : {}),
        ...(r.type === 'spacestation' && r.platform ? { platform: true } : {}),   // P9 (E55/E68)
        // P3 plant-floor upgrades (E19, saved optional): { backup, leak } – known keys only
        ...(r.type === 'tech' ? { upg: Object.fromEntries(Object.keys(CFG.incidents.upg).map(k => [k, !!(r.upg && r.upg[k])])) } : {}),
        wetDay: 0,   // P3 water damage: no rent on this day (live, a load replays the day)
        wxDrop: 0,   // P6 weather (E76): share of the fulfilment lost tonight (ice above the cloud line; live, not saved)
        // P4 garage (E27/E68: every entry room with spaces): parked = cars standing in it now, users = people who used it today,
        // lastUsers = yesterday (saved), assigned = tenants it is meant for (set in _assignEntries)
        ...(CFG.rooms[r.type].spaces ? { parked: 0, users: 0, lastUsers: r.lastUsers || 0, assigned: 0 } : {}),
        // P2 lockers (E15): parcels booked for today (planning) and delivered (live, a load restarts the day)
        ...(r.type === 'lockers' ? { booked: 0, parcels: 0 } : {}),
        // P3 hotel: guests = checked-in guests [{nights left, key}] (live), guestsNight = the same after last night
        // (saved: a load restarts the day at 06:00), lastOcc = occupancy last night 0..1, req = requests today
        ...(r.type === 'hotel' ? { guests: (r.guests || []).map(g => ({ nights: g.nights, key: g.key })), guestsNight: (r.guests || []).map(g => ({ nights: g.nights, key: g.key })),
          lastOcc: r.lastOcc ?? null, req: 0, checkins: 0 } : {}),
      };
    }

    _makeShaft(s) {
      const span = s.f1 - s.f0 + 1;
      const sh = {
        id: s.id, kind: s.kind, c: s.c, f0: s.f0, f1: s.f1,
        stops: s.stops ? s.stops.slice() : new Array(span).fill(true),
        name: s.name || this._shaftName(s.kind),
        cars: [], qUp: [], qDown: [], waitSum: 0, waitN: 0, lastWait: s.lastWait ?? null,
        dbl: !!CFG.shafts[s.kind].decks,   // double deck (E13): live flag, not saved
        dd: !!s.dd && CFG.dispatch.kinds.includes(s.kind),   // destination dispatch (E12/E16, saved)
        // private stop (E21/E68, saved): the floor an express also stops on (null = none)
        priv: s.priv != null && CFG.shafts[s.kind].lobbyOnly && s.priv >= s.f0 && s.priv <= s.f1 ? s.priv : null,
        twin: !!CFG.shafts[s.kind].twin,   // TWIN (E25): live flag; split saved
        ...(CFG.shafts[s.kind].twin ? { split: s.split ?? null } : {}),
      };
      for (let i = 0; i < span; i++) { sh.qUp.push([]); sh.qDown.push([]); }
      const n = CFG.shafts[s.kind].cars || s.nCars || 1;
      for (let i = 0; i < n; i++) sh.cars.push(this._makeCar(sh, s.wears ? s.wears[i] : 0));
      this._twinSet(sh);
      sh.running = sh.cars.filter(c => !c.halt).length;
      return sh;
    }

    // wear 0..100; cond ok | slow | waiting (mechanic on the way) | repair | broken (100, nobody coming);
    // halt = out of service (broken, or parked for/under repair): takes nobody new, brings its riders
    // to their floor, then goes to the shaft's service floor. job = maintenance order open,
    // mech = the mechanic (or emergency service) coming, fix = null | 'park' | 'repair'
    _makeCar(s, wear) {
      const car = { y: s.f0, dir: 0, state: 'idle', timer: 0, pax: [], target: null,
        wear: Math.max(0, Math.min(100, wear || 0)), cond: 'ok', halt: false, job: false, mech: null, fix: null, repairEnd: 0, jobBlock: 0, emerg: false };
      this._setCond(car);
      return car;
    }

    // TWIN (E25): split inside the shaft (default the middle), each car's floors (car.lo/car.hi) and its place within them
    _twinSet(s) {
      if (!s.twin) return;
      s.split = Math.max(s.f0 + 1, Math.min(s.f1 - 1, s.split ?? s.f0 + Math.floor((s.f1 - s.f0) / 2)));
      s.cars.forEach((car, i) => {
        car.lo = i === 0 ? s.f0 : s.split; car.hi = i === 0 ? s.split : s.f1;
        if (car.y < car.lo || car.y > car.hi) { car.y = Math.max(car.lo, Math.min(car.hi, car.y)); if (car.state === 'moving') { car.state = 'idle'; car.dir = 0; car.target = null; } }
      });
    }

    _setCond(car) {
      car.halt = car.wear >= 100 || car.fix != null;
      car.cond = car.fix === 'repair' ? 'repair' : car.fix === 'inspect' ? 'inspect' : car.mech ? 'waiting' : car.wear >= 100 ? 'broken' : car.wear >= CFG.wear.slowAt ? 'slow' : 'ok';
    }

    // after a car changed: condition, running cars; a shaft without running cars leaves the
    // routing graph (rebuilt only when the count crosses 0)
    _refresh(s, car) {
      if (car) this._setCond(car);
      const n = s.cars.reduce((a, c) => a + (c.halt ? 0 : 1), 0);
      const cross = (n > 0) !== (s.running > 0);
      s.running = n;
      if (cross && this.shafts.includes(s)) this._afterChange(true);
    }

    inService(car) { return !car.halt; }

    _shaftName(kind) {
      if (kind === 'fire') { const used = new Set(this.shafts.map(s => s.name)); for (let i = 1; ; i++) if (!used.has('F' + i)) return 'F' + i; }
      const used = new Set(this.shafts ? this.shafts.map(s => s.name) : []);
      for (let i = 0; i < 26; i++) { const n = String.fromCharCode(65 + i); if (!used.has(n)) return n; }
      return 'Z' + this.nextId;
    }

    msg(text, kind) {
      const m = { text, kind: kind || 'info', day: this.day, t: this.t };
      this.msgs.push(m);
      if (this.msgs.length > 60) this.msgs.shift();
      if (this.onMessage) this.onMessage(m);
    }

    _emit(type, data) { if (this.onEvent) this.onEvent(type, data); }

    // ----- diary and milestones (TOWER-a0010 P2) -----
    // diary entry {day, text, kind}: kind 'milestone' | 'star' | 'moveout' | 'breakdown' | 'quake' (P5) | 'merge' (P6); the oldest fall out
    _diary(kind, text) {
      this.diary.push({ day: this.day, text, kind });
      if (this.diary.length > CFG.diaryMax) this.diary.splice(0, this.diary.length - CFG.diaryMax);
    }

    // is the milestone true in the current state? (calmWeek and merge are events, not a state: false)
    _milestoneTrue(key) {
      switch (key) {
        case 'pop50': return this.population >= 50;
        case 'pop200': return this.population >= 200;
        case 'pop500': return this.population >= 500;
        case 'pop1000': return this.population >= 1000;
        case 'pop2000': return this.population >= 2000;
        case 'upgrade': return this.rooms.some(r => isTenantRoom(r) && r.tier >= 1);
        case 'basement': return this.rooms.some(r => r.f < 0) || this.shells.some(r => r.f < 0);
        case 'luxury': return this.luxuryRooms() >= 1;
        default: return false;
      }
    }

    // fires the milestone once per game: message (no reward), diary entry, hook + engine event 'milestone'.
    // P3/P6 call it directly for what only they know ('merge'); returns true if it fired now
    _milestone(key) {
      const m = CFG.milestones.find(x => x.key === key);
      if (!m || this.milestones[key] != null) return false;
      this.milestones[key] = this.day;
      const news = this.lookNews(key);
      this.msg('🎯 Meilenstein: ' + m.text + (news.length ? ' – neu unter 🎨 Aussehen: ' + news.join(', ') : ''), 'good');
      this._diary('milestone', m.text);
      if (this.onMilestone) this.onMilestone(key);
      this._emit('milestone', { key });
      return true;
    }

    // ----- looks (TOWER-a0011 P1, E10) -----
    // unlocked: no `from`, or its milestone is set (also 0 = set silently when an older save was loaded)
    lookUnlocked(kind, key) {
      const e = (CFG.looks[kind] || []).find(x => x.key === key);
      return !!e && (!e.from || this.milestones[e.from] != null);
    }
    // choose a look; never called by the engine itself
    setLook(kind, key) {
      if (!this.lookUnlocked(kind, key)) {
        const e = (CFG.looks[kind] || []).find(x => x.key === key), m = e && CFG.milestones.find(x => x.key === e.from);
        return { ok: false, reason: m ? 'Erst ab Meilenstein „' + m.text + '“' : 'Gibt es nicht' };
      }
      this.look[kind] = key;
      return { ok: true };
    }
    // "Fassade Ziegel" for every look the milestone `key` unlocks
    lookNews(key) {
      const out = [];
      for (const k of Object.keys(CFG.looks)) for (const e of CFG.looks[k]) if (e.from === key) out.push(CFG.lookNames[k] + ' ' + e.label);
      return out;
    }

    _checkMilestones() {
      for (const m of CFG.milestones) if (this.milestones[m.key] == null && this._milestoneTrue(m.key)) this._milestone(m.key);
    }

    // ----- derived structure -----
    get maxFloor() { return CFG.stars[Math.min(this.stars, CFG.stars.length - 1)].maxFloor; }
    get minFloor() { return Math.max(CFG.MIN_FLOOR, CFG.stars[Math.min(this.stars, CFG.stars.length - 1)].minFloor ?? 0); }
    get season() { return Math.floor((this.day - 1) / CFG.seasonDays) % 4; }   // 0 spring … 3 winter
    get weekday() { return (this.day - 1) % 7; }                                    // 0 Monday … 6 Sunday
    get weekdayName() { return CFG.week.names[this.weekday]; }
    get dayKind() { return CFG.week.kind[this.weekday]; }                          // 'half' | 'full' | 'weekend'
    isOpen(type) { return this.dayKind !== 'weekend' || !CFG.week.closed.includes(type); }
    // E70: is any provider of `need` open today? The main type as before (built or not), the `provides` types only when built
    _needOpen(need) {
      const main = CFG.needs[need].provider;
      return this.isOpen(main) || needTypes(need).some(t => t !== main && this.isOpen(t) && !!this.providers[t]);
    }

    _structureChanged() {
      const W = CFG.W, F = CFG.MAX_FLOOR, F0 = CFG.MIN_FLOOR, eg = this.stars >= CFG.TWIN_STAR ? W : CFG.TW;
      this.structGen = (this.structGen || 0) + 1;   // E7: drawing caches (block mode) key on this
      this.grid = []; this.sgrid = [];   // rooms and shafts on separate layers: shafts may run through rooms
      for (let f = F0; f <= F; f++) { this.grid.push(new Array(W).fill(null)); this.sgrid.push(new Array(W).fill(null)); }
      for (const r of this.rooms) for (let x = r.x; x < r.x + r.w; x++) { this.grid[fi(r.f)][x] = r; if (r.h === 2) this.grid[fi(r.f + 1)][x] = r; }   // E37: both floors
      for (const s of this.shafts) for (let f = s.f0; f <= s.f1; f++) this.sgrid[fi(f)][s.c] = s;
      // stairs/escalators: own layer on their lower floor
      this.lgrid = [];
      for (let f = F0; f <= F; f++) this.lgrid.push(new Array(W).fill(null));
      for (const l of this.links) for (let x = l.x; x < l.x + l.w; x++) this.lgrid[fi(l.f)][x] = l;
      // E42: lobbies per tower – lobbyKeys holds f × 2 + tower; the EG (and a bridge floor, E43) counts for both towers;
      // lobbyFloors = floors that are a lobby in either tower
      this.lobbyFloors = new Set([0]); this.lobbyKeys = new Set([0, 1]);
      for (const r of this.rooms) if (r.type === 'skylobby' || CFG.rooms[r.type].lobby) {   // E22: district lobby too
        this.lobbyFloors.add(r.f);
        if (CFG.rooms[r.type].bothTowers) { this.lobbyKeys.add(r.f * 2); this.lobbyKeys.add(r.f * 2 + 1); } else this.lobbyKeys.add(r.f * 2 + towerOf(r.x));
      }
      this.checkFloors = new Set();   // E31: secured floors (a checkpoint on them)
      for (const r of this.rooms) if (r.type === 'checkpoint') this.checkFloors.add(r.f);
      this.stationFloors = new Set();   // E47: the maglev stops on a station floor
      for (const r of this.rooms) if (r.type === 'station') this.stationFloors.add(r.f);
      this.privFloors = new Set();   // E21: floors with a private stop
      for (const s of this.shafts) if (s.priv != null) this.privFloors.add(s.priv);
      // shell runs (for drawing, selecting, demolishing): rooms always win over shell
      this.shells = []; this.shgrid = [];
      // E40/E81: game.twin = something stands in tower B (derived, not saved) – the drawing then shows the whole width
      let twin = this.rooms.some(r => r.x >= CFG.TWIN_X) || this.shafts.some(s => s.c >= CFG.TWIN_X) || this.links.some(l => l.x >= CFG.TWIN_X);
      for (let f = F0; f <= F; f++) {
        const row = this.shellRows[fi(f)], g = new Array(W).fill(null), grow = this.grid[fi(f)];
        for (let x = 0; x < W; x++) if (row[x] && grow[x]) row[x] = 0;
        for (let x = 0; x < W;) {
          if (!row[x]) { x++; continue; }
          let e = x; while (e + 1 < W && row[e + 1]) e++;
          const sh = { f, x, w: e - x + 1, isShell: true };
          if (e >= CFG.TWIN_X) twin = true;
          this.shells.push(sh);
          for (let i = x; i <= e; i++) g[i] = sh;
          x = e + 1;
        }
        this.shgrid.push(g);
      }
      this.twin = twin;
      // walkable floor and its connected pieces (segments): the lobby, rooms, shell; a shaft column
      // is a landing if floor touches it. Corridor walks only join points of the same segment.
      this.seg = [];
      for (let f = F0; f <= F; f++) {
        const grow = this.grid[fi(f)], hrow = this.shellRows[fi(f)], srow = this.sgrid[fi(f)];
        // E40/E69: the EG is tower A's lobby; from ★★★★★ on it runs over the whole width (tower B's half and the gap: one lobby)
        const base = x => x >= 0 && x < W && (f === 0 ? x < eg : (!!grow[x] && !(grow[x].closed && grow[x].type === 'bridge')) || !!hrow[x]);   // E49: no bridge in a storm
        const wk = new Array(W);
        for (let x = 0; x < W; x++) wk[x] = base(x) || (!!srow[x] && (base(x - 1) || base(x + 1)));
        const sg = new Int16Array(W).fill(-1);
        let id = -1;
        for (let x = 0; x < W; x++) if (wk[x]) sg[x] = x > 0 && wk[x - 1] ? id : ++id;
        this.seg.push(sg);
      }
      // service floor of each shaft: lowest stop with floor at the door (null = no maintenance possible)
      for (const s of this.shafts) {
        s.svc = null;
        if (s.twin) { if (this.serves(s, s.split) && this.walkable(s.split, s.c)) s.svc = s.split; continue; }   // TWIN: both cars reach only the split
        for (let f = s.f0; f <= s.f1; f++) if (this.serves(s, f) && this.walkable(f, s.c)) { s.svc = f; break; }
      }
      // K8 (P7): the floors a queue can stand on – served ones (only there _enqueue puts people) plus any queue still standing; the
      // queue scans of long lobby-only shafts (express, MULTI) run over this list. null = most floors served: scan all (no gain)
      for (const s of this.shafts) {
        s._sv = null;
        if (s.twin || s.dbl) continue;
        const sv = [];
        for (let f = s.f0; f <= s.f1; f++) if (this.serves(s, f) || this._hasQueue(s, f)) sv.push(f);
        if (sv.length * 2 <= s.f1 - s.f0 + 1) s._sv = sv;
      }
      // P2: providers by type, rooms by floor, penalties
      // E17: needProv[need] = every provider room of the need (main type and `provides`), in room order
      this.providers = {}; this.needProv = {}; this.floorRooms = [];
      for (let f = F0; f <= F; f++) this.floorRooms.push([]);
      for (const r of this.rooms) {
        this.floorRooms[fi(r.f)].push(r);
        if (r.h === 2) this.floorRooms[fi(r.f + 1)].push(r);   // E37/E67: a block of four on both floors
        if (!CFG.rooms[r.type].seats) continue;
        (this.providers[r.type] || (this.providers[r.type] = [])).push(r);
        for (const k of typeNeeds(r.type)) (this.needProv[k] || (this.needProv[k] = [])).push(r);
      }
      for (const r of this.rooms) if (CFG.rooms[r.type].open) r.roofed = CFG.rooms[r.type].skyAll ? this._builtOver(r) : this.builtAbove(r.f, r.x, r.w);
      this._computePenalties();
      this._buildRouteGraph();
      this._retypeVacant();
      this._updatePower();
    }

    // ----- power (TOWER-a0011 P8, E52) -----
    // { need, have } in MW (CFG.power); 0/0 below the star or with g.off.power
    powerInfo() { return this._power; }
    _updatePower() {
      const P = CFG.power;
      if (this.stars < P.star || this.off.power) { this.powerK = 1; this._power = { need: 0, have: 0 }; return; }
      let need = 0, have = P.grid;
      for (let f = CFG.MIN_FLOOR; f <= CFG.MAX_FLOOR; f++) if (f !== 0) for (let t = 0; t < 2; t++) if (this.floorUsed(f, t)) need += P.floor;
      for (const s of this.shafts) need += (P.car[s.kind] || 0) * s.cars.length;
      for (const r of this.rooms) {
        if (r.type === 'server') need += P.server;
        const d = CFG.rooms[r.type];
        if (d.power && !(d.open && (r.roofed || this.weatherToday.storm))) have += d.power;   // wind: nothing when built over or in a storm
      }
      need = Math.round(need * 10) / 10;
      this._power = { need, have };
      this.powerK = need > have ? Math.max(P.min, have / need) : 1;
      if (this.powerK < 1 && this._powerMsg !== this.day && this.rooms.length) {   // once a day
        this._powerMsg = this.day;
        this.msg('⚡ Strom knapp: ' + this.powerText() + ' – 🌋 Geothermie oder 🌬️ Windräder bauen', 'bad');
      }
    }
    // „64 / 50 MW – Aufzüge fahren mit 78 %“ (money panel, message)
    powerText() {
      const P = this._power, f = n => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
      return f(P.need) + ' / ' + f(P.have) + ' MW' + (this.powerK < 1 ? ' – Aufzüge fahren mit ' + Math.round(this.powerK * 100) + ' %' : '');
    }

    // strongest penalty source per sensitive room (only ±2 floors around each source)
    _computePenalties() {
      for (const r of this.rooms) { r.penRaw = 0; r.penSrc = null; }
      for (const src of this.rooms) {
        if (!CFG.noise[src.type]) continue;
        for (let f = Math.max(CFG.MIN_FLOOR, src.f - 2); f <= Math.min(CFG.MAX_FLOOR, src.f + 2); f++) for (const r of this.floorRooms[fi(f)]) {
          if (!isTenantRoom(r) || (r.h === 2 && f === r.f + 1 && r.f >= src.f - 2)) continue;   // E67: a block of four once
          const v = penaltyRaw(src.type, src.f, src.x, src.w, r);
          if (v > r.penRaw) { r.penRaw = v; r.penSrc = src; }
        }
      }
      for (const r of this.rooms) r.pen = Math.min(1, r.penRaw * penaltySens(r));
    }

    // where a mechanic stands at the service floor: next to the door, on the side with floor
    svcX(s, f) { return this.walkable(f, s.c - 1) ? s.c - 0.6 : s.c + 1.6; }

    // floors with a door of shaft s (its running costs and repairs are shared among them)
    _doorFloors(s) {
      const fs = [];
      for (let f = s.f0; f <= s.f1; f++) if (this.serves(s, f) && this.walkable(f, s.c)) fs.push(f);
      if (!fs.length) fs.push(s.f0);
      return fs;
    }

    walkable(f, x) { return f >= CFG.MIN_FLOOR && f <= CFG.MAX_FLOOR && x >= 0 && x < CFG.W && this.seg[fi(f)][x | 0] >= 0; }

    // segment of a position; off the floor: the nearest walkable tile (people caught by a demolition)
    segAt(f, x) {
      const row = this.seg[fi(f)], t = Math.max(0, Math.min(CFG.W - 1, Math.floor(x)));
      if (row[t] >= 0) return row[t];
      for (let d = 1; d < CFG.W; d++) {
        if (t - d >= 0 && row[t - d] >= 0) return row[t - d];
        if (t + d < CFG.W && row[t + d] >= 0) return row[t + d];
      }
      return -1;
    }

    // Routing graph: nodes are access points (elevator door per shaft and floor, both ends of each
    // stair/escalator). Transport edges join nodes; walking along the corridor joins any two nodes
    // on the same floor and is added during the search.
    _buildRouteGraph() {
      const nodes = [], floorNodes = [], edges = [];
      this.hasSvc = false;
      for (let f = CFG.MIN_FLOOR; f <= CFG.MAX_FLOOR; f++) floorNodes.push([]);
      const add = (f, x, o) => { const n = { i: nodes.length, f, x, seg: this.seg[fi(f)][Math.floor(x)], out: [], inn: [], shaft: o.shaft || null, link: o.link || null }; nodes.push(n); floorNodes[fi(f)].push(n); return n; };
      const join = (a, b, ed) => { ed.from = a; ed.to = b; ed.toF = b.f; ed.idx = edges.length; edges.push(ed); a.out.push(ed); b.inn.push(ed); };
      const R = CFG.route, E = CFG.energy;
      for (const s of this.shafts) {
        if (!s.running || CFG.shafts[s.kind].noRiders) continue;   // all cars broken or under repair: shaft is dead; fire lift (E59)
        const doors = [];
        for (let f = s.f0; f <= s.f1; f++) if (this.serves(s, f) && this.walkable(f, s.c)) doors.push(add(f, s.c + 0.5, { shaft: s }));
        const per = R.perFloor[s.kind], svcOnly = !!CFG.shafts[s.kind].svcOnly;
        for (const a of doors) for (const b of doors) {
          if (a === b || (s.dbl && ((a.f - b.f) & 1))) continue;   // double deck: one deck rides between floors of its parity (E63)
          if (s.twin && Math.min(a.f, b.f) < s.split && Math.max(a.f, b.f) > s.split) continue;   // TWIN: within [f0, split] or [split, f1] (E63)
          const ride = Math.abs(b.f - a.f) * per;
          const ed = { mode: 'elev', shaft: s, cost: R.waitGuess + ride, ride, energy: R.waitGuess * E.waitPerMin + ride * E.ridePerMin };
          if (svcOnly) { ed.svcOnly = true; this.hasSvc = true; }   // E24 service lift
          join(a, b, ed);
        }
      }
      for (const l of this.links) {
        const d = CFG.links[l.kind];
        if (!this.walkable(l.f, l.x) || !this.walkable(l.f + 1, l.x + l.w - 1)) continue;   // an end in the air
        const lo = add(l.f, l.x + 0.3, { link: l }), hi = add(l.f + 1, l.x + l.w - 0.3, { link: l });
        join(lo, hi, { mode: 'link', link: l, cost: d.up * d.comfort / 60 + 0.1, energy: d.energyUp });
        join(hi, lo, { mode: 'link', link: l, cost: d.down * d.comfort / 60 + 0.1, energy: d.energyDown });
      }
      this.nodes = nodes; this.floorNodes = floorNodes; this.edges = edges;
      this.routeCache = new Map();
      this.reachCache = new Map();
      this.fcCache = new Map(); this.fcGen++;
      this.svcCache = new Map();   // E24/E64: tables for cleaners and mechanics, filled lazily (only with a service lift)
    }

    // E42: a lobby in x's tower (x undefined: in either tower)
    isLobby(f, x) { return x == null ? this.lobbyFloors.has(f) : this.lobbyKeys.has(f * 2 + towerOf(x)); }

    // may shaft s stop on floor f at all (E62: from its def; the stop switches aside) – index.html asks the same
    stopAllowed(s, f) {
      const d = CFG.shafts[s.kind];
      if (d.stopEvery && f !== 0 && f % d.stopEvery !== 0 && !(this.stationFloors && this.stationFloors.has(f))) return false;   // E47 maglev
      return !d.lobbyOnly || this.isLobby(f, s.c) || f === s.priv;
    }

    serves(s, f) {
      if (f < s.f0 || f > s.f1 || !s.stops[f - s.f0]) return false;
      return this.stopAllowed(s, f);
    }

    // first and last tile with floor (room, shaft, shell) on floor f in x's tower (E60; x undefined = tower A), null = none;
    // the EG: the whole tower (tower B's half only from ★★★★★, E69)
    floorExtent(f, x) {
      const [a, b] = towerSpan(x ?? 0);
      if (f === 0) return a > 0 && this.stars < CFG.TWIN_STAR ? null : [a, b - 1];
      let lo = -1, hi = -1;
      const row = this.grid[fi(f)], srow = this.sgrid[fi(f)], hrow = this.shellRows[fi(f)];
      for (let x = a; x < b; x++) if (row[x] || srow[x] || hrow[x]) { if (lo < 0) lo = x; hi = x; }
      return lo < 0 ? null : [lo, hi];
    }

    // E40/E69: width of the drawn world – tower A alone, the whole width once tower B may be built (★★★★★) or stands
    get worldW() { return this.twin || this.stars >= CFG.TWIN_STAR ? CFG.W : CFG.TW; }
    get W() { return this.worldW; }   // E81: world.W for the drawing
    // why a piece at x … x + w − 1 takes nothing there (null = fine): tower B only from ★★★★★, the gap only a bridge (E60)
    _twinBlock(x, w, type) {
      if (type === 'bridge') return null;
      if (x + (w || 1) > CFG.TW && x < CFG.TWIN_X) return 'Zwischen den Türmen geht nur eine Brücke';
      if (x >= CFG.TWIN_X && this.stars < CFG.TWIN_STAR) return 'Turm B erst mit ' + '★'.repeat(CFG.TWIN_STAR);
      return null;
    }
    // E30/E69: the outer edge – x = 0 (tower A's left), x + w = W (tower B's right); tower A's right only without tower B
    _outerEdge(x, w) { return x === 0 || x + w === CFG.W || (!this.twin && x + w === CFG.TW); }

    // shaft wins: it is drawn on top of the room
    objectAt(f, x) {
      if (f < CFG.MIN_FLOOR || f > CFG.MAX_FLOOR || x < 0 || x >= CFG.W) return null;
      const i = fi(f);
      return this.sgrid[i][x] || this.lgrid[i][x] || this.grid[i][x] || this.shgrid[i][x];
    }

    // ----- routing -----
    // Backward label-setting Dijkstra towards one destination (floor df, position dx), cached per
    // destination until the structure changes. Cost = felt minutes, energy = resource (labels per
    // state are Pareto-optimal in (cost, energy step)). States: node × {A = just arrived, B = about
    // to board} × {came by elevator}. Elevator→elevator only in lobbies; stairs/escalators connect
    // to anything on any floor. Corridor walks (A→B on one floor, A→destination) cost time and energy.
    // fc = forecast (P2): elevators cost yesterday's measured Ø wait of their shaft (at least waitGuess)
    // svc (E24): the table of cleaners and mechanics – service lifts, stairs and escalators only (public lifts skipped); without
    // svc the service lifts are skipped
    _routeTable(df, dx, fc, svc) {
      const key = df * 1000 + Math.round(dx * 2), cache = svc ? this.svcCache : fc ? this.fcCache : this.routeCache;
      let T = cache.get(key);
      if (T) return T;
      const wg = CFG.route.waitGuess;
      const nodes = this.nodes, E = CFG.energy, step = E.step, cap = E.max;
      const S = nodes.length * 4;
      const minLvl = new Array(S).fill(Infinity);
      const ls = [], lt = [], le = [], lg = [];       // settled labels in pop order (state, cost, energy, edge index)
      const pq = new Heap();
      const push = (s, t, en, edge) => {
        if (en > cap || Math.floor(en / step) >= minLvl[s]) return;
        pq.push({ t, s, en, edge });
      };
      const dseg = this.segAt(df, dx);
      for (const m of this.floorNodes[fi(df)]) {
        if (m.seg !== dseg) continue;
        const d = Math.abs(m.x - dx);
        push(m.i * 4, corrMin(d), corrEn(d), null);
        push(m.i * 4 + 1, corrMin(d), corrEn(d), null);
      }
      while (pq.size) {
        const L = pq.pop(), s = L.s, lvl = Math.floor(L.en / step);
        if (lvl >= minLvl[s]) continue;
        minLvl[s] = lvl;
        ls.push(s); lt.push(L.t); le.push(L.en); lg.push(L.edge ? L.edge.idx : -1);
        const n = nodes[s >> 2], e = s & 1;
        if (((s >> 1) & 1) === 0) {
          // A(n, e): reached n by a transport edge (elevator if e = 1, stairs/escalator if e = 0)
          for (const ed of n.inn) {
            const elev = ed.mode === 'elev';
            if (elev !== (e === 1)) continue;
            if (elev && (ed.svcOnly ? !svc : svc)) continue;   // E24: service lifts only for svc, public lifts never for svc
            const pre = ed.from.i * 4 + 2, t = L.t + (fc && elev ? Math.max(wg, ed.shaft.lastWait || 0) + ed.ride : ed.cost), en = L.en + ed.energy;
            push(pre, t, en, ed);
            if (!elev || this.isLobby(ed.from.f, ed.from.x) || (ed.shaft.twin && ed.from.f === ed.shaft.split)) push(pre + 1, t, en, ed);   // TWIN: change at the split (E63)
          }
        } else {
          // B(n, e): walked here along the corridor from any arrival point on this floor
          for (const m of this.floorNodes[fi(n.f)]) {
            if (m.seg !== n.seg) continue;
            const d = Math.abs(m.x - n.x);
            push(m.i * 4 + e, L.t + corrMin(d), L.en + corrEn(d), null);
          }
        }
      }
      // E64: compact table (CSR): labels of state s are off[s] … off[s + 1] − 1, sorted by cost like before
      const N = ls.length, off = new Int32Array(S + 1);
      for (let k = 0; k < N; k++) off[ls[k] + 1]++;
      for (let k = 0; k < S; k++) off[k + 1] += off[k];
      const pos = off.slice(0, S), t = new Float64Array(N), en = new Float64Array(N), edge = new Int32Array(N);
      for (let k = 0; k < N; k++) { const j = pos[ls[k]]++; t[j] = lt[k]; en[j] = le[k]; edge[j] = lg[k]; }
      T = { off, t, en, edge };
      cache.set(key, T);
      return T;
    }

    // Best next move from (f, x) for someone with `energy` left. withQueues adds a penalty for the
    // people already queueing at an elevator door (live, not cached).
    // Returns {mode: 'final'|'elev'|'link', edge, cost, energy} or null (no way that energy allows).
    _plan(f, x, byElev, energy, dest, withQueues, fc, svc) {
      const T = this._routeTable(dest.f, dest.x, fc, svc), e = byElev ? 1 : 0, lim = energy + 1e-9;
      let best = null, bc = Infinity;
      const pseg = this.segAt(f, x);
      if (f === dest.f && pseg === this.segAt(dest.f, dest.x)) {
        const d = Math.abs(x - dest.x);
        if (corrEn(d) <= lim) { bc = corrMin(d); best = { mode: 'final', edge: null, cost: bc, energy: corrEn(d) }; }
      }
      for (const n of this.floorNodes[fi(f)]) {
        if (n.seg !== pseg) continue;
        const st = n.i * 4 + 2 + e, j0 = T.off[st], j1 = T.off[st + 1];
        if (j0 === j1) continue;
        const d = Math.abs(x - n.x), ce = corrEn(d), cm = corrMin(d);
        for (let j = j0; j < j1; j++) {             // sorted by cost; first affordable one is best
          if (ce + T.en[j] > lim) continue;
          const edge = this.edges[T.edge[j]];
          let c = cm + T.t[j];
          if (withQueues && n.shaft) {
            const s = n.shaft, i = f - s.f0, q = edge.toF > f ? s.qUp[i] : s.qDown[i];
            c += q.length * CFG.route.queuePenalty / Math.max(1, s.running);
          }
          if (c < bc) { bc = c; best = { mode: edge.mode, edge, cost: c, energy: ce + T.en[j] }; }
          break;
        }
      }
      return best;
    }

    // routing for a role (E24): cleaners and mechanics (svc) prefer the service lifts – a way over service lifts, stairs and
    // escalators if there is one, else the public way
    _planRole(f, x, byElev, energy, dest, withQueues, svc) {
      if (svc && this.hasSvc) { const pl = this._plan(f, x, byElev, energy, dest, withQueues, false, true); if (pl) return pl; }
      return this._plan(f, x, byElev, energy, dest, withQueues);
    }

    // E41: the street entrance of x's tower (tower B: CFG.TWIN_X + ENTRANCE_X); x undefined = tower A
    _streetX(x) { return x != null && x >= CFG.TWIN_X ? CFG.TWIN_X + CFG.ENTRANCE_X : CFG.ENTRANCE_X; }
    // where p goes out to: the street of the tower it is in now (its room, else where it stands)
    _street(p) { return { f: 0, x: this._streetX(p.where ? p.where.x : p.x), room: null }; }

    // can a fresh person (reference energy) get from the street entrance to this room?
    roomReachable(r) {
      let v = this.reachCache.get(r.id);
      if (v === undefined) {
        v = !!this._plan(0, this._streetX(r.x), false, CFG.energy.ref, { f: r.f, x: r.x + r.w / 2 }, false);   // E41: from the street of its tower
        this.reachCache.set(r.id, v);
      }
      return v;
    }

    // floor a → floor b (entrance resp. floor middle), reference energy
    reachable(a, b) {
      if (a === b) return true;
      return !!this._plan(a, a === 0 ? CFG.ENTRANCE_X : CFG.TW / 2, false, CFG.energy.ref, { f: b, x: CFG.TW / 2 }, false);   // E69: tower A's middle
    }

    // ----- building -----
    // below the depth the stars allow (or the reserve of the arrays): the reason, else null
    _depthBlock(f) { return f < this.minFloor ? 'Tiefer geht es erst mit mehr Sternen' : null; }

    // plant floors (P5, E13/E32): above a floor of CFG.techFloors one builds (rooms, shell, shaft ends, stairs) only
    // once a plant floor stands on it; what already stands keeps standing (old saves). The reason, else null
    // E42: per tower – x's tower needs its own plant floor (x undefined = tower A)
    _techBlock(f, x) {
      const t = towerOf(x ?? 0);
      for (const L of CFG.techFloors) if (f > L && !this.floorRooms[fi(L)].some(r => r.type === 'tech' && towerOf(r.x) === t)) return 'Erst eine Technikebene im ' + floorName(L) + (t ? ' von Turm B' : '');
      return null;
    }

    // fire lift (E14/E59, checked after _techBlock): above CFG.fireLift.from one builds only if a fire lift from the EG
    // (f0 ≤ 0) reaches at least f − gap; what already stands keeps standing (old ★★★ saves). The reason, else null
    _fireBlock(f, x) {
      const F = CFG.fireLift;
      if (f <= F.from) return null;
      const need = f - F.gap, t = towerOf(x ?? 0);   // E42: a fire lift in x's tower
      let top = null;
      for (const s of this.shafts) if (s.kind === 'fire' && s.f0 <= 0 && towerOf(s.c) === t) { if (s.f1 >= need) return null; top = Math.max(top ?? -Infinity, s.f1); }
      return top == null ? 'Erst einen Feuerwehraufzug ab dem EG bis zum ' + floorName(need) + ' bauen'
        : 'Erst den Feuerwehraufzug bis zum ' + floorName(need) + ' verlängern';
    }

    // "Sky-Lobby nur im 15., 30. oder 45. OG" – the floors from CFG.SKY_EVERY up to the height of the stars
    skyHint() {
      const fs = [];
      for (let f = CFG.SKY_EVERY; f <= Math.max(CFG.SKY_EVERY, this.maxFloor); f += CFG.SKY_EVERY) fs.push(f + '.');
      return 'Sky-Lobby nur im ' + (fs.length > 1 ? fs.slice(0, -1).join(', ') + ' oder ' + fs[fs.length - 1] : fs[0]) + ' OG';
    }

    // "Stadtviertel-Lobby nur im 50., 100., 150. oder 200. OG" (E22/E78): every floor def.every apart up to CFG.MAX_FLOOR
    everyHint(type) {
      const def = CFG.rooms[type], fs = [];
      for (let f = def.every; f <= CFG.MAX_FLOOR; f += def.every) fs.push(f + '.');
      return def.label + ' nur im ' + (fs.length > 1 ? fs.slice(0, -1).join(', ') + ' oder ' + fs[fs.length - 1] : fs[0]) + ' OG';
    }

    // what carries floor f: above ground the floor below; in the basement the floor above (dug from the
    // top, E20 – the lobby is always full, so the 1. UG is free, the 2. UG only under a built 1. UG)
    _baseExtent(f, x) { return this.floorExtent(f < 0 ? f + 1 : f - 1, x); }

    // room types allowed below 0 at the current star (whitelist `basement`, E23)
    basementTypes() { return Object.keys(CFG.rooms).filter(k => CFG.rooms[k].basement && (CFG.rooms[k].star || 0) <= this.stars); }
    basementHint() { return 'Kein Tageslicht – hier geht nur ' + this.basementTypes().map(k => CFG.rooms[k].label).join(', '); }

    // floor (room or shell) on floor f + 1 above tiles x..x+w-1: the rooftop bar wants the open sky (P3)
    builtAbove(f, x, w) {
      if (f >= CFG.MAX_FLOOR) return false;
      const row = this.grid[fi(f + 1)], hrow = this.shellRows[fi(f + 1)];
      for (let i = x; i < x + w; i++) if (row[i] || hrow[i]) return true;
      return false;
    }

    // E73 antenna: floor (room or shell) on any floor above r in its columns
    _builtOver(r) {
      for (let f = r.f + 1; f <= CFG.MAX_FLOOR; f++) if (this.builtAbove(f - 1, r.x, r.w)) return true;
      return false;
    }

    checkRoom(type, f, x) {
      const def = CFG.rooms[type];
      if (!def) return { ok: false, reason: 'Unbekannt' };
      x = type === 'bridge' ? CFG.TW : clampTower(x, def.w);   // E60: inside its tower (the gap: the nearer one); the bridge fills the gap
      const res = { ok: false, x, cost: def.cost };
      if ((def.star || 0) > this.stars) { res.reason = 'Erst ab ' + '★'.repeat(def.star); return res; }
      if ((res.reason = this._twinBlock(x, def.w, type))) return res;
      if (f === 0) { res.reason = 'Im EG ist die Lobby'; return res; }
      if (f < 0) {
        res.reason = this._depthBlock(f) || (!def.basement ? this.basementHint() : null);
        if (res.reason) return res;
        res.cost = Math.round(def.cost * CFG.economy.basementRoom);
      } else if (def.basementOnly) { res.reason = def.label + ' nur unter dem Erdgeschoss'; return res; }
      // E30/E69: from fromFloor up, `edge` only at the outer edge of the tower
      if ((def.fromFloor != null && f < def.fromFloor) || (def.edge && !this._outerEdge(x, def.w))) { res.reason = def.label + ' nur ab dem ' + def.fromFloor + '. OG' + (def.edge ? ' an der Außenkante' : ''); return res; }   // E34 gondola: from 120
      if (def.minDepth != null && f > def.minDepth) { res.reason = def.label + ' erst ab dem ' + -def.minDepth + '. UG abwärts'; return res; }   // E28
      if (def.onlyFloor != null && f !== def.onlyFloor) { res.reason = def.label + ' nur im ' + floorName(def.onlyFloor) + (def.bore ? ' – sie bohrt sich selbst hinunter' : ''); return res; }   // E52 geothermal
      if (f > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      if (type !== 'bridge' && (res.reason = this._techBlock(f, x) || this._fireBlock(f, x))) return res;   // E43: the bridge needs floor on both sides instead
      if (type === 'skylobby' && f % CFG.SKY_EVERY !== 0) { res.reason = this.skyHint(); return res; }
      if (def.every && f % def.every !== 0) { res.reason = this.everyHint(type) + (type === 'bridge' ? ' zwischen beiden Türmen' : ''); return res; }   // E22/E78 district lobby, E43 bridge
      if (type === 'bridge') {   // E43: floor (room, shell, a landing) at the last tile of A (TW − 1) and the first of B (TWIN_X) on f
        if (!this.walkable(f, CFG.TW - 1) || !this.walkable(f, CFG.TWIN_X)) { res.reason = 'Brücke braucht Boden in beiden Türmen (' + floorName(f) + ')'; return res; }
        if (this.grid[fi(f)][x]) { res.reason = 'Hier ist schon eine Brücke'; return res; }
        if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
        res.ok = true;
        return res;
      }
      for (let i = x; i < x + def.w; i++) if (this.grid[fi(f)][i]) { res.reason = 'Platz ist belegt'; return res; }
      if (def.open && this.builtAbove(f, x, def.w)) { res.reason = def.label + ' nur unter freiem Himmel – darüber ist schon Boden'; return res; }
      const ext = def.bore ? [0, CFG.W - 1] : this._baseExtent(f, x);   // E52: geothermal bores itself (T1-E20 dig from the top does not apply)
      if (!ext || x < ext[0] || x + def.w - 1 > ext[1]) { res.reason = f < 0 ? 'Darüber fehlt der Keller (von oben graben)' : 'Darunter fehlt das Fundament'; return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildRoom(type, f, x) {
      const c = this.checkRoom(type, f, x);
      if (!c.ok) return c;
      this.money -= c.cost;
      const r = this._makeRoom({ id: this.nextId++, type, f, x: c.x });
      this.rooms.push(r);
      for (let i = r.x; i < r.x + r.w; i++) this.shellRows[fi(f)][i] = 0;
      this._afterChange();
      if (type === 'hotel') this._planHotel(r);   // first guests this evening if there is still time
      if (type === 'workshop') {
        // the new staff comes in from the street right away (or tomorrow morning)
        this._hire(r);
        const M = CFG.mechanics;
        if (this.isOpen('workshop')) r.staff.forEach((p, i) => {
          this._schedule(Math.max(this.t, M.shiftStart) + 60 * (i + 1), p, 'arrive');
          this._schedule(M.shiftEnd, p, 'leave');
        });
      }
      return c;
    }

    // shell floor: fills the whole gap around tile x on floor f (as far as the floor below carries)
    // x2 (optional, PO 30.10.2026 „click and ziehen“): the other end of a dragged piece – it runs from x
    // towards x2 and stops at the first tile that is taken or has no foundation below; without x2 the
    // whole gap around x (sim_check and the dev towers rely on that)
    checkShell(f, x, x2) {
      x = clampTower(x, 1);   // E60: inside its tower
      const tile = f < 0 ? CFG.economy.basementShell : CFG.shell.cost;
      const res = { ok: false, f, x, w: 1, cost: tile };
      if (f === 0) { res.reason = 'Im EG ist die Lobby'; return res; }
      if ((res.reason = this._twinBlock(x, 1))) return res;
      if (f < 0 && (res.reason = this._depthBlock(f))) return res;
      if (f > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      if ((res.reason = this._techBlock(f, x) || this._fireBlock(f, x))) return res;
      const grow = this.grid[fi(f)], hrow = this.shellRows[fi(f)];
      const free = i => !grow[i] && !hrow[i];
      if (!free(x)) { res.reason = 'Hier ist schon Boden'; return res; }
      const ext = this._baseExtent(f, x);
      if (!ext || x < ext[0] || x > ext[1]) { res.reason = f < 0 ? 'Darüber fehlt der Keller (von oben graben)' : 'Darunter fehlt das Fundament'; return res; }
      let a = x, b = x, lo = ext[0], hi = ext[1];
      if (x2 != null) { x2 = Math.max(0, Math.min(CFG.W - 1, x2)); lo = Math.max(lo, Math.min(x, x2)); hi = Math.min(hi, Math.max(x, x2)); }   // ext keeps the piece in x's tower
      while (a - 1 >= lo && free(a - 1)) a--;
      while (b + 1 <= hi && free(b + 1)) b++;
      res.x = a; res.w = b - a + 1; res.cost = res.w * tile;
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildShell(f, x, x2) {
      const c = this.checkShell(f, x, x2);
      if (!c.ok) return c;
      this.money -= c.cost;
      for (let i = c.x; i < c.x + c.w; i++) this.shellRows[fi(f)][i] = 1;
      this._afterChange();
      return c;
    }

    // free shell under every gap inside the old floor extent (rooms + shafts), bottom up – old saves
    // and sim_check towers keep their continuous corridors
    closeAllGaps() {
      for (let f = 1; f <= CFG.MAX_FLOOR; f++) for (const [a, b] of [towerSpan(0), towerSpan(CFG.TWIN_X)]) {   // E60: each tower alone
        let lo = -1, hi = -1;
        const grow = this.grid[fi(f)], srow = this.sgrid[fi(f)], hrow = this.shellRows[fi(f)];
        for (let x = a; x < b; x++) if (grow[x] || srow[x]) { if (lo < 0) lo = x; hi = x; }
        if (lo < 0) continue;
        for (let x = lo; x <= hi; x++) if (!grow[x]) hrow[x] = 1;
      }
      this._afterChange();
    }

    shaftCost(kind, f0, f1) { const d = CFG.shafts[kind]; return d.base + d.perFloor * (f1 - f0) + (d.cars ? (d.cars - 1) * d.car : 0); }   // TWIN: its second car

    checkShaft(kind, c, fa, fb) {
      const def = CFG.shafts[kind];
      const f0 = Math.min(fa, fb), f1 = Math.max(fa, fb);
      const res = { ok: false, f0, f1, c, cost: this.shaftCost(kind, f0, f1) };
      if (c < 0 || c >= CFG.W) { res.reason = 'Außerhalb'; return res; }
      if ((def.star || 0) > this.stars) { res.reason = 'Erst ab ' + '★'.repeat(def.star); return res; }
      if ((res.reason = this._twinBlock(c, 1))) return res;   // E60: no shaft in the gap
      if (f1 === f0) { res.reason = 'Mindestens zwei Etagen'; return res; }
      if (f1 - f0 > def.maxSpan) { res.reason = def.label + ' schafft höchstens ' + def.maxSpan + ' Etagen'; return res; }
      if (def.twin && f1 - f0 < 2) { res.reason = def.label + ' braucht mindestens drei Etagen (je Kabine eine Strecke)'; return res; }
      if (f1 > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      if ((res.reason = this._techBlock(f1, c) || (kind !== 'fire' && this._fireBlock(f1, c)))) return res;
      if ((res.reason = this._depthBlock(f0))) return res;
      for (let f = f0; f <= f1; f++) if (this.sgrid[fi(f)][c]) { res.reason = 'Da steht schon ein Aufzug (' + floorName(f) + ')'; return res; }
      // ways never share a tile (PO 30.10.2026): no shaft through a stair or escalator
      for (let f = f0; f <= f1; f++) if (this.lgrid[fi(f)][c]) { res.reason = 'Da ist schon eine ' + CFG.links[this.lgrid[fi(f)][c].kind].label + ' (' + floorName(f) + ')'; return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildShaft(kind, c, fa, fb) {
      const r = this.checkShaft(kind, c, fa, fb);
      if (!r.ok) return r;
      this.money -= r.cost;
      this.shafts.push(this._makeShaft({ id: this.nextId++, kind, c, f0: r.f0, f1: r.f1, nCars: CFG.shafts[kind].cars || 1 }));
      this._afterChange();
      return r;
    }

    checkLink(kind, f, x) {
      const def = CFG.links[kind];
      x = clampTower(x, def.w);   // E60
      const res = { ok: false, x, f, cost: def.cost };
      if ((res.reason = this._twinBlock(x, def.w))) return res;
      if ((res.reason = this._depthBlock(f))) return res;
      if (f + 1 > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      if ((res.reason = this._techBlock(f + 1, x) || this._fireBlock(f + 1, x))) return res;
      for (let i = x; i < x + def.w; i++) if (this.lgrid[fi(f)][i]) { res.reason = 'Da ist schon eine ' + CFG.links[this.lgrid[fi(f)][i].kind].label; return res; }
      // ways never share a tile (PO 30.10.2026): no stair or escalator on an elevator shaft
      for (let i = x; i < x + def.w; i++) if (this.sgrid[fi(f)][i]) { res.reason = 'Da steht schon ein ' + CFG.shafts[this.sgrid[fi(f)][i].kind].label; return res; }
      // both ends on floor (lobby, room, shell) – the rule the routing uses; no more stairs in the air (PO 30.10.2026)
      if (!this.walkable(f, x) || !this.walkable(f + 1, x + def.w - 1)) { res.reason = def.label + ': unten und oben braucht es Boden'; return res; }
      if (this.money < def.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildLink(kind, f, x) {
      const r = this.checkLink(kind, f, x);
      if (!r.ok) return r;
      this.money -= r.cost;
      this.links.push(this._makeLink({ id: this.nextId++, kind, f, x: r.x }));
      this._afterChange();
      return r;
    }

    // extend an existing shaft by one floor: dir > 0 at the top, dir < 0 at the bottom (costs perFloor)
    checkExtend(s, dir) {
      const def = CFG.shafts[s.kind];
      const f = dir > 0 ? s.f1 + 1 : s.f0 - 1;
      const res = { ok: false, f, cost: def.perFloor };
      if ((res.reason = this._depthBlock(f))) return res;
      if (s.f1 - s.f0 + 1 > def.maxSpan) { res.reason = def.label + ' schafft höchstens ' + def.maxSpan + ' Etagen'; return res; }
      if (f > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      if ((res.reason = this._techBlock(f, s.c) || (s.kind !== 'fire' && this._fireBlock(f, s.c)))) return res;
      const sr = this.sgrid[fi(f)], lr = this.lgrid[fi(f)];
      if (sr && sr[s.c]) { res.reason = 'Da steht schon ein Aufzug (' + floorName(f) + ')'; return res; }
      if (lr && lr[s.c]) { res.reason = 'Da ist schon eine ' + CFG.links[lr[s.c].kind].label + ' (' + floorName(f) + ')'; return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    extendShaft(s, dir) {
      const r = this.checkExtend(s, dir);
      if (!r.ok) return r;
      this.money -= r.cost;
      // queues are indexed by (floor - f0); shifting all arrays together keeps waiting people in their queue
      if (dir > 0) { s.f1 = r.f; s.stops.push(true); s.qUp.push([]); s.qDown.push([]); }
      else { s.f0 = r.f; s.stops.unshift(true); s.qUp.unshift([]); s.qDown.unshift([]); }
      this._twinSet(s);   // TWIN: the split stays, the end car rides further
      this._afterChange();
      return r;
    }

    // € per day of a shaft: its cars and the destination dispatch (E12)
    shaftUpkeep(s) { return CFG.shafts[s.kind].upkeep * s.cars.length + (s.dd ? CFG.dispatch.upkeep : 0) + (s.priv != null ? CFG.priv.upkeep : 0); }

    // private stop (E21): floors of shaft s where one could go – a merged room of at least priv.minMerged rooms, no lobby
    privFloorsFor(s) {
      const out = [];
      if (!CFG.shafts[s.kind].lobbyOnly || CFG.shafts[s.kind].stopEvery) return out;   // E47: not the maglev
      for (let f = s.f0; f <= s.f1; f++) if (!this.isLobby(f, s.c) && this.floorRooms[fi(f)].some(r => (r.merged || 1) >= CFG.priv.minMerged && towerOf(r.x) === towerOf(s.c))) out.push(f);
      return out;
    }
    // set the private stop of s on floor f (paid once), or take it away again (f = its floor; no money back)
    checkPriv(s, f) {
      const P = CFG.priv, res = { ok: false, cost: s.priv === f ? 0 : P.cost, on: s.priv !== f, f };
      if (!CFG.shafts[s.kind].lobbyOnly || CFG.shafts[s.kind].stopEvery) { res.reason = 'Privathalt gibt es nur am Express'; return res; }
      if (this.stars < P.star) { res.reason = 'Privathalt erst ab ' + '★'.repeat(P.star); return res; }
      if (s.priv === f) { res.ok = true; return res; }
      if (s.priv != null) { res.reason = 'Dieser Express hat schon einen Privathalt (' + floorName(s.priv) + ') – erst dort aufheben'; return res; }
      if (f < s.f0 || f > s.f1) { res.reason = 'Liegt nicht am Schacht'; return res; }
      if (this.isLobby(f, s.c)) { res.reason = 'Hier hält der Express ohnehin'; return res; }
      if (!this.floorRooms[fi(f)].some(r => (r.merged || 1) >= P.minMerged)) { res.reason = 'Nur auf einer Etage mit einem zusammengelegten Raum (≥ ' + P.minMerged + ')'; return res; }
      if (!this.walkable(f, s.c)) { res.reason = 'Kein Boden an der Tür im ' + floorName(f); return res; }
      if (this.money < P.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }
    togglePriv(s, f) {
      const c = this.checkPriv(s, f);
      if (!c.ok) return c;
      this.money -= c.cost;
      s.priv = c.on ? f : null;
      if (c.on) s.stops[f - s.f0] = true;
      this._afterChange();
      this.msg(c.on ? '⭐ Privathalt: ' + CFG.shafts[s.kind].label + ' ' + s.name + ' hält jetzt auch im ' + floorName(f) + ' (−' + c.cost.toLocaleString('de-DE') + ' €, ' + CFG.priv.upkeep.toLocaleString('de-DE') + ' €/Tag)'
        : '⭐ Privathalt im ' + floorName(f) + ' aufgehoben', 'info');
      return c;
    }
    // rent factor of a private stop on the room's floor for the tenant types that want one (law firm, penthouse)
    // E31: luxury offices on a secured floor pay more
    checkK(r, tier) { return r.type === 'office' && (tier ?? r.tier ?? 0) >= 2 && this.checkFloors && this.checkFloors.has(r.f) ? CFG.checkpoint.rentK : 1; }
    privK(r) { return r.tenantType && CFG.priv.tenants.includes(r.tenantType) && this.privFloors && this.privFloors.has(r.f) ? CFG.priv.rentK : 1; }

    // destination dispatch (E12): switch on (paid once) or off (no money back)
    checkDispatch(s) {
      const D = CFG.dispatch, res = { ok: false, cost: s.dd ? 0 : D.cost, on: !s.dd };
      if (!D.kinds.includes(s.kind)) { res.reason = 'Zielwahl gibt es nur für Aufzug und Express'; return res; }
      if (D.star > this.stars) { res.reason = 'Zielwahl erst ab ' + '★'.repeat(D.star); return res; }
      if (!s.dd && this.money < D.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }
    toggleDispatch(s) {
      const c = this.checkDispatch(s);
      if (!c.ok) return c;
      this.money -= c.cost;
      s.dd = !s.dd;
      return c;
    }

    // TWIN (E25): move the split one floor up (dir > 0) or down – free, the routing follows
    checkSplit(s, dir) {
      const res = { ok: false, f: s.twin ? s.split + Math.sign(dir) : null };
      if (!s.twin) { res.reason = 'Nur beim TWIN'; return res; }
      if (res.f <= s.f0 || res.f >= s.f1) { res.reason = 'Jede Kabine braucht mindestens eine Etage – weiter geht die Teilung nicht'; return res; }
      res.ok = true;
      return res;
    }
    moveSplit(s, dir) {
      const c = this.checkSplit(s, dir);
      if (!c.ok) return c;
      s.split = c.f;
      this._twinSet(s);
      this._afterChange();
      return c;
    }

    addCar(s) {
      const d = CFG.shafts[s.kind];
      if (d.cars) return { ok: false, reason: d.label + ' hat genau ' + d.cars + ' Kabinen' };
      if (s.cars.length >= d.maxCars) return { ok: false, reason: 'Mehr Kabinen passen nicht' };
      if (this.money < d.car) return { ok: false, reason: 'Zu wenig Geld' };
      this.money -= d.car;
      s.cars.push(this._makeCar(s));
      this._refresh(s, null);
      this._updatePower();   // E52
      this._clearNeedOut();
      return { ok: true };
    }

    removeCar(s) {
      const d = CFG.shafts[s.kind];
      if (d.cars) return { ok: false, reason: d.label + ' hat genau ' + d.cars + ' Kabinen' };
      if (s.cars.length <= 1) return { ok: false, reason: 'Eine Kabine bleibt' };
      // take an empty broken car if there is one, else an empty car
      let i = s.cars.findIndex(c => c.pax.length === 0 && c.halt);
      if (i < 0) i = s.cars.findIndex(c => c.pax.length === 0);
      if (i < 0) i = s.cars.length - 1;
      const car = s.cars.splice(i, 1)[0];
      this._releaseJob(car);
      for (const p of car.pax.slice()) this._dropFromCar(p, s, car);
      this._refresh(s, null);
      this._updatePower();
      this._clearNeedOut();
      return { ok: true };
    }

    toggleStop(s, f) {
      if (f < s.f0 || f > s.f1) return;
      s.stops[f - s.f0] = !s.stops[f - s.f0];
      this._afterChange();
    }

    // would anything float if o were gone?
    _supportOk(o) {
      if (!o.isShell && !o.cars) return true;   // a torn-down room leaves its shell floor: carries the same
      const cells = [];
      if (o.isShell) for (let x = o.x; x < o.x + o.w; x++) this.shellRows[fi(o.f)][x] = 0;
      else {
        const g = o.cars ? this.sgrid : this.grid;
        for (let i = 0; i < g.length; i++) for (let x = 0; x < CFG.W; x++) if (g[i][x] === o) { cells.push([g, i, x]); g[i][x] = null; }
      }
      let ok = true;
      for (const r of [...this.rooms, ...this.shells]) {
        if (r === o || r.f < 1 || r.type === 'bridge') continue;   // E43: the bridge hangs between the towers
        const ext = this.floorExtent(r.f - 1, r.x);   // E60: per tower
        if (!ext || r.x < ext[0] || r.x + r.w - 1 > ext[1]) { ok = false; break; }
      }
      if (o.isShell) for (let x = o.x; x < o.x + o.w; x++) this.shellRows[fi(o.f)][x] = 1;
      for (const [g, f, x] of cells) g[f][x] = o;
      return ok;
    }

    demolishAt(f, x) {
      const o = this.objectAt(f, x);
      if (!o) return { ok: false, reason: 'Hier steht nichts' };
      if (o.isLink) {
        this.links = this.links.filter(l => l !== o);
        for (const p of this.climbing) if (p.link === o) this._finishClimb(p, true);
        this._afterChange();
        return { ok: true };
      }
      if (!this._supportOk(o)) return { ok: false, reason: 'Darauf steht noch etwas' };
      if (o.isShell) {
        for (let i = o.x; i < o.x + o.w; i++) this.shellRows[fi(o.f)][i] = 0;
      } else if (o.cars) {
        this.shafts = this.shafts.filter(s => s !== o);
        for (const car of o.cars) this._releaseJob(car);
        for (const car of o.cars) for (const p of car.pax.slice()) this._dropFromCar(p, o, car, true);
        for (const q of [...o.qUp, ...o.qDown]) for (const p of q) p.state = 'stranded';
      } else {
        // anything stacked on top would float – only allow if nothing above relies on it
        this.rooms = this.rooms.filter(r => r !== o);
        if (o.type !== 'bridge') for (let i = o.x; i < o.x + o.w; i++) { this.shellRows[fi(o.f)][i] = 1; if (o.h === 2) this.shellRows[fi(o.f + 1)][i] = 1; }   // the shell stays (E37: on both floors); not under a bridge (E43)
        for (const p of o.people.slice()) this._kill(p);
        if (o.staff) for (const p of o.staff.slice()) this._kill(p);   // mechanics leave with their workshop
        // visits to a provider that is gone: the need counts 0 (P2.4); people inside or in its queue go
        // home, people on the way turn round (their trip home does not count in the trip rating)
        for (const p of [...this.persons]) {
          const v = p.visit;
          if (!v || v.room !== o || v.aborted) continue;
          this._visitSample(p, null);
          if (p.kind === 'visitor') { this._kill(p); continue; }
          if (p.visitQ === o || (p.state === 'in' && p.where === o)) { this._endVisit(p); this._teleportHome(p); }
          else { v.aborted = true; p.dest = v.then === 'out' ? this._street(p) : this._homeDest(p); }
        }
        for (const p of this.persons) if (p.dest && (p.dest.room === o || p.dest.garage === o)) p.dest = this._street(p);
        for (const p of this.persons) { if (p.parked === o) p.parked = null; if (p.garage === o) p.garage = null; }
        for (const p of [...this.persons]) if (p.state === 'in' && p.where === o) {
          if (p.kind === 'visitor') this._kill(p); else this._teleportHome(p);
        }
      }
      this._afterChange();
      return { ok: true };
    }

    // after building or tearing down; byCar = only a shaft stopped or started running (not a player's change)
    _afterChange(byCar) {
      this._structureChanged();
      this._assignEntries();
      if (!byCar) this._clearNeedOut();
      // replan everyone waiting or heading to a queue
      for (const p of this.persons) {
        if (p.state === 'stranded') { this._nextLeg(p); continue; }
        if (p.state === 'wait' && !p.visitQ) { this._drainWait(p); this._unqueue(p); this._nextLeg(p); continue; }
        if (p.state === 'walk' && (p.after === 'queue' || p.after === 'link')) { this._nextLeg(p); continue; }
      }
      for (const s of this.shafts) for (const car of s.cars) for (const p of car.pax) {
        if (s.twin) {   // TWIN: the next stop of the car's own floors
          if (!this.serves(s, p.legTo) || p.legTo < car.lo || p.legTo > car.hi) {
            let best = null, bd = Infinity;
            for (let g = car.lo; g <= car.hi; g++) if (this.serves(s, g) && Math.abs(g - p.legTo) < bd) { bd = Math.abs(g - p.legTo); best = g; }
            p.legTo = best ?? car.lo;
          }
          continue;
        }
        if (!this.serves(s, p.legTo) || (s.dbl && ((p.legTo - s.f0) & 1) !== p.deck)) {
          p.legTo = this._nearestStop(s, p.legTo, s.dbl ? p.deck : null);
          if (s.dbl) p.deck = (p.legTo - s.f0) & 1;   // nothing of his deck left (shaft extended below): the other deck
        }
      }
      if (!byCar) this._checkMilestones();
    }

    _nearestStop(s, f, deck) {
      let best = null, bd = Infinity;
      for (let pass = 0; pass < 2 && best == null; pass++)   // deck (double deck): a floor of that deck first
        for (let g = s.f0; g <= s.f1; g++) if (this.serves(s, g) && (pass || deck == null || ((g - s.f0) & 1) === deck) && Math.abs(g - f) < bd) { bd = Math.abs(g - f); best = g; }
      return best ?? s.f0;
    }

    // ----- entry rooms: underground garage (P4, E11/E31/K17), generalised (TOWER-a0011 P5, E27) -----
    // Tenants (workers, residents) from rooms of a tier with a share come and go through an entry room (garage, station, heliport)
    // instead of the street while its spaces last. The person is fixed per hash of its key (never this.rand); the entry room is an
    // entry node like the street (routing start/target at its middle). Only arriving at work / coming home and leaving use it –
    // lunch, shopping, hotel guests, visitors and mechanics stay at the street. p.garage / p.parked keep their names (= the entry room)
    _garageRoll(p) {
      if (p.groll === undefined) p.groll = mulberry32((this.seed ^ Math.imul(p.hkey + 1, 0x85EBCA6B) ^ 0x2F6A) | 0)();
      return p.groll;
    }
    // the roll for entry type t (E27): the garage its old one, every other type its own salt
    _entryRoll(p, t) {
      if (t === 'garage') return this._garageRoll(p);
      const m = p.erolls || (p.erolls = {});
      if (m[t] === undefined) m[t] = mulberry32((this.seed ^ Math.imul(p.hkey + 1, 0x85EBCA6B) ^ CFG.entries[t].salt) | 0)();
      return m[t];
    }

    // who uses which entry room: rooms in build order, people in slot order, the types in CFG.entries order, of a type the nearest
    // reachable room with a free space (one entry per person). With only garages exactly the P4 assignment
    _assignEntries() {
      for (const p of this.persons) p.garage = null;
      const types = [];
      for (const t in CFG.entries) {
        const gs = this.rooms.filter(r => r.type === t);
        if (!gs.length) continue;
        for (const g of gs) g.assigned = 0;
        const open = gs.filter(g => this.roomReachable(g));
        if (open.length) types.push({ t, E: CFG.entries[t], open, cap: CFG.rooms[t].spaces, near: null, share: 0 });
      }
      if (!types.length) return;
      for (const r of this.rooms) {
        if (!r.occupied || !isTenantRoom(r)) continue;
        const ok = [];
        for (const o of types) {
          const share = o.E.share[Math.min(r.tier, o.E.share.length - 1)];
          if (share > 0 && (!o.E.kind || o.E.kind === r.type) && (o.E.fromFloor == null || r.f >= o.E.fromFloor)) { o.share = share; o.near = null; ok.push(o); }
        }
        if (!ok.length) continue;
        for (const p of r.people) {
          if (p.mover) continue;
          for (const o of ok) {
            if (this._entryRoll(p, o.t) >= o.share) continue;
            if (!o.near) o.near = o.open.slice().sort((a, b) => Math.abs(a.f - r.f) - Math.abs(b.f - r.f) || a.id - b.id);
            const g = o.near.find(q => q.assigned < o.cap);
            if (!g) continue;
            p.garage = g; g.assigned++;
            break;
          }
        }
      }
    }

    _spot(g) { return { f: g.f, x: g.x + g.w / 2 }; }
    // the garage p arrives through (assigned, reachable, not coming from the street meanwhile), else null
    _garageIn(p) {
      const g = p.garage;
      return g && !g.closed && p.outAt !== 'street' && this.rooms.includes(g) && this.roomReachable(g) ? g : null;   // E49: closed in a storm
    }
    // where p goes to when it leaves: the garage its car stands in, else the street
    _outDest(p) {
      const g = p.parked;
      if (g && !g.closed && this.rooms.includes(g) && this.roomReachable(g)) return { ...this._spot(g), room: null, garage: g };
      return this._street(p);
    }
    _park(p, g) { if (p.parked === g) return; this._unpark(p); p.parked = g; g.parked++; }
    _unpark(p) { if (p.parked) { if (p.parked.parked > 0) p.parked.parked--; p.parked = null; } }
    _useGarage(p, g) { if (p.gDay !== this.day) { p.gDay = this.day; g.users++; } }
    // someone comes in through entry room g (E27): counted per type, the station and the heliport tell the sound (E81)
    _entryArrival(g) {
      const T = this.today;
      if (g.type === 'garage') { T.garageArrivals = (T.garageArrivals || 0) + 1; return; }
      const a = T.entryIn || (T.entryIn = {});
      a[g.type] = (a[g.type] || 0) + 1;
      const ev = CFG.rooms[g.type].event;
      if (ev) this._emit(ev, { room: g });
    }

    // ----- people -----
    _newPerson(kind, home) {
      const p = { id: this.nextId++, kind, home, f: 0, x: this._streetX(home ? home.x : null), state: 'out', where: null, dest: null, legTo: 0, shaft: null, after: null, tx: 0, tripStart: 0, waitStart: 0, scoreRoom: home, dead: false,
        role: kind === 'visitor' ? 'guest' : kind === 'mechanic' ? 'mechanic' : 'tenant' };
      // personal maximum energy: from the game seed (not from this.rand, so the day's random
      // stream stays as it was); tenants keyed by room, slot and tenancy so a save reloads the same people
      const key = home ? home.id * 64 + home.people.length + 4099 * (home.tenancy || 0) : p.id;
      p.eMax = this._energyMax(key);
      p.hkey = key; p.garage = null; p.parked = null; p.outAt = null; p.gDay = -1;
      p.energy = p.eMax; p.restT = this.t; p.restRate = CFG.energy.recoverPerHour;
      this.persons.add(p);
      if (home) home.people.push(p);
      return p;
    }

    _energyMax(key) {
      const E = CFG.energy;
      const r = mulberry32((this.seed ^ Math.imul(key + 1, 0x9E3779B1)) | 0)();
      return Math.round(E.min + r * (E.max - E.min));
    }

    // hotel guest (P3): kind 'hotelguest', role 'guest' (drawn like a visitor), home = the hotel (its trips rate
    // the hotel). rec = {nights, key} once checked in (null on the way there: p.stay nights, p.gkey). Energy and
    // the street position come from the key / an own stream – never from this.rand (K23)
    _newGuest(r, rec, key) {
      const p = this._newPerson('hotelguest', r);
      p.role = 'guest'; p.guest = rec || null; p.gkey = rec ? rec.key : key;
      p.eMax = this._energyMax(1e6 + r.id * 4096 + (p.gkey % 4096)); p.energy = p.eMax;
      p.rng = mulberry32((this.seed ^ Math.imul(p.gkey + 31 * r.id + 17, 0x2545F491)) | 0);
      return p;
    }

    // ----- energy -----
    // felt-time multiplier for someone with energy en
    _tiredMult(p, en) {
      const E = CFG.energy, k = 1 - en / (E.tiredBelow * p.eMax);
      return 1 + E.tiredFactor * Math.max(0, Math.min(1, k));
    }

    // spend energy over `sec` seconds of a trip part that counts comfort-fold; tiredness makes it feel longer
    _spend(p, en, sec, comfort) {
      const before = p.energy;
      p.energy = Math.max(0, before - en);
      p.extra = (p.extra || 0) + sec * comfort * (this._tiredMult(p, (before + p.energy) / 2) - 1);
    }

    // standing in a queue: settle the energy since the last mark
    _drainWait(p) {
      const w = this.t - (p.eWaitT ?? this.t);
      p.eWaitT = this.t;
      if (w > 0) this._spend(p, w / 60 * CFG.energy.waitPerMin, w, 1);
    }

    _endRide(p) {
      const w = this.t - (p.rideStart ?? this.t);
      p.rideStart = null;
      if (w > 0) this._spend(p, w / 60 * CFG.energy.ridePerMin, w, 1);
    }

    // start resting (room, restaurant or street)
    _restFrom(p, room) {
      p.restT = this.t;
      p.restRate = room && room.type === 'restaurant' ? CFG.energy.mealPerHour : CFG.energy.recoverPerHour;
    }

    // collect the rest since _restFrom
    _rest(p) {
      if (p.restT != null) p.energy = Math.min(p.eMax, p.energy + (this.t - p.restT) / 3600 * p.restRate);
      p.restT = null;
    }

    // live energy for the UI
    energyNow(p) {
      if (p.state === 'wait') return Math.max(0, p.energy - (this.t - (p.eWaitT ?? this.t)) / 60 * CFG.energy.waitPerMin);
      if (p.restT != null) return Math.min(p.eMax, p.energy + (this.t - p.restT) / 3600 * p.restRate);
      return p.energy;
    }

    _kill(p) {
      if (p.dead) return;
      p.dead = true;
      if (p.state === 'wait') this._unqueue(p);
      if (p.state === 'ride' && p.car) { const i = p.car.pax.indexOf(p); if (i >= 0) p.car.pax.splice(i, 1); }
      if (p.state === 'in' && p.where) this._leaveRoom(p.where);
      this.walking.delete(p);
      this.climbing.delete(p);
      this.persons.delete(p);
      this._unpark(p);
      if (p.home) { const i = p.home.people.indexOf(p); if (i >= 0) p.home.people.splice(i, 1); }
      if (p.kind === 'mechanic') {
        if (p.job) { const { s, car } = p.job; p.job = null; if (car.mech === p) { car.mech = null; car.fix = null; this._refresh(s, car); } }
        if (p.rjob) { const r = p.rjob; p.rjob = null; if (r.mech === p) { r.mech = null; r.repairEnd = 0; } }
        if (p.home && p.home.staff) { const i = p.home.staff.indexOf(p); if (i >= 0) p.home.staff.splice(i, 1); }
      }
    }

    _teleportHome(p) {
      if (p.state === 'wait') this._unqueue(p);
      if (p.state === 'in' && p.where) this._leaveRoom(p.where);
      this.walking.delete(p);
      this.climbing.delete(p);
      p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
      this._restFrom(p, p.home);
    }

    // someone leaves room r: a seat at a provider gets free for the first in its queue
    _leaveRoom(r) {
      r.inside--;
      if (r.queue.length) this._admit(r);
    }

    _unqueue(p) {
      if (p.visitQ) { const q = p.visitQ.queue, k = q.indexOf(p); if (k >= 0) q.splice(k, 1); p.visitQ = null; return; }
      const s = p.shaft; if (!s) return;
      const i = p.f - s.f0;
      for (const q of [s.qUp[i], s.qDown[i]]) { if (!q) continue; const k = q.indexOf(p); if (k >= 0) q.splice(k, 1); }
    }

    _dropFromCar(p, s, car, shaftGone) {
      const i = car.pax.indexOf(p); if (i >= 0) car.pax.splice(i, 1);
      this._endRide(p);
      p.f = Math.max(s.f0, Math.min(s.f1, Math.round(car.y) + (s.dbl ? p.deck : 0)));
      p.x = s.c + 0.8; p.car = null; p.byElev = false;
      p.state = shaftGone ? 'stranded' : 'walk';
      if (!shaftGone) this._nextLeg(p);
    }

    // start a trip from where the person is now to dest {f, x, room|null}
    // from = optional start node {f, x} of a trip that starts outside (the garage, K17); else the street
    _startTrip(p, dest, from) {
      if (p.state === 'in' && p.where) { const w = p.where; p.f = w.f; p.x = w.x + w.w / 2; p.where = null; this._leaveRoom(w); }
      else if (p.state === 'out') {
        const jit = ((p.rng ? p.rng() : this.rand()) - 0.5) * 2;   // always drawn, so the day's stream does not depend on the garage
        if (from) { p.f = from.f; p.x = from.x; } else { p.f = 0; p.x = this._streetX(dest.x) + jit; }   // E41: the street of the destination's tower
      }
      this._rest(p);
      p.where = null;
      p.dest = dest;
      p.tripStart = this.t;
      p.tripF0 = p.f; p.tripLink = false; p.tripElev = false;
      p.extra = 0; p.byElev = false;
      this._nextLeg(p);
    }

    _nextLeg(p) {
      if (p.dead) return;
      // E24: cleaners and mechanics prefer the service lifts (a way over them, stairs and escalators), else the public way
      const pl = p.role === 'cleaner' || p.kind === 'mechanic' ? this._planRole(p.f, p.x, p.byElev, p.energy, p.dest, true, true)
        : this._plan(p.f, p.x, p.byElev, p.energy, p.dest, true);
      if (!pl) { this._fail(p); return; }
      if (pl.mode === 'final') { this._walk(p, p.dest.x, 'final'); return; }
      const ed = pl.edge;
      p.legTo = ed.toF;
      if (ed.mode === 'link') {
        p.link = ed.link;
        this._walk(p, ed.from.x, 'link');
        return;
      }
      p.shaft = ed.shaft;
      let side = ed.toF > p.f ? -0.7 : 0.7;
      if (!this.walkable(p.f, ed.shaft.c + Math.sign(side))) side = -side;   // only one side has floor
      this._walk(p, ed.shaft.c + 0.5 + side, 'queue');
    }

    _startClimb(p) {
      const l = p.link;
      if (!this.links.includes(l)) { this._nextLeg(p); return; }
      const d = CFG.links[l.kind], up = p.legTo > p.f;
      p.state = 'climb';
      p.climb = { t0: this.t, dur: up ? d.up : d.down, from: p.f, to: p.legTo,
        x0: up ? l.x + 0.3 : l.x + l.w - 0.3, x1: up ? l.x + l.w - 0.3 : l.x + 0.3, comfort: d.comfort, energy: up ? d.energyUp : d.energyDown };
      p.cy = p.f;
      this.climbing.add(p);
    }

    _finishClimb(p, abort) {
      const c = p.climb;
      this.climbing.delete(p);
      p.f = c.to; p.x = c.x1; p.cy = null; p.byElev = false;
      p.extra = (p.extra || 0) + c.dur * (c.comfort - 1);
      this._spend(p, c.energy, c.dur, c.comfort);
      p.tripLink = true;
      if (!abort) p.link.used++;
      p.state = 'walk';
      this._nextLeg(p);
    }

    _walk(p, tx, after) {
      p.state = 'walk'; p.tx = Math.max(0.2, Math.min(CFG.W - 0.2, tx)); p.after = after;   // world width (EG over both towers)
      if (p.f !== 0 && (p.x < CFG.TW) !== (p.tx < CFG.TW)) this.today.crossings = (this.today.crossings || 0) + 1;   // E43: over a bridge
      this.walking.add(p);
    }

    _fail(p) {
      if (p.kind === 'mechanic') { this._mechFail(p); return; }
      if (p.mover) { this._kill(p); return; }   // moved out and found no way: gone
      if (p.visit && !p.visit.aborted) {
        // a visit to a provider failed (no way, no energy): the need counts 0, no 60-minute trip (P2.6)
        this._visitSample(p, null);
        const v = this._endVisit(p);
        this.walking.delete(p);
        this.today.visitFails++;
        if (p.kind === 'visitor') { this._kill(p); return; }
        if (v.then === 'out') { p.state = 'out'; p.f = 0; this._restFrom(p, null); return; }
        p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++; this._restFrom(p, p.home);
        return;
      }
      if (p.meal) { p.meal = false; this._needSample(p.home, 'lunch', null); }
      const back = p.visit || p.noScore;   // on the way back from a visit: not rated (scoreRoom is null)
      // no way to get there (or not with the energy left): a very bad trip, person gives up
      this._record(p, 60 * 60);
      this.today.fails = (this.today.fails || 0) + 1;
      if (p.scoreRoom) p.scoreRoom.failN++;
      this.walking.delete(p);
      if (back) { if (p.visit) this._endVisit(p); p.noScore = false; if (p.home && isTenantRoom(p.home)) p.scoreRoom = p.home; }
      if (p.kind === 'visitor') { this._kill(p); return; }
      if (p.kind === 'hotelguest' && (!p.guest || p.checkout)) { this._kill(p); return; }   // never got in / left: gone
      if (p.dest.room && p.dest.room === p.home) {
        // can't reach own room -> stays out (worker) / teleports home (resident, hotel guest) to keep the day consistent
        if (p.kind === 'resident' || p.kind === 'hotelguest') { p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++; this._restFrom(p, p.home); }
        else { p.state = 'out'; p.f = 0; this._restFrom(p, null); }
      } else if (p.home) {
        // trip elsewhere failed: return home instantly
        p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
        p.pendingBack = null;
        this._restFrom(p, p.home);
      } else { p.state = 'out'; this._restFrom(p, null); }
    }

    _record(p, seconds) {
      const r = p.scoreRoom; if (!r) return;
      r.tripSum += seconds / 60; r.tripN++;
    }

    _arrive(p) {
      if (p.kind === 'mechanic') { this._mechArrive(p); return; }   // own statistics, see workshopStats
      if (p.mover) { this._kill(p); return; }   // moved out: out on the street, gone (no statistics)
      const cr = p.dest && p.dest.room;   // E31: the control at a secured floor's door
      if (cr && this.checkFloors.has(cr.f) && isTenantRoom(cr)) p.extra = (p.extra || 0) + CFG.checkpoint.extraSec;
      const felt = this.t - p.tripStart + (p.extra || 0);
      this._record(p, felt);
      // statistics: energy share at arrival, felt minutes, mode by floors travelled
      const T = this.today, ef = p.energy / p.eMax;
      if (p.scoreRoom) { p.scoreRoom.eSum += ef; p.scoreRoom.eN++; }
      T.eSum = (T.eSum || 0) + ef; T.feltSum = (T.feltSum || 0) + felt / 60; T.tripN = (T.tripN || 0) + 1;
      const dist = Math.abs(p.dest.f - p.tripF0);
      if (dist > 0) {
        const m = T.modes || (T.modes = {});
        const b = m[dist] || (m[dist] = { n: 0, walk: 0, elev: 0, both: 0 });
        b.n++; if (p.tripLink && p.tripElev) b.both++; else if (p.tripLink) b.walk++; else b.elev++;
      }
      const d = p.dest;
      if (p.noScore) { p.noScore = false; p.scoreRoom = p.home; }
      const v = p.visit;
      if (v && !v.aborted && d.room && d.room === v.room) { this._visitArrive(p, felt); return; }
      if (v) this._endVisit(p);   // a visit whose provider was torn down: arrived home / outside instead
      if (p.meal) { p.meal = false; this._needSample(p.home, 'lunch', felt); }   // restaurant or street
      if (d.room) {
        if (!this.rooms.includes(d.room)) { this._startTrip(p, this._street(p)); return; }
        p.state = 'in'; p.where = d.room; d.room.inside++;
        this._restFrom(p, d.room);
        if (p.kind === 'hotelguest' && !p.guest && d.room === p.home) this._checkIn(p);
        if (p.role === 'courier') {   // E15: hands over the parcel, leaves after a few minutes
          if (d.room.type === 'lockers') {
            const fee = CFG.rooms.lockers.fee;
            d.room.parcels++; this.money += fee; this.today.sales += fee; this.today.fl[fi(d.room.f)] += fee; this.today.parcels = (this.today.parcels || 0) + 1;
          }
          this._emit('delivery', { room: d.room });
          this._schedule(this.t + CFG.delivery.stay, p, 'leave');
        }
        if (p.role === 'caller') { this.today.callersIn = (this.today.callersIn || 0) + 1; this._schedule(this.t + p.stay, p, 'leave'); }   // E38: a visitor of a tenant room
        if (p.role === 'cleaner') {   // E23: cleans the room, then goes back
          this.today.cleaned = (this.today.cleaned || 0) + 1;
          this._schedule(this.t + CFG.cleaning.stay, p, 'leave');
        }
        if (d.room.type === 'restaurant') {
          const price = CFG.rooms.restaurant.price;
          this.money += price; this.today.guests++; this.today.sales += price; this.today.fl[fi(d.room.f)] += price;
          d.room.vN++;
          this._emit('visit', { kind: 'restaurant', room: d.room });
          this._schedule(this.t + (p.kind === 'visitor' ? hm(0, 40) : hm(0, 35)), p, p.kind === 'visitor' ? 'leave' : 'backFromMeal');
        }
      } else {
        p.state = 'out'; p.f = 0;
        if (d.garage) { p.outAt = 'garage'; this._unpark(p); this._useGarage(p, d.garage); } else p.outAt = 'street';
        this._restFrom(p, null);
        if (p.kind === 'visitor' || p.checkout) this._kill(p);
        else if (p.pendingBack) { const a = p.pendingBack; p.pendingBack = null; this._schedule(this.t + hm(0, 45), p, a); }
      }
    }

    _schedule(t, p, act) { if (t < CFG.DAY_END) this.events.push({ t, p, act }); }

    _homeDest(p) { const h = p.home; return { f: h.f, x: h.x + h.w / 2, room: h }; }

    _doEvent(e) {
      const p = e.p;
      if (p.dead || p.mover) return;
      if (p.kind === 'mechanic') { this._mechEvent(p, e.act); return; }
      if (e.act === 'visitEnd' || e.act === 'visitGiveUp') { this._visitEvent(p, e.act); return; }
      // during a visit (on the way, queueing, inside a provider) everything else waits
      const busy = p.state === 'walk' || p.state === 'wait' || p.state === 'ride' || p.state === 'stranded' || p.state === 'climb' || !!p.visit;
      if (busy) { this._schedule(this.t + 600, p, e.act); return; }
      if (p.kind === 'hotelguest') { this._guestEvent(p, e.act); return; }
      if (p.role === 'cleaner') { this._cleanerEvent(p, e.act); return; }   // E23 (P4)
      if (p.role === 'caller') { this._callerEvent(p, e.act); return; }     // E38 (P6)
      const home = p.home;
      const toHome = () => this._homeDest(p);
      const out = () => (this._street(p));
      switch (e.act) {
        case 'arrive':            // worker comes to office / resident comes home / visitor to restaurant
          if (p.state !== 'out') return;
          if (p.kind === 'visitor') {
            if (!p.walkIn) this._startTrip(p, { f: p.target.f, x: p.target.x + p.target.w / 2, room: p.target });
            else if (this.rooms.includes(p.walkIn)) {
              // E29: a public guest by train starts at the station (pays its perUser), when it is still there and reachable
              const via = p.via && !p.via.closed && this.rooms.includes(p.via) && this.roomReachable(p.via) ? p.via : null;   // P9: a closed airship port
              p.via = via;
              if (via) { this._useGarage(p, via); this._entryArrival(via); if (p.role === 'tourist') this.today.touristsVia = (this.today.touristsVia || 0) + 1; else this.today.publicTrain = (this.today.publicTrain || 0) + 1; }
              this._startVisitTo(p, p.walkIn, null, 'out', p.until != null ? { until: p.until } : null, via ? this._spot(via) : null);
            }
            else this._kill(p);
          } else if (p.kid) { p.kid = false; this._startVisit(p, 'childcare', 'home'); }   // child to the Kita first
          else if (p.shop) { p.shop = false; this._startVisit(p, 'shopping', 'home'); }  // shopping on the way home
          else {
            const g = this._garageIn(p);   // by car through the garage (P4) or on foot from the street
            if (p.outAt !== 'street') this.today.arrivals = (this.today.arrivals || 0) + 1;   // real arrivals: not the return from a break in the street (E40)
            if (g) { this._entryArrival(g); this._park(p, g); this._useGarage(p, g); this._startTrip(p, toHome(), this._spot(g)); }
            else this._startTrip(p, toHome());
          }
          break;
        case 'leave':             // to the street (or the garage)
          if (p.state !== 'in') return;
          if (p.eve) {              // luxury office (E30): on the way out to the bar or the gym
            const need = p.eve; p.eve = null;
            if (p.where === home) {
              const r = this._pickProvider(p, need);
              if (r) { this._startVisitTo(p, r, need, 'out'); break; }
              this._needSample(home, need, null); this.today.visitFails++;
            }
          }
          this._startTrip(p, this._outDest(p));
          break;
        case 'meal': {            // lunch / dinner: restaurant if one is reachable and has seats, else outside
          if (p.state !== 'in') return;
          p.meal = p.kind === 'worker';   // office lunch is a need (P2): measured on arrival (restaurant or street)
          const r = this._pickRestaurant(p);
          if (r) this._startTrip(p, { f: r.f, x: r.x + r.w / 2, room: r });
          else { p.pendingBack = 'arrive'; this._startTrip(p, out()); }
          break;
        }
        case 'backFromMeal':
          if (p.state !== 'in') return;
          this._startTrip(p, toHome());
          break;
        case 'coffee':            // from the room to a provider and back
        case 'sport':
        case 'spa':               // luxury flats (P3)
        case 'evening':
          if (p.state === 'out' && e.act === 'sport' && this.t < hm(20, 30)) { this._schedule(this.t + 600, p, e.act); return; }
          if (p.state === 'out' && (e.act === 'spa' || e.act === 'evening') && this.t < this._visitUntil(e.act)) { this._schedule(this.t + 600, p, e.act); return; }
          if (p.state !== 'in' || p.where !== home) return;
          this._startVisit(p, e.act, 'back');
          break;
        case 'pickup':            // Kita: fetch the child, then go home (not measured, paid in the morning)
          if (p.state !== 'in' || p.where !== home) return;
          this._startVisit(p, 'childcare', 'out', { measure: false, pay: false });
          break;
      }
    }

    // last start of a visit to `need` today: end of its last window + 30 min (who is still out waits for it)
    _visitUntil(need) {
      const N = CFG.needs[need], w = (this.dayKind === 'weekend' && N.weekendWhen) || N.when;
      return w[w.length - 1][1] + 30 * 60;
    }

    // ----- hotel (P3, E10/K15) -----
    // a guest arrives in the hotel: the suite is taken from now on (paid for every night in _endDay)
    _checkIn(p) {
      const r = p.home, rec = { nights: p.stay, key: p.gkey };
      r.guests.push(rec); p.guest = rec; r.checkins++;
      this._emit('hotel', { room: r });
    }

    // hotel guests' day: arrive (check-in or back from the outing), leave (outing or checkout), dine (the lunch
    // need: restaurant or street), bar (the evening need), backFromMeal
    _guestEvent(p, act) {
      const home = p.home, Hc = CFG.hotel;
      const notIn = p.state !== 'in' || p.where !== home;
      switch (act) {
        case 'arrive':
          if (p.state === 'out') this._startTrip(p, this._homeDest(p));
          break;
        case 'leave':
          if (p.state === 'in') this._startTrip(p, this._street(p));
          break;
        case 'dine': {
          if (notIn) { if (p.state === 'out' && !p.checkout && this.t < Hc.dine[1] + 1.5 * 3600) this._schedule(this.t + 600, p, act); return; }
          p.meal = true;
          const r = this._pickRestaurant(p);
          if (r) this._startTrip(p, { f: r.f, x: r.x + r.w / 2, room: r });
          else { p.pendingBack = 'arrive'; this._startTrip(p, this._street(p)); }
          break;
        }
        case 'bar':
          if (notIn) { if (p.state === 'out' && !p.checkout && this.t < this._visitUntil('evening')) this._schedule(this.t + 600, p, act); return; }
          this._startVisit(p, 'evening', 'back');
          break;
        case 'backFromMeal':
          if (p.state === 'in') this._startTrip(p, this._homeDest(p));
          break;
      }
    }

    // the hotel's day, planned in the morning (or when it is built): checkouts, the staying guests' outing and
    // evening, new guests for the free suites. Requests = suites x min(1, base x E x Q x busy) with E = its
    // fulfilment yesterday (never measured: forecast), Q = its trip rating like the restaurant (1 / 0.7 / 0.4)
    _planHotel(r) {
      const def = CFG.rooms.hotel, Hc = CFG.hotel, t0 = this.t;
      const H = mulberry32((this.seed ^ Math.imul(r.id * 7919 + this.day * 104729 + 0x51ED, 0x9E3779B1)) | 0);
      const at = ([a, b], p, act) => { const t = a + H() * (b - a); if (t > t0) this._schedule(t, p, act); return t; };
      const left = [];
      for (const p of r.people) {
        if (!p.guest) continue;
        if (p.guest.nights <= 0) { p.checkout = true; left.push(p.guest); at(Hc.leave, p, 'leave'); continue; }
        const t = at(Hc.outing.leave, p, 'leave');
        if (t > t0) this._schedule(t + Hc.outing.stay[0] + H() * (Hc.outing.stay[1] - Hc.outing.stay[0]), p, 'arrive');
        at(Hc.dine, p, 'dine'); at(Hc.bar, p, 'bar');
      }
      if (left.length) r.guests = r.guests.filter(g => !left.includes(g));
      r.req = 0; r.checkins = 0;
      if (!this.roomReachable(r) || t0 >= Hc.arrive[1]) return;
      const E = r.fulfil ?? this.forecast(r, def.tier).fulfil;
      const Q = r.score == null || r.score <= CFG.goodMin ? 1 : r.score <= CFG.okMin ? 0.7 : 0.4;
      const busy = Hc.busyDays.includes(this.weekday) ? Hc.busy : 1;
      r.req = Math.round(def.suites * Math.min(1, Hc.base * E * Q * busy));
      const n = Math.min(r.req, def.suites - r.guests.length);
      for (let i = 0; i < n; i++) {
        const p = this._newGuest(r, null, this.day * 8 + i);
        p.stay = Hc.nights[0] + Math.floor(H() * (Hc.nights[1] - Hc.nights[0] + 1));
        const ta = Math.max(t0 + 60, Hc.arrive[0] + H() * (Hc.arrive[1] - Hc.arrive[0]));
        this._schedule(ta, p, 'arrive');
        at(Hc.dine, p, 'dine'); at(Hc.bar, p, 'bar');
      }
    }

    // nearest (in felt time) restaurant with free seats that p can reach with the energy p has now
    _pickRestaurant(p) {
      const x = p.where ? p.where.x + p.where.w / 2 : p.x, en = this.energyNow(p);
      let best = null, bc = Infinity;
      for (const r of this.rooms) {
        if (r.type !== 'restaurant' || r.inside >= CFG.rooms.restaurant.seats) continue;
        const pl = this._plan(p.f, x, false, en, { f: r.f, x: r.x + r.w / 2 }, false);
        if (pl && pl.cost < bc) { bc = pl.cost; best = r; }
      }
      return best;
    }

    // ----- visits to providers (P2): café, Kita, supermarket, fitness -----
    // p.visit = {need, room, then: 'back' | 'home' | 'out', stay, measure, pay, sampled, seated, aborted}.
    // The way there counts only for the need (felt minutes incl. queueing, P2.6), not in the trip rating:
    // scoreRoom is null while the visit runs and on the way 'back' (noScore).
    // Choice: planning cost + (inside + queue − seats)⁺ × stay / seats (P2.7).
    // E17/E70: every provider of the need (main type and `provides`), seats, stay and opening hours per candidate
    _pickProvider(p, need) {
      const list = this.needProv[need];
      if (!list) return null;
      const inRoom = p.state === 'in' && p.where;
      const f = inRoom ? p.where.f : 0, x = inRoom ? p.where.x + p.where.w / 2 : this._streetX(p.x), en = this.energyNow(p);
      let best = null, bc = Infinity;
      for (const r of list) {
        if (!this.isOpen(r.type) || r.closed) continue;   // E50: the sky garden in the fog
        const pl = this._plan(f, x, false, en, { f: r.f, x: r.x + r.w / 2 }, false);
        if (!pl) continue;
        const seats = CFG.rooms[r.type].seats;
        const c = pl.cost + Math.max(0, r.inside + r.queue.length - seats) * (stayFor(need, r.type) / 60) / seats;
        if (c < bc) { bc = c; best = r; }
      }
      return best;
    }

    // planned visit; no provider reachable = 0 for the need (P2.4), the person carries on as without it
    _startVisit(p, need, then, opt) {
      const r = this._pickProvider(p, need);
      if (r) { this._startVisitTo(p, r, need, then, opt); return; }
      if (!opt || opt.measure !== false) this._needSample(p.home, need, null);
      this.today.visitFails++;
      if (then === 'home' && p.state === 'out') this._startTrip(p, this._homeDest(p));
    }

    // opt.until (E29 school): stay until that time; from = start node outside (E29: the station)
    _startVisitTo(p, r, need, then, opt, from) {
      p.visit = { need, room: r, then, stay: stayFor(need, r.type), measure: !opt || opt.measure !== false, pay: !opt || opt.pay !== false,
        sampled: false, seated: false, aborted: false, until: opt && opt.until != null ? opt.until : null };
      if (p.kind !== 'visitor') p.scoreRoom = null;
      this._startTrip(p, { f: r.f, x: r.x + r.w / 2, room: r }, from);
    }

    _visitArrive(p, felt) {
      const r = p.visit.room;
      this._emit('visit', { kind: r.type, room: r });
      p.f = r.f;
      if (r.inside < CFG.rooms[r.type].seats) { this._seatVisit(p, felt); return; }
      // full: wait in front of the counter (standing on the room's tiles), the felt clock runs on
      p.state = 'wait'; p.visitQ = r; r.queue.push(p); p.visit.qT = this.t;
      p.waitStart = this.t; p.eWaitT = this.t;
      p.x = Math.min(r.x + r.w - 0.3, r.x + 0.3 + 0.42 * (r.queue.length - 1));
      this._schedule(this.t + CFG.visitGiveUp, p, 'visitGiveUp');
    }

    _seatVisit(p, felt) {
      const v = p.visit, r = v.room, def = CFG.rooms[r.type];
      p.state = 'in'; p.where = r; r.inside++;
      this._restFrom(p, r);
      this._visitSample(p, felt);
      v.seated = true;
      r.qSum += v.qT != null ? (this.t - v.qT) / 60 : 0; r.qN++;
      if (v.pay) {
        const price = def.prices && v.need && def.prices[v.need] != null ? def.prices[v.need] : def.price;   // E22: per need (district lobby)
        this.money += price; this.today.sales += price; this.today.fl[fi(r.f)] += price;
      }
      r.vN++; this.today.visits++;
      this._schedule(v.until != null ? Math.max(this.t + 60, v.until) : this.t + v.stay, p, 'visitEnd');
    }

    // seats got free: the first in the queue goes in
    _admit(r) {
      const seats = CFG.rooms[r.type].seats || Infinity;
      while (r.queue.length && r.inside < seats) {
        const q = r.queue.shift();
        q.visitQ = null;
        this._drainWait(q);
        this._seatVisit(q, this.t - q.tripStart + (q.extra || 0));
      }
    }

    _visitEvent(p, act) {
      const v = p.visit;
      if (act === 'visitGiveUp') {
        if (!v || !p.visitQ || this.t - p.waitStart < CFG.visitGiveUp - 1) return;   // seated meanwhile (or an old timer)
        this._drainWait(p); this._unqueue(p);
        this._visitSample(p, null);
        this.today.visitGiveUps++;
        v.room.guN++;
        this._visitLeave(p, v);
        return;
      }
      if (!v || p.state !== 'in' || p.where !== v.room) return;
      this._visitLeave(p, v);
    }

    // where a visitor leaves to: back to its station (E29), else the street
    _visitorOut(p) {
      const g = p.via;
      if (g && this.rooms.includes(g) && this.roomReachable(g)) return { ...this._spot(g), room: null, garage: g };
      return this._street(p);
    }

    _visitLeave(p, v) {
      this._endVisit(p);
      if (p.kind === 'visitor' || v.then === 'out') { this._startTrip(p, p.kind === 'visitor' ? this._visitorOut(p) : this._outDest(p)); return; }
      if (v.then === 'back') { p.noScore = true; p.scoreRoom = null; }   // the way back is not rated either
      this._startTrip(p, this._homeDest(p));
    }

    _endVisit(p) {
      const v = p.visit;
      p.visit = null;
      if (p.visitQ) this._unqueue(p);
      if (p.kind === 'worker' || p.kind === 'resident' || p.kind === 'hotelguest') p.scoreRoom = p.home;
      return v;
    }

    // one measurement per visit (felt seconds, null = failed / gave up / provider gone = 0)
    _visitSample(p, felt) {
      const v = p.visit;
      if (!v || v.sampled) return;
      v.sampled = true;
      if (v.need && v.measure) this._needSample(p.home, v.need, felt, v.room.roofed ? 0.5 : 1);
    }

    // k: share of the provider (a roofed rooftop bar gives half, P3)
    _needSample(r, need, felt, k) {
      if (!r || !(isTenantRoom(r) || r.type === 'hotel')) return;
      const a = r.nd[need] || (r.nd[need] = { s: 0, n: 0, m: 0, mn: 0 });
      a.n++;
      if (felt != null) { const min = felt / 60; a.s += needShare(min) * (k ?? 1); a.m += min; a.mn++; }
    }

    // ----- maintenance: wear, jobs, mechanics, emergency service -----
    // Mechanics are real people (kind = role = 'mechanic', no scoreRoom): shift 06:00–22:00 from the
    // street to their workshop, from there over the normal routing to a car's service floor.
    _hire(r) {
      r.staff = [];
      for (let i = 0; i < CFG.mechanics.perWorkshop; i++) {
        const p = this._newPerson('mechanic', null);
        p.home = r; p.scoreRoom = null; p.job = null; p.restUntil = 0;
        p.eMax = this._energyMax(r.id * 64 + 60 + i); p.energy = p.eMax;   // same people after reload
        r.staff.push(p);
      }
    }

    _mechTrip(p, goal, dest) { p.mGoal = goal; this._startTrip(p, dest); }

    // job done or gone: next job, else back to the workshop (or out after the shift / emergency)
    _mechHome(p) {
      if (!p.emergency && this.t < CFG.mechanics.shiftEnd && this.rooms.includes(p.home)) {
        this._dispatch();
        if (p.job || p.rjob) return;
        const ws = p.home;
        this._mechTrip(p, 'shop', { f: ws.f, x: ws.x + ws.w / 2, room: ws });
      } else this._mechTrip(p, 'out', this._street(p));
    }

    _mechEvent(p, act) {
      const busy = p.state === 'walk' || p.state === 'wait' || p.state === 'ride' || p.state === 'stranded' || p.state === 'climb';
      switch (act) {
        case 'dispatch': this._dispatch(); break;
        case 'roomDone': if (p.rjob && p.state === 'work') this._finishRoomRepair(p.rjob, p); break;
        case 'arrive':
          if (p.state !== 'out') return;
          if (p.emergency && p.rjob) {   // P3 (E20): the emergency service for a room, through the entrance
            const r = p.rjob;
            if (!this.rooms.includes(r) || !r.damaged) { this._kill(p); return; }
            // no way up right now (cars in a quake inspection, an outage): he waits at the entrance and tries again
            if (!this._plan(0, this._streetX(r.x), false, CFG.energy.ref, { f: r.f, x: r.x + r.w / 2 }, false)) { this._schedule(this.t + 600, p, 'arrive'); return; }
            this._mechTrip(p, 'room', { f: r.f, x: r.x + r.w / 2, room: null });
          } else if (p.emergency) {
            const { s, car } = p.job;
            if (!this.shafts.includes(s) || !s.cars.includes(car) || s.svc == null) { this._kill(p); return; }
            p.jobT0 = this.t;
            this._mechTrip(p, 'job', { f: s.svc, x: this.svcX(s, s.svc), room: null });
          } else if (this.rooms.includes(p.home)) {
            const ws = p.home;
            this._mechTrip(p, 'shop', { f: ws.f, x: ws.x + ws.w / 2, room: ws });
          }
          break;
        case 'leave':
          if (busy || p.job || p.rjob) { this._schedule(this.t + 600, p, 'leave'); return; }
          if (p.state === 'in' || p.state === 'work') this._mechTrip(p, 'out', this._street(p));
          break;
      }
    }

    _mechArrive(p) {
      this.walking.delete(p);
      if (p.mGoal === 'out') {
        if (p.emergency) { this._kill(p); return; }
        p.state = 'out'; p.f = 0; this._restFrom(p, null);
        return;
      }
      if (p.mGoal === 'shop') {
        const ws = p.home;
        if (!this.rooms.includes(ws)) { this._kill(p); return; }
        p.state = 'in'; p.where = ws; ws.inside++; this._restFrom(p, ws);
        this._dispatch();
        return;
      }
      if (p.mGoal === 'room') {   // P3 (E20): at the damaged room – the work takes repairSec
        const r = p.rjob;
        p.state = 'work'; p.where = null;
        if (!r || !this.rooms.includes(r) || !r.damaged) { if (r && r.mech === p) r.mech = null; p.rjob = null; if (p.emergency) this._mechTrip(p, 'out', this._street(p)); else this._mechHome(p); return; }
        r.repairEnd = this.t + CFG.quake.repairSec;
        this._schedule(r.repairEnd, p, 'roomDone');
        this._emit('repairStart', { room: r });
        return;
      }
      // at the service floor of the job's shaft
      const job = p.job;
      p.state = 'work'; p.where = null;
      if (!job || !this.shafts.includes(job.s) || !job.s.cars.includes(job.car)) { p.job = null; this._mechHome(p); return; }
      const { s, car } = job;
      if (s.svc == null) { this._releaseJob(car); this._refresh(s, car); return; }
      if (s.svc !== p.f) { this._mechTrip(p, 'job', { f: s.svc, x: this.svcX(s, s.svc), room: null }); return; }   // stops changed
      if (!p.emergency) this.today.mechApp.push((this.t - p.jobT0) / 60);
      car.fix = 'park';                 // the car takes nobody new, delivers its riders, comes down empty
      this._refresh(s, car);
    }

    // a mechanic cannot go on (no way, or too tired): the job goes back with a pause
    _mechFail(p) {
      this.walking.delete(p);
      this.today.mechFails++;
      if (p.job) {
        const { s, car } = p.job;
        p.job = null;
        if (car.mech === p) { car.mech = null; car.fix = null; car.jobBlock = this.t + CFG.repair.blockSec; this._refresh(s, car); }
        if (p.emergency) { this.money += CFG.emergency.cost; this.msg('Notdienst kommt nicht durch – Geld zurück', 'bad'); }
      }
      if (p.rjob) {   // P3: the room order goes back with a pause (an emergency order gets its fee back, the order stays paid)
        const r = p.rjob; p.rjob = null;
        if (r.mech === p) { r.mech = null; r.repairEnd = 0; r.jobBlock = this.t + CFG.repair.blockSec; }
        if (p.emergency) {
          r.emerg = false; this.money += CFG.emergency.cost; this.msg('Notdienst kommt nicht durch – Geld zurück', 'bad');
          if (r.paidDay === this.day) { this.today.repairs -= CFG.emergency.cost; r.paidCost -= CFG.emergency.cost; }   // the refund is no payment of today
        }
      }
      if (p.emergency) { this._kill(p); return; }
      const ws = p.home;
      if (p.mGoal === 'job' && this.rooms.includes(ws)) {
        // rests in the workshop, then is free again
        p.state = 'in'; p.where = ws; p.f = ws.f; ws.inside++; this._restFrom(p, ws);
        p.restUntil = this.t + CFG.repair.blockSec;
        this._schedule(p.restUntil + 1, p, 'dispatch');
      } else if (p.mGoal === 'shop') {
        p.state = 'out'; p.f = 0; this._restFrom(p, null);
        this._schedule(this.t + 3600, p, 'arrive');
      } else { p.state = 'out'; p.f = 0; this._restFrom(p, null); }
    }

    _mechFree(p) {
      return !p.emergency && !p.job && !p.rjob && this.t < CFG.mechanics.shiftEnd && !(p.restUntil > this.t)
        && ((p.state === 'in' && p.where === p.home) || p.state === 'work');
    }

    // hand open jobs (most worn first) to free mechanics who can get there (plan from where they are,
    // reference energy, cached until the structure changes); unreachable jobs stay open
    _dispatch() {
      let jobs = null;
      for (const s of this.shafts) for (const car of s.cars) {
        if (car.job && !car.mech && car.fix == null && !(car.jobBlock > this.t) && s.svc != null) (jobs || (jobs = [])).push({ s, car });
      }
      // P3 (E20): then the room repair orders in the order they were given
      let rjobs = null;
      for (const r of this.roomJobs) if (!r.mech && r.damaged && !(r.jobBlock > this.t)) (rjobs || (rjobs = [])).push(r);
      if (!jobs && !rjobs) return;
      const free = [];
      for (const r of this.rooms) if (r.staff) for (const p of r.staff) if (this._mechFree(p)) free.push(p);
      if (!free.length) return;
      if (jobs) jobs.sort((a, b) => b.car.wear - a.car.wear);
      for (const { s, car } of jobs || []) {
        if (!free.length) break;
        const x = this.svcX(s, s.svc);
        let best = -1, bc = Infinity;
        free.forEach((p, i) => {
          const px = p.state === 'in' ? p.where.x + p.where.w / 2 : p.x;
          const key = 'm' + p.f + ':' + Math.round(px * 2) + '>' + s.id;
          let c = this.reachCache.get(key);
          if (c === undefined) {
            const pl = this._plan(p.f, px, false, CFG.energy.ref, { f: s.svc, x }, false);
            c = pl ? pl.cost : -1;
            this.reachCache.set(key, c);
          }
          if (c >= 0 && c < bc) { bc = c; best = i; }
        });
        if (best < 0) continue;
        const p = free.splice(best, 1)[0];
        car.mech = p; p.job = { s, car }; p.jobT0 = this.t;
        this._setCond(car);
        this._mechTrip(p, 'job', { f: s.svc, x, room: null });
      }
      for (const r of rjobs || []) {
        if (!free.length) break;
        if (!this.rooms.includes(r)) continue;
        const x = r.x + r.w / 2;
        let best = -1, bc = Infinity;
        free.forEach((p, i) => {
          const px = p.state === 'in' ? p.where.x + p.where.w / 2 : p.x;
          const key = 'm' + p.f + ':' + Math.round(px * 2) + '>r' + r.id;
          let c = this.reachCache.get(key);
          if (c === undefined) {
            const pl = this._plan(p.f, px, false, CFG.energy.ref, { f: r.f, x }, false);
            c = pl ? pl.cost : -1;
            this.reachCache.set(key, c);
          }
          if (c >= 0 && c < bc) { bc = c; best = i; }
        });
        if (best < 0) continue;
        const p = free.splice(best, 1)[0];
        r.mech = p; p.rjob = r; p.jobT0 = this.t;
        this._ownRng(p, r);
        this._mechTrip(p, 'room', { f: r.f, x, room: null });
      }
    }

    _openJob(s, car) {
      car.job = true;
      this.today.jobsOpened++;
      this._dispatch();
    }

    // wear from a stop with people or a floor driven; opens the job, slows down, breaks down
    _wear(s, car, w) {
      const b = car.wear;
      if (b >= 100) return;
      const a = car.wear = Math.min(100, b + w);
      if (!car.job && a >= this.serviceAt) this._openJob(s, car);
      if (a >= 100) this._breakdown(s, car);
      else if (b < CFG.wear.slowAt && a >= CFG.wear.slowAt) this._setCond(car);
    }

    _carName(s, car) { return CFG.shafts[s.kind].label + ' ' + s.name + (s.cars.length > 1 ? ', Kabine ' + (s.cars.indexOf(car) + 1) : ''); }

    _breakdown(s, car) {
      this.today.breakdowns++;
      this._refresh(s, car);
      this.msg('Panne: ' + this._carName(s, car) + (car.mech ? ' – Handwerker ist unterwegs' : ' steht – Werkstatt oder 🚨 Notdienst'), 'bad');
      this._diary('breakdown', 'Panne: ' + this._carName(s, car));
      this._emit('breakdown', { shaft: s, car });
    }

    _startRepair(s, car) {
      car.fix = 'repair'; car.repairEnd = this.t + CFG.repair.sec;
      this._refresh(s, car);
      this._emit('repairStart', { shaft: s, car });
    }

    // repair done: wear 0, parts paid (the emergency price includes them); night = end of day, no new trips
    _finishRepair(s, car, night) {
      const p = car.mech;
      car.wear = 0; car.job = false; car.mech = null; car.fix = null; car.jobBlock = 0;
      if (!car.emerg) { this._book(s, CFG.repair.parts); this.today.jobs++; }
      car.emerg = false;
      this._refresh(s, car);
      this._emit('repairDone', { shaft: s, car });
      if (!p) return;
      p.job = null;
      if (p.emergency && night) { this._kill(p); return; }
      if (!night) this._mechHome(p);
    }

    // a job loses its mechanic (car removed, shaft demolished, …): the mechanic goes home
    _releaseJob(car) {
      const p = car.mech;
      car.mech = null; car.fix = null;
      this._setCond(car);
      if (!p) return;
      p.job = null;
      if (p.state === 'work') this._mechHome(p);
    }

    // maintenance costs: paid now, shared among the shaft's door floors (heatmap "Geld")
    _book(s, cost) {
      this.money -= cost; this.today.repairs += cost;
      const fs = this._doorFloors(s);
      for (const f of fs) this.today.fl[fi(f)] -= cost / fs.length;
    }

    // emergency service: only for a broken car nobody is coming for; arrives after delaySec through the entrance
    checkEmergency(s, car) {
      const E = CFG.emergency, res = { ok: false, cost: E.cost };
      if (car.mech) { res.reason = car.mech.emergency ? 'Notdienst ist unterwegs' : 'Handwerker ist unterwegs'; return res; }
      if (car.wear < 100) { res.reason = 'Nur bei einer Panne'; return res; }
      if (s.svc == null) { res.reason = 'Keine Halte-Etage mit Boden für die Wartung'; return res; }
      if (!this._plan(0, this._streetX(s.c), false, CFG.energy.ref, { f: s.svc, x: this.svcX(s, s.svc) }, false)) { res.reason = 'Vom Eingang kommt niemand zur Wartungs-Etage (' + floorName(s.svc) + ')'; return res; }
      if (this.money < E.cost) { res.reason = 'Zu wenig Geld – Kredit nehmen?'; return res; }
      res.ok = true;
      return res;
    }

    callEmergency(car) {
      const s = this.shafts.find(sh => sh.cars.includes(car));
      if (!s) return { ok: false, reason: 'Unbekannt' };
      const c = this.checkEmergency(s, car);
      if (!c.ok) return c;
      this._book(s, c.cost);
      const p = this._newPerson('mechanic', null);
      p.scoreRoom = null; p.emergency = true; p.job = { s, car }; p.restUntil = 0;
      car.mech = p; car.emerg = true; car.jobBlock = 0;
      this._setCond(car);
      this._schedule(this.t + CFG.emergency.delaySec, p, 'arrive');
      this.today.emergencies++;
      this.msg('🚨 Notdienst gerufen für ' + this._carName(s, car) + ' – kommt in ' + Math.round(CFG.emergency.delaySec / 60) + ' Min.', 'info');
      this._emit('emergency', { shaft: s, car });
      return c;
    }

    // workshop panel: today's approach times of mechanics (minutes), jobs done, breakdowns
    workshopStats() {
      const a = this.today.mechApp.slice().sort((x, y) => x - y);
      return {
        avgApproachMin: a.length ? a.reduce((x, y) => x + y, 0) / a.length : null,
        medianApproachMin: a.length ? a[a.length >> 1] : null,
        maxApproachMin: a.length ? a[a.length - 1] : null,
        jobsToday: this.today.jobs, breakdownsToday: this.today.breakdowns,
      };
    }

    // ----- earthquakes and dampers (TOWER-a0010 P5, E14/E15/E33) -----
    // today's quake from the own stream (seed ^ salt + day; never this.rand): null or { level, hour }. Pure – the
    // state (last, n, calm period) is read, not changed; sim_check draws 365 days with it
    quakeDraw(day) {
      const Q = CFG.quake, top = Q.star;
      if (this.stars < top || this.off.quake) return null;
      const sd = this.starDays[top], ref = sd != null ? sd + 1 : this.quakes.from ?? day;
      if (day - ref < Q.calm) return null;
      if (this.quakes.last != null && day - this.quakes.last < Q.minGap) return null;
      const R = mulberry32(((this.seed ^ Q.salt) + Math.imul(day, 104729)) | 0);
      if (R() >= Q.chance) return null;
      const u = R(); let level = Q.levels.length, acc = 0;
      for (let i = 0; i < Q.levels.length; i++) { acc += Q.levels[i]; if (u < acc) { level = i + 1; break; } }
      if (!this.quakes.n) level = 1;   // the first one is a warning shot
      return { level, hour: Q.hours[0] + Math.floor(R() * (Q.hours[1] - Q.hours[0] + 1)) };
    }

    // strongest damper level covering floor f (a damper protects `reach` floors below itself and its own), 0 = none
    damperAt(f, x) {
      let lv = 0;
      const t = towerOf(x ?? 0);   // E60: a damper protects its own tower
      for (const r of this.rooms) if (r.type === 'damper' && towerOf(r.x) === t && f <= r.f && f >= r.f - CFG.rooms.damper.reach && r.damperLevel > lv) lv = r.damperLevel;
      return lv;
    }

    // ----- weather (TOWER-a0011 P6, E33/E34/E66/E76) -----
    // today's weather from the own stream (seed ^ salt + day; never this.rand): null below the star or with g.off.weather, else
    // { fog, ice, storm } by the chances of the day's season. Pure like quakeDraw
    weatherDraw(day) {
      const W = CFG.weather;
      if (this.stars < W.star || this.off.weather) return null;
      const R = mulberry32(((this.seed ^ W.salt) + Math.imul(day, 104729)) | 0), s = Math.floor((day - 1) / CFG.seasonDays) % 4;
      const fog = R() < W.fog[s], ice = R() < W.ice[s];
      return { fog, ice, storm: this.stars >= W.storm.star && R() < W.storm.p[s] };   // E49: the third draw only from ★★★★★
    }

    // a facade gondola of x's tower covers floor f (E34/E60: f − reach … f of the gondola, like damperAt)
    gondolaAt(f, x) {
      const G = CFG.rooms.gondola, t = towerOf(x ?? 0);
      return this.rooms.some(r => r.type === 'gondola' && f <= r.f && f >= r.f - G.reach && towerOf(r.x) === t);
    }

    // above the cloud line: a room whose (top) floor is over CFG.weather.line
    aboveClouds(r) { return r.f + (r.h || 1) - 1 > CFG.weather.line; }

    // fog today: a luxury office/flat above the cloud line books its rent without the height surcharge (E76: only in rentOf)
    fogged(r) { return this.weatherToday.fog && (r.tier || 0) >= 2 && isTenantRoom(r) && this.aboveClouds(r); }

    // the morning's weather (w from weatherDraw, null = none): ice marks the rooms without a gondola (r.wxDrop for tonight); a message
    // and the event only when the tower reaches above the cloud line
    // live (test hook during the day): a bridge closing or opening replans like a building change
    _applyWeather(w, live) {
      const W = CFG.weather, S = W.storm;
      this.weatherToday = { fog: !!(w && w.fog), ice: !!(w && w.ice), storm: !!(w && w.storm) };
      let iced = 0, blown = 0, bridges = false, closed = 0;
      for (const r of this.rooms) {
        r.wxDrop = 0; r.wxKind = null;
        if (this.weatherToday.ice && isTenantRoom(r) && this.aboveClouds(r) && !this.gondolaAt(r.f + (r.h || 1) - 1, r.x)) { r.wxDrop = W.iceDrop; r.wxKind = 'ice'; iced++; }
        // E49: luxury above the storm line without a damper covering it (its top floor)
        if (this.weatherToday.storm && isTenantRoom(r) && (r.tier || 0) >= 2 && r.f + (r.h || 1) - 1 > S.line && !this.damperAt(r.f + (r.h || 1) - 1, r.x)) { r.wxDrop += S.drop; r.wxKind = r.wxKind ? 'both' : 'storm'; blown++; }
        if (r.type === 'skygarden') r.closed = this.weatherToday.fog || undefined;   // E50: closed in the fog
        if (S.closes.includes(r.type)) {
          const c = this.weatherToday.storm;
          if (!!r.closed !== c && r.type === 'bridge') bridges = true;
          r.closed = c || undefined;
          if (c) closed++;
        }
      }
      if (bridges) { if (live) this._afterChange(true); else this._structureChanged(); }   // E49: the bridge is no floor today (or again floor)
      if (this.weatherToday.storm && (closed || blown || this.rooms.some(r => r.type === 'wind'))) {
        this.msg('🌪️ Sturm: ' + (closed ? 'Brücken und Anleger gesperrt' : 'heute weht es') + (blown ? ' – ' + blown + (blown === 1 ? ' Luxus-Raum' : ' Luxus-Räume') + ' über dem ' + floorName(S.line) + ' ohne 🌀 Dämpfer −' + Math.round(S.drop * 100) + ' % Erfüllung' : ''), 'bad');
        this._emit('weather', { kind: 'storm' }); if (this.onWeather) this.onWeather('storm');
      }
      if (!w || !(w.fog || w.ice) || this.builtTop() <= W.line) return;
      const line = floorName(W.line);
      if (w.fog) {
        const lux = this.rooms.filter(r => this.fogged(r)).length;
        this.msg('🌫️ Nebel über dem ' + line + ' – keine Aussicht' + (lux ? ': ' + lux + (lux === 1 ? ' Luxus-Raum zahlt' : ' Luxus-Räume zahlen') + ' heute ohne Höhenzuschlag' : ''), 'bad');
      }
      if (w.ice) this.msg('🧊 Eis an der Fassade über dem ' + line + (iced ? ': ' + iced + (iced === 1 ? ' Raum' : ' Räume') + ' ohne 🚡 Fassadengondel heute −' + Math.round(W.iceDrop * 100) + ' % Erfüllung' : ' – die Fassadengondeln halten alles frei'), 'bad');
      for (const kind of ['fog', 'ice']) if (w[kind]) { this._emit('weather', { kind }); if (this.onWeather) this.onWeather(kind); }
    }

    // test hook (sim_check, smoke): today's weather now – kind 'fog' | 'ice' (or an object { fog, ice })
    weather(kind) { this._applyWeather(typeof kind === 'string' ? { fog: kind === 'fog', ice: kind === 'ice', storm: kind === 'storm' } : kind, true); this._updatePower(); return this.weatherToday; }

    // strength felt on floor f by a quake of `level`: each damper level takes one step off (1: light gone, medium →
    // light, heavy → medium; 2: medium gone, heavy → light; 3: all gone)
    quakeFelt(level, f, x) { return Math.max(0, level - this.damperAt(f, x)); }

    // highest floor with floor above ground (0 = only the lobby)
    builtTop() {
      for (let f = CFG.MAX_FLOOR; f >= 1; f--) if (this.floorUsed(f)) return f;
      return 0;
    }

    // test hook (sim_check, smoke): the quake of the given strength now, same effect as a drawn one
    quake(level) { return this._quake(Math.max(1, Math.min(3, Math.round(level) || 1))); }

    _quake(level) {
      const Q = CFG.quake, name = Q.names[level];
      this.quakes.last = this.day; this.quakes.n++;
      this.quakeToday = { level, t: this.t };
      const top = this.builtTop(), res = { level, inspected: 0, damaged: 0, broken: null, movedOut: 0, fee: 0, early: this.hasUpg('early') };
      // heavy: the highest shaft (felt at its top) breaks down until it is repaired; the fire lift (E59) is built to stand
      // the quake – it is neither broken nor inspected (Setzung P2)
      let high = null;
      for (const s of this.shafts) if (!CFG.shafts[s.kind].noRiders && (!high || s.f1 > high.f1)) high = s;
      if (high && !res.early && this.quakeFelt(level, high.f1, high.c) >= 3) {   // E35: the early warning stopped the cars in time
        for (const car of high.cars) {
          if (car.fix === 'repair' || car.wear >= 100) continue;
          car.wear = 100; car.job = true; this.today.breakdowns++;
          this._refresh(high, car);
        }
        res.broken = high;
      }
      // cars: inspection by the felt strength at the top of their shaft, wear on top
      const insp = [];
      for (const s of this.shafts) {
        const e = this.quakeFelt(level, s.f1, s.c);
        if (e < 1 || s === res.broken || CFG.shafts[s.kind].noRiders || res.early) continue;   // E35: no inspection, no wear
        insp.push(s);
        for (const car of s.cars) {
          if (!car.mech && car.fix == null && car.wear < 100) {
            car.fix = 'inspect'; car.repairEnd = this.t + Q.inspectSec;
            car.wear = Math.min(100, car.wear + Q.wear[e]);
            this._refresh(s, car);
          } else this._wear(s, car, Q.wear[e]);
        }
      }
      res.inspected = insp.length;
      // the inspection: the workshop's mechanics when it is open, else the emergency service (one fee, shared)
      if (insp.length && !(this.rooms.some(r => r.type === 'workshop') && this.isOpen('workshop'))) {
        res.fee = CFG.emergency.cost;
        for (const s of insp) this._book(s, res.fee / insp.length);
        this.today.emergencies++;
      }
      // rooms: damage in the top share of the built floors by the felt strength, fright there; heavy: move-outs
      for (const r of this.rooms.slice()) {
        if (!isTenantRoom(r) || r.f < 1) continue;
        const e = this.quakeFelt(level, r.f, r.x);
        if (e >= 2 && r.f > top - Math.max(1, Math.floor(top * Q.top[e]))) {
          if (!r.damaged) res.damaged++;
          r.damaged = true; r.shaken = Q.satDays;
        }
        if (e >= 3 && r.occupied && r.warnDays > 0 && !this.staysForever(r)) { this._moveOut(r); res.movedOut++; }
      }
      const parts = [];
      if (res.early) parts.push('📳 Frühwarnung: die Kabinen hielten rechtzeitig – keine Prüfung');
      if (res.inspected) parts.push('Kabinen halten zur Prüfung' + (res.fee ? ' (🚨 Notdienst ' + res.fee.toLocaleString('de-DE') + ' €)' : ''));
      if (res.damaged) parts.push(res.damaged + (res.damaged > 1 ? ' Räume beschädigt' : ' Raum beschädigt') + ' – 🔧 Reparieren im Raum');
      if (res.broken) parts.push(CFG.shafts[res.broken.kind].label + ' ' + res.broken.name + ' defekt');
      if (res.movedOut) parts.push(res.movedOut + ' Auszüge');
      const text = 'Erdbeben (' + name + ')' + (parts.length ? ': ' + parts.join(', ') : ' – die Dämpfer haben alles abgefangen');
      this.msg('🌋 ' + text, 'bad');
      this._diary('quake', text);
      if (res.broken) this._dispatch();
      this._emit('quake', { level });
      if (this.onQuake) this.onQuake(level);
      return res;
    }

    // quake inspection over: the car runs again, unless the extra wear broke it (job and breakdown as usual)
    _endInspect(s, car) {
      car.fix = null; car.repairEnd = 0;
      if (!car.job && car.wear >= this.serviceAt) { car.job = true; this.today.jobsOpened++; }
      if (car.wear >= 100) this._breakdown(s, car); else this._refresh(s, car);
      if (car.job || this.roomJobs.length) this._dispatch();   // qa-P3 F2: room orders waiting for the cars go out now
    }

    // ----- incidents (TOWER-a0011 P3, E19/E72) -----
    // today's incident from the own stream (seed ^ salt + day; never this.rand): null or { kind, hour, u }. Pure like
    // quakeDraw (same calm start); u places it (the floor or the car) when it strikes
    incidentDraw(day) {
      const I = CFG.incidents;
      if (this.stars < I.star || this.off.incidents) return null;
      const sd = this.starDays[I.star], ref = sd != null ? sd + 1 : this.quakes.from ?? day;
      if (day - ref < I.calm) return null;
      if (this.incidents.last != null && day - this.incidents.last < I.minGap) return null;
      if (this.quakeDraw(day)) return null;   // never on a quake day
      const R = mulberry32(((this.seed ^ I.salt) + Math.imul(day, 104729)) | 0);
      const v = R(); let acc = 0, kind = null;
      for (const k of Object.keys(I.kinds)) { acc += I.kinds[k]; if (v < acc) { kind = k; break; } }
      if (!kind) return null;
      return { kind, hour: I.hours[0] + Math.floor(R() * (I.hours[1] - I.hours[0] + 1)), u: R() };
    }

    // is a plant-floor upgrade (backup | leak) somewhere in the tower?
    hasUpg(key) { return this.rooms.some(r => r.upg && r.upg[key]); }

    checkUpg(r, key) {
      const U = CFG.incidents.upg[key], res = { ok: false, key, cost: U ? U.cost : 0 };
      if (!U || r.type !== 'tech') { res.reason = 'Nur in der Technikebene'; return res; }
      const st = U.star || CFG.incidents.star;   // E35: the early warning from ★★★★
      if (this.stars < st) { res.reason = 'Erst ab ' + '★'.repeat(st); return res; }
      if (r.upg && r.upg[key]) { res.reason = 'Schon eingebaut'; return res; }
      const other = this.rooms.find(o => o.upg && o.upg[key]);
      if (other) { res.reason = U.label + ' gibt es schon (Technikebene ' + floorName(other.f) + ') – einer im Turm genügt'; return res; }
      if (this.money < U.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    // ----- the goal: space elevator (TOWER-a0011 P9, E55/E68/E81) -----
    // the platform on a space station (its panel „🚀 Plattform bauen“): one in the game is enough
    checkPlatform(r) {
      const res = { ok: false, cost: CFG.goal.cost };
      if (!r || r.type !== 'spacestation') { res.reason = 'Nur an der ' + CFG.rooms.spacestation.label; return res; }
      if (r.platform) { res.reason = 'Die Plattform steht schon'; return res; }
      if (this._hasPlatform()) { res.reason = 'Eine Plattform genügt – sie steht schon an der anderen Station'; return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildPlatform(r) {
      const c = this.checkPlatform(r);
      if (!c.ok) return c;
      const G = CFG.goal;
      this.money -= c.cost; r.platform = true; this.goal.platform = true;
      this.msg('🚀 Plattform für den Weltraumfahrstuhl gebaut (−' + c.cost.toLocaleString('de-DE') + ' €) – jetzt ' + G.days + ' Abende in Folge ' + Math.round(G.sat * 100) + ' % zufrieden', 'good');
      this._diary('goal', 'Plattform für den Weltraumfahrstuhl gebaut');
      this._emit('platform', { room: r });
      return c;
    }

    _hasPlatform() { return this.rooms.some(r => r.type === 'spacestation' && r.platform); }

    // evening (after the stars): with the platform standing, an evening with sat ≥ CFG.goal.sat adds one to the streak, a lower one starts it
    // again at 0; a full streak sets goal.done (event 'goal') – the launch follows the day after at CFG.goal.launchAt (step)
    _goalEvening() {
      const G = CFG.goal, g = this.goal;
      g.platform = this._hasPlatform();
      if (g.done != null) return;
      g.streak = g.platform && this.sat >= G.sat ? g.streak + 1 : 0;
      if (g.streak < G.days) return;
      g.done = this.day;
      this.msg('🎯 Ziel erreicht: die Plattform steht und ' + G.days + ' Tage in Folge ' + Math.round(G.sat * 100) + ' % zufrieden – morgen um ' + fmtTime(G.launchAt) + ' Uhr startet die erste Kabine', 'star');
      this._diary('goal', 'Ziel erreicht: ' + G.days + ' Tage in Folge ' + Math.round(G.sat * 100) + ' % zufrieden mit der Plattform');
      this._emit('goal', { day: this.day });
    }

    // the launch (once, never again on a load – goal.launched is saved): message, diary, event 'launch', hook onLaunch, launchT for the drawing
    _launch() {
      const g = this.goal, r = this.rooms.find(o => o.type === 'spacestation' && o.platform) || null;
      g.launched = this.day;
      this.launchT = this.day * 86400 + CFG.goal.launchAt;
      this.msg('🚀 Die erste Kabine fährt am Seil ins All', 'star');
      this._diary('launch', 'Die erste Kabine des Weltraumfahrstuhls ist ins All gefahren – der Turm läuft weiter');
      this._emit('launch', { room: r });
      if (this.onLaunch) this.onLaunch();
    }

    // goal line for the star overlay and the header: { platform, streak, days, sat, done, launched, text }
    goalInfo() {
      const G = CFG.goal, g = this.goal, n = Math.min(g.streak, G.days), pc = Math.round(G.sat * 100);
      const text = g.launched != null ? '🚀 Die erste Kabine ist gestartet (Tag ' + g.launched + ') – der Turm läuft weiter'
        : g.done != null ? '🎯 Ziel erreicht – die erste Kabine startet ' + (this.day > g.done ? 'heute' : 'morgen') + ' um ' + fmtTime(G.launchAt) + ' Uhr'
        : 'Ziel: Plattform gebaut · ' + G.days + ' Tage ' + pc + ' % (' + n + ' / ' + G.days + ')';
      return { platform: this._hasPlatform(), streak: n, days: G.days, sat: G.sat, done: g.done, launched: g.launched, text };
    }

    buyUpg(r, key) {
      const c = this.checkUpg(r, key);
      if (!c.ok) return c;
      const U = CFG.incidents.upg[key];
      this.money -= c.cost; r.upg[key] = true;
      this.msg(U.icon + ' ' + U.label + ' eingebaut (−' + c.cost.toLocaleString('de-DE') + ' €, ' + U.upkeep.toLocaleString('de-DE') + ' €/Tag)', 'good');
      this._emit('upgrade', { room: r, upg: key });
      return c;
    }

    // test hook (sim_check, smoke): the incident of `kind` now (f: the floor of a fire or water damage; else the middle
    // of the occupied offices/flats or of the running cars)
    incident(kind, f) { return CFG.incidents.kinds[kind] != null ? this._incident(kind, f ?? null, 0.5) : null; }

    // strikes now. u (0..1) picks the occupied office/flat (fire, water) or the running car (lift) unless f is given
    _incident(kind, f, u) {
      const I = CFG.incidents, res = { kind, f: null, damaged: 0, out: 0, car: null, sec: 0, lift: false };
      const occ = this.rooms.filter(r => isTenantRoom(r) && r.occupied && r.f >= 1);
      const pick = list => list.length ? list[Math.min(list.length - 1, Math.floor((u || 0) * list.length))] : null;
      let text = null;
      if (kind === 'fire') {
        const room = f != null ? this.rooms.find(r => isTenantRoom(r) && r.f === f && r.occupied) || this.rooms.find(r => isTenantRoom(r) && r.f === f) : pick(occ);
        if (!room) return null;
        f = room.f;
        // a fire lift from the EG up to the floor (E14/E59): the firefighters are there at once – only this room
        const lift = this.shafts.some(s => s.kind === 'fire' && s.f0 <= 0 && s.f1 >= f);
        const hit = lift ? [room] : this.rooms.filter(r => isTenantRoom(r) && (this.onFloor(r, f) || this.onFloor(r, f + 1)));
        for (const r of hit) { if (!r.damaged) res.damaged++; r.damaged = true; }
        // everyone in a room on f goes out to the street (not rated)
        for (const p of [...this.persons]) {
          if (p.state !== 'in' || !p.where || p.where.f !== f || p.kind === 'mechanic') continue;
          if (p.visit) this._endVisit(p);
          p.noScore = true; p.scoreRoom = null;
          this._startTrip(p, this._street(p));
          res.out++;
        }
        res.lift = lift;
        text = 'Brand im ' + floorName(f) + (lift ? ' – Feuerwehraufzug war da, nur ein Raum beschädigt'
          : ' – kein Feuerwehraufzug bis hier: ' + res.damaged + (res.damaged === 1 ? ' Raum' : ' Räume') + ' im ' + floorName(f) + ' und ' + floorName(f + 1) + ' beschädigt') + ' – 🔧 Reparieren im Raum';
      } else if (kind === 'water') {
        if (f == null) { const room = pick(occ); if (!room) return null; f = room.f; }
        if (this.hasUpg('leak')) text = 'Leckwarnung im ' + floorName(f) + ' – das Leck ist gestoppt, kein Schaden';
        else {
          const hit = this.rooms.filter(r => isTenantRoom(r) && (this.onFloor(r, f) || this.onFloor(r, f - 1)));
          for (const r of hit) r.wetDay = this.day;
          res.damaged = hit.length;
          text = 'Wasserschaden im ' + floorName(f) + ' – heute keine Miete im ' + floorName(f) + (f - 1 !== 0 ? ' und ' + floorName(f - 1) : '')
            + ' (' + hit.length + (hit.length === 1 ? ' Raum)' : ' Räume)') + ' – 💧 Leckwarnung in der Technikebene hilft';
        }
      } else if (kind === 'lift') {
        const cars = [];
        for (const s of this.shafts) if (!CFG.shafts[s.kind].noRiders) for (const car of s.cars) if (!car.halt) cars.push({ s, car });
        const c = pick(cars);
        if (!c) return null;
        const { s, car } = c;
        f = Math.round(car.y);
        car.wear = 100;
        if (!car.job) { car.job = true; this.today.jobsOpened++; }
        this._breakdown(s, car);
        this._dispatch();
        res.car = car;
        text = 'Aufzugsausfall: ' + this._carName(s, car) + ' steht – Werkstatt oder 🚨 Notdienst';
      } else if (kind === 'outage') {
        const backup = this.hasUpg('backup');
        res.sec = backup ? I.backupSec : I.outageSec;
        this.outageUntil = this.t + res.sec;
        text = 'Stromausfall – ' + (backup ? 'der 🔋 Notstrom springt an, die Aufzüge stehen nur ' + Math.round(res.sec / 60) + ' Min.'
          : 'alle Aufzüge stehen ' + Math.round(res.sec / 60) + ' Min. (🔋 Notstrom in der Technikebene: nur ' + Math.round(I.backupSec / 60) + ' Min.)');
      }
      if (!text) return null;
      res.f = f;
      this.incidents.last = this.day; this.incidents.n++;
      this.incidentToday = { kind, f, t: this.t };
      const icon = { fire: '🔥', water: '💧', lift: '🛗', outage: '⚡' }[kind];
      this.msg(icon + ' ' + text, 'bad');
      this._diary('incident', icon + ' ' + text);
      this._emit('incident', { kind, f });
      if (this.onIncident) this.onIncident(kind, f);
      return res;
    }

    // repairing a damaged room (P3, E20 – a mechanic's way instead of the 60-min. timer): „🔧 Reparieren“ pays now
    // (repairShare of its build price, basement × basementRoom; booked on the room's floor) and opens an order. The
    // workshop's mechanics take the orders after the car jobs, in order, walk to the room and work repairSec there.
    // No open workshop (weekend, after the shift, none built): the emergency service (emergency.cost on top, through the
    // entrance after delaySec). Unfinished in the evening: the order stays and is open again in the morning
    _workshopOpen() { return this.isOpen('workshop') && this.t < CFG.mechanics.shiftEnd && this.rooms.some(r => r.type === 'workshop'); }

    checkRepair(r) {
      const def = CFG.rooms[r.type], res = { ok: false, cost: Math.round(def.cost * (r.f < 0 ? CFG.economy.basementRoom : 1) * CFG.quake.repairShare) };
      if (!r.damaged) { res.reason = 'Nicht beschädigt'; return res; }
      if (r.repairPaid) { res.reason = r.repairEnd ? 'Wird schon repariert' : r.mech ? 'Bezahlt – der Handwerker ist unterwegs' : 'Bezahlt – wartet auf einen freien Handwerker'; return res; }
      if (!this._workshopOpen()) { res.emergency = true; res.cost += CFG.emergency.cost; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    repairRoom(r) {
      const c = this.checkRepair(r);
      if (!c.ok) return c;
      this.money -= c.cost; this.today.repairs += c.cost; this.today.fl[fi(r.f)] -= c.cost;
      r.repairPaid = true; r.paidDay = this.day; r.paidCost = c.cost; r.jobBlock = 0; r.emerg = !!c.emergency;
      if (!this.roomJobs.includes(r)) this.roomJobs.push(r);
      const lb = CFG.rooms[r.type].label + ' ' + floorName(r.f);
      if (c.emergency) {
        this._roomEmergency(r);
        this.msg('🚨 ' + lb + ': keine Werkstatt offen – der Notdienst kommt in ' + Math.round(CFG.emergency.delaySec / 60) + ' Min. (−' + c.cost.toLocaleString('de-DE') + ' €)', 'info');
      } else {
        this.msg('🔧 ' + lb + ': bezahlt, ein Handwerker kommt (−' + c.cost.toLocaleString('de-DE') + ' €, ' + Math.round(CFG.quake.repairSec / 60) + ' Min. Arbeit)', 'info');
        this._dispatch();
      }
      return c;
    }

    // E65: a mechanic on a room order draws from a stream of his own (room, day) while it lasts – the day's stream
    // (exits of everyone else) stays as without the order; back on car jobs he draws from this.rand again (T1 unchanged)
    _ownRng(p, r) { p.rng = mulberry32((this.seed ^ Math.imul(r.id * 7919 + this.day * 104729 + 0x2E9A, 0x9E3779B1)) | 0); p.ownRng = true; }

    // the emergency service for room r: a person of its own, through the entrance after delaySec
    _roomEmergency(r) {
      const p = this._newPerson('mechanic', null);
      p.scoreRoom = null; p.emergency = true; p.rjob = r; p.restUntil = 0;
      r.mech = p; this._ownRng(p, r);
      this._schedule(this.t + CFG.emergency.delaySec, p, 'arrive');
      this.today.emergencies++;
      this._emit('emergency', { room: r });
    }

    // the work is done – the room is whole again, the mechanic goes on (the emergency service out)
    _finishRoomRepair(r, p) {
      if (p) { p.rjob = null; if (!p.emergency) { p.ownRng = false; p.rng = null; } }
      if (this.rooms.includes(r) && r.damaged) {
        // paid today and done today: a mid-day save keeps this payment (serialize(rewind) takes back only the rest)
        if (r.paidDay === this.day) this.today.repairsDone = (this.today.repairsDone || 0) + (r.paidCost || 0);
        r.damaged = false; r.repairEnd = 0; r.repairPaid = false; r.emerg = false; r.mech = null; r.paidCost = 0;
        this.today.roomRepairs = (this.today.roomRepairs || 0) + 1;
        this._clearNeedOut();
        this._emit('repairDone', { room: r });
      }
      this.roomJobs = this.roomJobs.filter(o => o !== r && this.rooms.includes(o) && o.damaged);
      if (!p) return;
      if (p.emergency) this._mechTrip(p, 'out', this._street(p));
      else this._mechHome(p);
    }

    // night: unfinished room repairs go back to open orders (paid); tomorrow morning they are open again
    _roomJobsNight() {
      this.roomJobs = this.roomJobs.filter(r => this.rooms.includes(r) && r.damaged);
      for (const r of this.roomJobs) {
        r.repairEnd = 0; r.jobBlock = 0;
        if (r.mech) { r.mech.rjob = null; r.mech = null; }
      }
    }

    // damper levels via „▲ Aufwerten“: the next level costs its price, its upkeep replaces the one before
    checkDamperUp(r) {
      const L = CFG.rooms.damper.levels, res = { ok: false, level: (r.damperLevel || 1) + 1, cost: 0 };
      if (r.type !== 'damper') { res.reason = 'Nur Schwingungsdämpfer'; return res; }
      if (res.level > L.length) { res.reason = 'Höchste Stufe'; return res; }
      res.cost = L[res.level - 1].cost;
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    upgradeDamper(r) {
      const c = this.checkDamperUp(r);
      if (!c.ok) return c;
      this.money -= c.cost;
      r.damperLevel = c.level;
      this.msg('▲ ' + CFG.rooms.damper.label + ' ' + floorName(r.f) + ': jetzt ' + CFG.rooms.damper.levels[c.level - 1].label + ' (−' + c.cost.toLocaleString('de-DE') + ' €)', 'good');
      this._emit('upgrade', { room: r, tier: c.level });
      return c;
    }

    // ----- merging side by side (★★★, TOWER-a0010 P6, E12/E34) -----
    // name of a tenant room: the tenant type, else „Luxus-Wohnung ×3“ for a merged room without one, else the room type
    roomLabel(r) {
      const T = tenantOf(r), def = CFG.rooms[r.type];
      return T ? T.label : r.whole ? CFG.tiers[2].label + '-Etage' : r.merged > 1 ? CFG.tiers[2].label + '-' + def.label + ' ×' + r.merged : def.label;   // E51: „Luxus-Etage“
    }

    staysForever(r) { const T = tenantOf(r); return !!(T && T.stays); }

    // best felt minutes from room r to a provider of `type` (null = none reachable); E17: a type that is a need's main
    // provider counts every room providing that need (spa: the pool too)
    _provMin(r, type) {
      let best = null;
      const need = Object.keys(CFG.needs).find(k => CFG.needs[k].provider === type);
      for (const p of (need ? this.needProv[need] : this.providers[type]) || []) {
        const m = this._fcMin({ f: r.f, x: r.x + r.w / 2 }, p.f, p.x + p.w / 2, p);
        if (m != null && (best == null || m < best)) best = m;
      }
      return best;
    }

    // which tenant type the surroundings bring into the merged room r now (E12, the order is the check order):
    // { key (CFG.tenants, null = none), why } – deterministic, no random draw
    // E67: explicit branches r.whole (P8) → r.h === 2 → n === 3 → n === 2
    tenantRule(r) {
      const n = r.merged || 1, M = CFG.merge, T = k => CFG.tenants[k].label;
      if (!isTenantRoom(r) || n < 2) return { key: null, why: '' };
      const near = (type, d) => (this.providers[type] || []).some(p => Math.abs(p.f - r.f) <= d && towerOf(p.x) === towerOf(r.x));   // E60: in its tower
      if (r.whole) return this._ruleWhole(r);   // E67: the whole floor first
      if (r.h === 2) return this._ruleFour(r);
      if (r.type === 'office') {
        if (n === 2) {
          const pr = ['clinic', 'passage'].find(t => near(t, M.practice));   // E38: only where a P5 room is near
          if (pr) return { key: 'practice', why: CFG.rooms[pr].label + ' höchstens ' + M.practice + ' Etagen entfernt' };
          return near('cafe', M.cafe) ? { key: 'agency', why: 'Café höchstens ' + M.cafe + ' Etagen entfernt' }
            : { key: 'startup', why: T('agency') + ' bräuchte ein Café höchstens ' + M.cafe + ' Etagen entfernt' };
        }
        if (n !== 3) return { key: null, why: '' };
        if (this.checkFloors && this.checkFloors.has(r.f)) return { key: 'bank', why: 'Schleuse im ' + floorName(r.f) };   // E38: before the call centre
        if ((r.penRaw || 0) > 0) return { key: 'callcenter', why: 'Lärm' + (r.penSrc ? ' von ' + CFG.rooms[r.penSrc.type].label + ' ' + floorName(r.penSrc.f) : '') + ' – ruhige Mieter kommen nicht' };
        const m = this._provMin(r, 'restaurant');
        if (r.f >= M.lawfirmFloor && m != null && m <= M.lawfirmMin) return { key: 'lawfirm', why: 'ruhig, ab ' + M.lawfirmFloor + '. OG, Restaurant ' + Math.round(m) + ' Min.' };
        return { key: 'agency', why: T('lawfirm') + ' bräuchte ' + (r.f < M.lawfirmFloor ? 'mindestens das ' + M.lawfirmFloor + '. OG'
          : m == null ? 'ein erreichbares Restaurant' : 'ein Restaurant in ' + M.lawfirmMin + ' Min. (jetzt ' + Math.round(m) + ')') };
      }
      if (n === 2) return near('daycare', M.daycare) ? { key: 'family', why: 'Kita höchstens ' + M.daycare + ' Etagen entfernt' }
        : { key: 'flatshare', why: T('family') + ' bräuchte eine Kita höchstens ' + M.daycare + ' Etagen entfernt' };
      if (n !== 3) return { key: null, why: '' };
      const top = r.f > this.builtTop() - M.penthouseTop, spa = this._provMin(r, 'spa') != null;
      if (top && spa) return { key: 'penthouse', why: 'ganz oben, Spa erreichbar' };
      const miss = T('penthouse') + ' bräuchte ' + (top ? 'ein erreichbares Spa' : 'die obersten ' + M.penthouseTop + ' Etagen');
      if (near('supermarket', M.supermarket)) return { key: 'seniors', why: 'Supermarkt höchstens ' + M.supermarket + ' Etagen entfernt; ' + miss };
      return { key: null, why: miss + ', ' + T('seniors') + ' einen Supermarkt höchstens ' + M.supermarket + ' Etagen entfernt' };
    }

    // block of four (E37/E38): offices – private stop on its floor → headquarters, checkpoint → embassy, else authority; flats – Kita and spa
    // each at most maisonetteMin felt minutes → maisonette, else artists' loft
    _ruleFour(r) {
      const M = CFG.merge, T = k => CFG.tenants[k].label, fl = floorName(r.f);
      if (r.type === 'office') {
        if (this.privFloors && this.privFloors.has(r.f)) return { key: 'hq', why: '⭐ Privathalt im ' + fl };
        if (this.checkFloors && this.checkFloors.has(r.f)) return { key: 'embassy', why: 'Schleuse im ' + fl + '; ' + T('hq') + ' bräuchte einen ⭐ Privathalt im ' + fl };
        return { key: 'authority', why: T('hq') + ' bräuchte einen ⭐ Privathalt im ' + fl + ', ' + T('embassy') + ' eine Schleuse auf der Etage' };
      }
      const k = this._provMin(r, 'daycare'), s = this._provMin(r, 'spa'), ok = m => m != null && m <= M.maisonetteMin;
      if (ok(k) && ok(s)) return { key: 'maisonette', why: 'Kita ' + Math.round(k) + ' und Spa ' + Math.round(s) + ' Min.' };
      return { key: 'loft', why: T('maisonette') + ' bräuchte Kita und Spa je höchstens ' + M.maisonetteMin + ' Min. (jetzt ' + [['Kita', k], ['Spa', s]].map(([l, m]) => l + ' ' + (m == null ? '–' : Math.round(m))).join(', ') + ')' };
    }

    // whole floor (E51): offices – from merge.whole.agencyFrom with a space station in the tower → space agency (P9, E56), an antenna on air
    // reachable from the floor → studio, checkpoint → ministry; flats – spa, gym, supermarket each
    // at most merge.whole.clanMin felt minutes → clan residence; else none („Luxus-Etage“)
    _ruleWhole(r) {
      const W = CFG.merge.whole, T = k => CFG.tenants[k].label, fl = floorName(r.f);
      if (r.type === 'office') {
        const ss = r.f >= W.agencyFrom && this.rooms.find(o => o.type === 'spacestation' && towerOf(o.x) === towerOf(r.x));
        if (ss) return { key: 'spaceagency', why: CFG.rooms.spacestation.icon + ' ' + CFG.rooms.spacestation.label + ' im Turm (' + floorName(ss.f) + ')' };
        const ant = this.rooms.find(a => a.type === 'antenna' && !a.roofed && towerOf(a.x) === towerOf(r.x) && this._fcMin({ f: r.f, x: r.x + r.w / 2 }, a.f, a.x + a.w / 2) != null);
        if (ant) return { key: 'studio', why: '📡 Antenne im ' + floorName(ant.f) + ' erreichbar' };
        if (this.checkFloors && this.checkFloors.has(r.f)) return { key: 'ministry', why: 'Schleuse im ' + fl + '; ' + T('studio') + ' bräuchte eine erreichbare 📡 Antenne' };
        return { key: null, why: T('studio') + ' bräuchte eine erreichbare 📡 Antenne (nicht überbaut), ' + T('ministry') + ' eine Schleuse im ' + fl + (r.f >= W.agencyFrom ? ', ' + T('spaceagency') + ' eine ' + CFG.rooms.spacestation.label + ' im Turm' : '') };
      }
      const m = ['spa', 'gym', 'supermarket'].map(t => [t, this._provMin(r, t)]), ok = m.every(([, v]) => v != null && v <= W.clanMin);
      if (ok) return { key: 'clan', why: m.map(([t, v]) => CFG.rooms[t].label + ' ' + Math.round(v)).join(', ') + ' Min.' };
      return { key: null, why: T('clan') + ' bräuchte Spa, Fitness und Supermarkt je höchstens ' + W.clanMin + ' Min. (jetzt ' + m.map(([t, v]) => CFG.rooms[t].label + ' ' + (v == null ? '–' : Math.round(v))).join(', ') + ')' };
    }

    // whole floor (★★★★★, E51/E67): from a luxury 3er – every tenant room of the floor in its tower of the same kind, all luxury, without a warning,
    // side by side without a gap, nothing else on the floor; offices 5–6, flats 6–8 rooms (Σ merged). With the preview like checkMerge; costs
    // merge.whole.share of the build prices of the rooms not merged before
    checkWhole(r) {
      const res = { ok: false, cost: 0, dir: 'whole' }, W = CFG.merge.whole;
      if (!isTenantRoom(r)) { res.reason = 'Nur Büros und Wohnungen'; return res; }
      if (r.whole) { res.reason = 'Schon eine ganze Etage'; return res; }
      if ((r.merged || 1) !== 3 || r.h === 2) { res.reason = 'Nur von einem 3er aus (drei zusammengelegte Räume)'; return res; }
      const def = CFG.rooms[r.type], t = towerOf(r.x), kinds = r.type === 'office' ? 'Büros' : 'Wohnungen';
      // Setzung P8: a checkpoint may stand on the floor (the ministry needs one there), nothing else
      const on = this.floorRooms[fi(r.f)].filter(o => towerOf(o.x) === t && o.type !== 'checkpoint'), other = on.find(o => o.type !== r.type || o.h === 2);
      if (other) { res.reason = 'Auf der Etage steht noch ' + (other.h === 2 ? 'ein Viererblock' : CFG.rooms[other.type].label) + ' – die ganze Etage nur aus ' + kinds; return res; }
      const rooms = on.slice().sort((a, b) => a.x - b.x);
      for (let i = 1; i < rooms.length; i++) if (rooms[i].x !== rooms[i - 1].x + rooms[i - 1].w) { res.reason = 'Die ' + kinds + ' müssen lückenlos nebeneinander stehen'; return res; }
      const n = rooms.reduce((a, o) => a + (o.merged || 1), 0), [lo, hi] = W[r.type];
      res.n = n; res.others = rooms.filter(o => o !== r);
      if (n < lo || n > hi) { res.reason = 'Ganze Etage: ' + lo + '–' + hi + ' ' + kinds + ' (hier ' + n + ')'; return res; }
      if (this.stars < W.star) { res.reason = 'Ganze Etage erst ab ' + '★'.repeat(W.star); return res; }
      if (rooms.some(o => (o.tier || 0) < 2)) { res.reason = 'Alle ' + kinds + ' der Etage müssen ' + CFG.tiers[2].label + ' sein'; return res; }
      if (rooms.some(o => o.damaged)) { res.reason = 'Erst reparieren'; return res; }
      if (rooms.some(o => this.warnLevel(o))) { res.reason = 'Nicht mit Warnung ⚠'; return res; }
      res.cost = Math.round(def.cost * W.share * rooms.filter(o => (o.merged || 1) <= 1).length);
      const x = rooms[0].x, w = rooms.reduce((a, o) => a + o.w, 0);
      const room = { type: r.type, f: r.f, x, w, tier: 2, merged: n, whole: true, tenantType: null, meas: {}, penRaw: 0, penSrc: null };
      for (let g = Math.max(CFG.MIN_FLOOR, r.f - 2); g <= Math.min(CFG.MAX_FLOOR, r.f + 2); g++) for (const q of this.floorRooms[fi(g)]) {
        if (!CFG.noise[q.type]) continue;
        const v = penaltyRaw(q.type, q.f, q.x, q.w, room);
        if (v > room.penRaw) { room.penRaw = v; room.penSrc = q; }
      }
      const rule = this.tenantRule(room);
      room.tenantType = rule.key;
      Object.assign(res, { x, w, tenantType: rule.key, why: rule.why, label: this.roomLabel(room), needs: needsOf(room), people: capOf(room),
        rentBefore: rooms.reduce((a, o) => a + this.potentialRent(o), 0), rent: this.potentialRent(room), forecast: this._forecast(room, 2) });
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    // the floor becomes one room (r stays, the others go); the tenants of all move out without a rating (like merge), new ones move in softly
    mergeWhole(r) {
      const c = this.checkWhole(r);
      if (!c.ok) return c;
      this.money -= c.cost;
      for (const o of [r, ...c.others]) for (const p of o.people.slice()) this._kill(p);
      this.rooms = this.rooms.filter(o => !c.others.includes(o));
      Object.assign(r, { x: c.x, w: c.w, merged: c.n, whole: true, tenantType: c.tenantType, occupied: false, score: null, tenancy: (r.tenancy || 0) + 1,
        warnDays: 0, warnCause: null, warn: 0, meas: {}, nd: {}, fulfil: null, needOut: false, inside: 0, people: [], shaken: 0, wxDrop: 0, wxKind: null,
        tripSum: 0, tripN: 0, eSum: 0, eN: 0, eLast: null, failN: 0, fc: null, fcGen: -1, fcShares: null });
      this._afterChange();
      const text = 'Ganze Etage ' + floorName(r.f) + ': ' + c.n + ' ' + (r.type === 'office' ? 'Büros' : 'Wohnungen') + ' → ' + c.label;
      this.msg('⇔ ' + text + ' (−' + c.cost.toLocaleString('de-DE') + ' €)', 'good');
      this._diary('merge', text);
      this._emit('merge', { room: r });
      return c;
    }

    // room r stands on floor f (E37: a block of four on f and f + 1)
    onFloor(r, f) { return r.f === f || (r.h === 2 && r.f + 1 === f); }

    // block of four (★★★★, E37/E67): r a luxury 2er and directly above it (f + 1, same x, same width, same kind) a luxury 2er – one room over
    // both floors (merged 4, h 2). With the preview like checkMerge; costs vertShare of the four build prices
    checkMergeUp(r) {
      const res = { ok: false, cost: 0, dir: 'up' }, M = CFG.merge;
      if (!isTenantRoom(r)) { res.reason = 'Nur Büros und Wohnungen'; return res; }
      const def = CFG.rooms[r.type], kind = r.type === 'office' ? 'Büro' : 'Wohnung';
      if (r.h === 2) { res.reason = 'Schon ein Viererblock'; return res; }
      if ((r.merged || 1) !== 2) { res.reason = 'Nur ein 2er (zwei zusammengelegte Räume) mit dem 2er direkt darüber'; return res; }
      const up = r.f < CFG.MAX_FLOOR ? this.grid[fi(r.f + 1)][r.x] : null;
      if (!up || up.f !== r.f + 1 || up.type !== r.type || up.x !== r.x || up.w !== r.w || (up.merged || 1) !== 2 || up.h) { res.reason = 'Darüber steht kein 2er-' + kind + ' genau gleich breit'; return res; }
      res.other = up; res.n = 4;
      if (this.stars < M.vertStar) { res.reason = 'Viererblock erst ab ' + '★'.repeat(M.vertStar); return res; }
      if ((r.tier || 0) < 2 || (up.tier || 0) < 2) { res.reason = 'Beide müssen ' + CFG.tiers[2].label + ' sein'; return res; }
      if (r.damaged || up.damaged) { res.reason = 'Erst reparieren'; return res; }
      if (this.warnLevel(r) || this.warnLevel(up)) { res.reason = 'Nicht mit Warnung ⚠'; return res; }
      res.cost = Math.round(def.cost * M.vertShare * 4);
      const room = { type: r.type, f: r.f, x: r.x, w: r.w, h: 2, tier: 2, merged: 4, tenantType: null, meas: {}, penRaw: 0, penSrc: null };
      for (let g = Math.max(CFG.MIN_FLOOR, r.f - 2); g <= Math.min(CFG.MAX_FLOOR, r.f + 3); g++) for (const s of this.floorRooms[fi(g)]) {
        if (!CFG.noise[s.type]) continue;
        const v = penaltyRaw(s.type, s.f, s.x, s.w, room);
        if (v > room.penRaw) { room.penRaw = v; room.penSrc = s; }
      }
      const rule = this.tenantRule(room);
      room.tenantType = rule.key;
      Object.assign(res, { x: r.x, w: r.w, tenantType: rule.key, why: rule.why, label: this.roomLabel(room), needs: needsOf(room), people: capOf(room),
        rentBefore: this.potentialRent(r) + this.potentialRent(up), rent: this.potentialRent(room), forecast: this._forecast(room, 2) });
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    // the two 2er become the block of four: the lower room stays (entrance and destination below), the upper one goes; the tenants of both
    // move out without a rating (like merge), new ones move in softly
    mergeUp(r) {
      const c = this.checkMergeUp(r);
      if (!c.ok) return c;
      const up = c.other;
      this.money -= c.cost;
      for (const o of [r, up]) for (const p of o.people.slice()) this._kill(p);
      this.rooms = this.rooms.filter(o => o !== up);
      Object.assign(r, { merged: 4, h: 2, tenantType: c.tenantType, occupied: false, score: null, tenancy: (r.tenancy || 0) + 1,
        warnDays: 0, warnCause: null, warn: 0, meas: {}, nd: {}, fulfil: null, needOut: false, inside: 0, people: [], shaken: 0, wxDrop: 0, wxKind: null,
        tripSum: 0, tripN: 0, eSum: 0, eN: 0, eLast: null, failN: 0, fc: null, fcGen: -1, fcShares: null });
      this._afterChange();
      const text = '4 ' + (r.type === 'office' ? 'Büros' : 'Wohnungen') + ' ' + floorName(r.f) + '–' + floorName(r.f + 1) + ' zum Viererblock → ' + c.label;
      this.msg('⇕ ' + text + ' (−' + c.cost.toLocaleString('de-DE') + ' €)', 'good');
      this._diary('merge', text);
      this._emit('merge', { room: r });
      this._milestone('merge');
      return c;
    }

    // a vacant merged room takes the type the surroundings bring now (occupied ones keep theirs, E34)
    _retype(r) {
      const k = this.tenantRule(r).key;
      if (k === (r.tenantType || null)) return;
      r.tenantType = k; r.fcGen = -1; r.pen = Math.min(1, (r.penRaw || 0) * penaltySens(r));
    }
    _retypeVacant() { for (const r of this.rooms) if (r.merged > 1 && !r.occupied) this._retype(r); }

    // can r be merged with its direct neighbour on side dir (−1 left, +1 right)? With the preview of the room it would
    // become: n rooms, tenantType + why + label, needs, people, rent before (both rooms) and after, forecast, cost
    checkMerge(r, dir) {
      const res = { ok: false, cost: 0, dir }, M = CFG.merge;
      if (!isTenantRoom(r)) { res.reason = 'Nur Büros und Wohnungen'; return res; }
      const def = CFG.rooms[r.type], xn = dir < 0 ? r.x - 1 : r.x + r.w;
      const nb = xn >= 0 && xn < CFG.W ? this.grid[fi(r.f)][xn] : null;
      if (!nb || nb.type !== r.type) { res.reason = (r.type === 'office' ? 'Kein Büro' : 'Keine Wohnung') + ' direkt ' + (dir < 0 ? 'links' : 'rechts'); return res; }
      res.other = nb; res.n = (r.merged || 1) + (nb.merged || 1);
      if (this.stars < M.star) { res.reason = 'Zusammenlegen erst ab ' + '★'.repeat(M.star); return res; }
      if (res.n > M.max) { res.reason = 'Höchstens ' + M.max + ' Räume zusammen'; return res; }
      if ((r.tier || 0) < 2 || (nb.tier || 0) < 2) { res.reason = 'Beide müssen ' + CFG.tiers[2].label + ' sein'; return res; }
      if (r.damaged || nb.damaged) { res.reason = 'Erst reparieren'; return res; }
      if (this.warnLevel(r) || this.warnLevel(nb)) { res.reason = 'Nicht mit Warnung ⚠'; return res; }
      // E41: only the rooms not merged yet are paid (a 3er costs share × 3 build prices in all, whichever way it was put together)
      res.cost = Math.round(def.cost * M.share * ((r.merged > 1 ? 0 : 1) + (nb.merged > 1 ? 0 : 1)));
      const x = Math.min(r.x, nb.x), w = r.w + nb.w;
      const room = { type: r.type, f: r.f, x, w, tier: 2, merged: res.n, tenantType: null, meas: {}, penRaw: 0, penSrc: null };
      for (let g = Math.max(CFG.MIN_FLOOR, r.f - 2); g <= Math.min(CFG.MAX_FLOOR, r.f + 2); g++) for (const s of this.floorRooms[fi(g)]) {
        if (!CFG.noise[s.type]) continue;
        const v = penaltyRaw(s.type, s.f, s.x, s.w, room);
        if (v > room.penRaw) { room.penRaw = v; room.penSrc = s; }
      }
      const rule = this.tenantRule(room);
      room.tenantType = rule.key;
      Object.assign(res, { x, w, tenantType: rule.key, why: rule.why, label: this.roomLabel(room), needs: needsOf(room), people: capOf(room),
        rentBefore: this.potentialRent(r) + this.potentialRent(nb), rent: this.potentialRent(room), forecast: this._forecast(room, 2) });
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    // merge r with its neighbour: one room (w = sum, merged = n, tenantType), the old tenants go without a rating
    // (like a demolition), new ones move in softly as usual; no way back but a demolition (shell in full width)
    merge(r, dir) {
      const c = this.checkMerge(r, dir);
      if (!c.ok) return c;
      const nb = c.other;
      this.money -= c.cost;
      for (const o of [r, nb]) for (const p of o.people.slice()) this._kill(p);
      this.rooms = this.rooms.filter(o => o !== nb);
      Object.assign(r, { x: c.x, w: c.w, merged: c.n, tenantType: c.tenantType, occupied: false, score: null, tenancy: (r.tenancy || 0) + 1,
        warnDays: 0, warnCause: null, warn: 0, meas: {}, nd: {}, fulfil: null, needOut: false, inside: 0, people: [], shaken: 0,
        tripSum: 0, tripN: 0, eSum: 0, eN: 0, eLast: null, failN: 0, fc: null, fcGen: -1, fcShares: null });
      this._afterChange();
      const text = c.n + ' ' + (r.type === 'office' ? 'Büros' : 'Wohnungen') + ' ' + floorName(r.f) + ' zusammengelegt → ' + c.label;
      this.msg('⇔ ' + text + ' (−' + c.cost.toLocaleString('de-DE') + ' €)', 'good');
      this._diary('merge', text);
      this._emit('merge', { room: r });
      this._milestone('merge');
      return c;
    }

    // ----- money -----
    // E60: floor f has floor in tower t (undefined = in either tower; the gap with a bridge belongs to neither)
    floorUsed(f, t) {
      if (f === 0) return false;   // the lobby costs nothing
      if (t == null) return this.floorUsed(f, 0) || this.floorUsed(f, 1);
      const row = this.seg[fi(f)], [a, b] = towerSpan(t ? CFG.TWIN_X : 0);
      for (let x = a; x < b; x++) if (row[x] >= 0) return true;
      return false;
    }

    floorUpkeep(f) {
      const E = CFG.economy;
      if (f < 0) return Math.round(E.floorUpkeep * (E.basementUpkeep.base + E.basementUpkeep.perFloor * -f));   // basement: by depth
      return Math.min(E.floorUpkeepCap, Math.round(E.floorUpkeep * (1 + E.floorUpkeepStep * Math.floor(f / E.floorBlock))));
    }

    // height factor of the rent of offices and flats (E5): 1 up to heightRent.from, then + per for each floor above
    heightRentK(r) {
      const H = CFG.economy.heightRent;
      return r.f > H.from && (r.type === 'office' || r.type === 'condo') ? 1 + H.per * (r.f - H.from) : 1;
    }

    // rent at full fulfilment: standard rent × tier factor
    // P6: a merged room pays the rent of all its rooms × the factor of its tenant type
    // noHeight (P6 fog, E76): without the height surcharge – only the day's booking asks for it
    potentialRent(r, tier, noHeight) {
      const T = tenantOf(r);
      return Math.round((CFG.rooms[r.type].rent || 0) * CFG.tiers[tier ?? r.tier ?? 0].rent * (r.merged || 1) * ((T && T.rent) || 1) * (noHeight ? 1 : this.heightRentK(r)) * this.privK(r) * this.checkK(r, tier) * this.coolK(r) * (r.roofed && CFG.rooms[r.type].open ? 0 : 1));   // E73: a built-over antenna
    }

    // E36 server: a plant floor at most def.cool floors away in its tower (cooling) – null = no server / none
    coolingFor(r) {
      const d = CFG.rooms[r.type].cool;
      if (d == null) return null;
      let best = null;
      for (const t of this.rooms) if (t.type === 'tech' && Math.abs(t.f - r.f) <= d && towerOf(t.x) === towerOf(r.x) && (!best || Math.abs(t.f - r.f) < Math.abs(best.f - r.f))) best = t;
      return best;
    }
    coolK(r) { return CFG.rooms[r.type].cool != null ? (this.coolingFor(r) ? 1 : 0.5) * this.powerK : 1; }   // E52: server rent × powerK

    // extra upkeep per day of an upgraded room (share of the standard rent, also when vacant)
    tierUpkeep(r) { return Math.round((CFG.rooms[r.type].rent || 0) * CFG.tiers[r.tier || 0].upkeep * (r.merged || 1)); }

    // P3: water damage today; P6 (E33/E76): fog above the cloud line – luxury without the height surcharge today
    rentOf(r) { return r.damaged || r.wetDay === this.day ? 0 : Math.round(this.potentialRent(r, undefined, this.fogged(r)) * (r.fulfil ?? 1)); }

    // upkeep per day of a room: the damper by its level (P5), else CFG
    roomUpkeep(r) {
      const def = CFG.rooms[r.type];
      const up = r.upg ? Object.keys(r.upg).reduce((a, k) => a + (r.upg[k] && CFG.incidents.upg[k] ? CFG.incidents.upg[k].upkeep : 0), 0) : 0;   // P3 plant-floor upgrades
      return (r.type === 'damper' ? def.levels[(r.damperLevel || 1) - 1].upkeep : def.upkeep || 0) + up;
    }

    canLoan() { return this.loan < CFG.economy.loanMax && this.negDays < CFG.economy.loanBlockDays; }

    takeLoan() {
      const E = CFG.economy;
      if (this.loan >= E.loanMax) return { ok: false, reason: 'Höchstens ' + E.loanMax.toLocaleString('de-DE') + ' € Kredit' };
      if (this.negDays >= E.loanBlockDays) return { ok: false, reason: 'Kredit gesperrt: ' + E.loanBlockDays + ' Tage in Folge Verlust' };
      this.loan += E.loanStep; this.money += E.loanStep;
      this.msg('Kredit +' + E.loanStep.toLocaleString('de-DE') + ' € (Zins ' + Math.round(E.loanRate * 100) + ' % je Tag)', 'info');
      return { ok: true, amount: E.loanStep };
    }

    repayLoan(amount) {
      const a = Math.min(amount == null ? this.loan : amount, this.loan, Math.max(0, Math.floor(this.money)));
      if (this.loan <= 0) return { ok: false, reason: 'Kein Kredit offen' };
      if (a <= 0) return { ok: false, reason: 'Zu wenig Geld' };
      this.loan -= a; this.money -= a;
      return { ok: true, amount: a };
    }

    // net of floor f yesterday (null before the first evening); floorNet is indexed with fi(f)
    floorNetAt(f) { return this.floorNet ? this.floorNet[fi(f)] ?? 0 : null; }

    // heatmap "Geld": the net of the room's floor yesterday (works for shell pieces {f, …} too)
    moneyStatus(r) {
      if (!this.floorNet) return 'none';
      const v = this.floorNet[fi(r.f)], E = CFG.economy;
      if (Math.abs(v) < E.heatEven) return 'even';
      if (v < 0) return v > -E.heatStrong ? 'lossLow' : 'loss';
      return v < E.heatStrong ? 'gainLow' : 'gain';
    }

    // ----- needs, penalties, tiers (P2) -----
    needsOf(r, tier) { return needsOf(r, tier); }
    capOf(r) { return capOf(r); }

    // evening: today's samples become the measurement (no sample today = yesterday's value, never
    // measured = forecast, P2.4); fulfilment = mean of the needs (none = 1) × (1 − penalty)
    _settleNeeds(r) {
      const needs = needsOf(r);
      for (const n of needs) {
        const a = r.nd[n];
        if (a && a.n) r.meas[n] = { v: a.s / a.n, min: a.mn ? a.m / a.mn : null };
      }
      const fc = needs.some(n => !r.meas[n]) ? this.forecast(r, r.tier) : null;
      let sum = 0;
      for (const n of needs) sum += r.meas[n] ? r.meas[n].v : fc.needs.find(x => x.need === n).share;
      r.fulfil = (needs.length ? sum / needs.length : 1) * (1 - r.pen) * (r.shaken > 0 ? 1 - CFG.quake.satDrop : 1) * (r.wxDrop ? 1 - r.wxDrop : 1);   // E76 ice tonight
    }

    // what pulls the room down most: a need (measured, else forecast) or the penalty – as text
    needReason(r) {
      const needs = needsOf(r), fc = this.forecast(r, r.tier);
      let worst = null, wl = r.pen;
      for (const e of fc.needs) {
        const m = r.meas[e.need], v = m ? m.v : e.share, loss = (1 - v) / needs.length;
        if (loss > wl || (!worst && loss > 0 && loss >= wl)) { wl = loss; worst = { e, m }; }
      }
      if (!worst && r.wxDrop > 0 && r.pen <= 0) return (r.wxKind === 'storm' ? 'Sturm (−' + Math.round(r.wxDrop * 100) + ' % heute) – 🌀 Schwingungsdämpfer hilft' : 'Eis an der Fassade (−' + Math.round(r.wxDrop * 100) + ' % heute) – 🚡 Fassadengondel hilft' + (r.wxKind === 'both' ? ', gegen den Sturm 🌀 Dämpfer' : ''));   // E76/E49
      if (!worst && r.shaken > 0 && r.pen <= 0) return 'Schreck nach dem Beben (−' + Math.round(CFG.quake.satDrop * 100) + ' %, noch ' + r.shaken + (r.shaken > 1 ? ' Tage)' : ' Tag)');
      if (!worst) return r.pen > 0 && r.penSrc ? 'Lärm von ' + CFG.rooms[r.penSrc.type].label + ' ' + floorName(r.penSrc.f) + ' (−' + Math.round(r.pen * 100) + ' %)' : 'alles gut';
      const { e, m } = worst;
      if (m && m.min != null) return (e.type === 'street' ? 'Weg zur Straße' : CFG.rooms[e.type].label) + ' jetzt ' + Math.round(m.min) + ' Min.';
      if (m) return CFG.needs[e.need].label + ': ' + (e.min == null ? e.reason : 'kein Besuch geschafft');
      return e.reason;
    }

    // forecast minutes from a point to (f, x); a provider adds yesterday's Ø wait in its queue
    _fcMin(from, f, x, prov) {
      const pl = this._plan(from.f, from.x, false, CFG.energy.ref, { f, x }, false, true);
      return pl ? pl.cost + (prov ? prov.lastQ : 0) : null;
    }

    // forecast share a provider gives for m minutes: those who gave up in its queue yesterday got 0
    _provShare(m, prov) { return m == null ? 0 : needShare(m) * (1 - (prov.lastGU || 0)) * (prov.roofed ? 0.5 : 1); }

    _needForecast(r, need) {
      const N = CFG.needs[need], def = CFG.rooms[N.provider], list = this.needProv[need] || [];   // E17: all providers of the need
      const from = N.from === 'entrance' ? { f: 0, x: this._streetX(r.x) } : { f: r.f, x: r.x + r.w / 2 };
      let best = null, bm = Infinity, bs = -1, street = false;
      for (const p of list) {
        const m = this._fcMin(from, p.f, p.x + p.w / 2, p), sh = this._provShare(m, p);
        if (m != null && (sh > bs || (sh === bs && m < bm))) { bm = m; bs = sh; best = p; }
      }
      if (N.street) {
        const m = this._fcMin(from, 0, this._streetX(r.x)), sh = needShare(m);
        if (m != null && (sh > bs || (sh === bs && m < bm))) { bm = m; bs = sh; best = null; street = true; }
      }
      const min = bm < Infinity ? bm : null, meas = r.meas && r.meas[need];
      const reason = min == null ? def.no + (list.length ? ' erreichbar' : ' gebaut')
        : (street ? 'Straße' : CFG.rooms[best ? best.type : N.provider].label) + ' ' + Math.round(min) + ' Min.';
      return { need, type: street ? 'street' : best ? best.type : N.provider, min, share: min == null ? 0 : bs, measured: meas ? meas.v : null,
        measuredMin: meas ? meas.min : null, provider: best, reason };
    }

    _forecast(r, tier) {
      const needs = needsOf(r, tier).map(n => this._needForecast(r, n));
      const pen = Math.min(1, (r.penRaw || 0) * penaltySens(r, tier));
      const mean = needs.length ? needs.reduce((a, e) => a + e.share, 0) / needs.length : 1;
      return { fulfil: mean * (1 - pen), pen, needs };
    }

    // forecast of the fulfilment on a tier: routing with yesterday's measured waits, fresh energy (P2.1);
    // cached per room until the structure changes or the day ends
    forecast(r, tier) {
      tier = tier ?? r.tier ?? 0;
      if (r.fcGen !== this.fcGen) { r.fc = []; r.fcGen = this.fcGen; r.fcShares = null; }
      return r.fc[tier] || (r.fc[tier] = this._forecast(r, tier));
    }

    // forecast for a room that is not built yet (ghost): null if there is no floor to walk on yet
    forecastAt(type, tier, f, x) {
      const def = CFG.rooms[type];
      if (!def || !isTenantRoom({ type })) return null;
      x = clampTower(x, def.w);
      if (!this.walkable(f, x + def.w / 2)) return null;
      const r = { type, f, x, w: def.w, tier: tier || 0, meas: {}, penRaw: 0 };
      for (let g = Math.max(CFG.MIN_FLOOR, f - 2); g <= Math.min(CFG.MAX_FLOOR, f + 2); g++) for (const s of this.floorRooms[fi(g)]) {
        if (CFG.noise[s.type]) r.penRaw = Math.max(r.penRaw, penaltyRaw(s.type, s.f, s.x, s.w, r));
      }
      return this._forecast(r, r.tier);
    }

    // every provider (and the street) for each need of r: share 0..1 of what it would give, null = unreachable
    providerShares(r) {
      if (!isTenantRoom(r)) return [];
      this.forecast(r);   // validates the cache generation
      if (r.fcShares) return r.fcShares;
      const out = [];
      for (const need of needsOf(r)) {
        const N = CFG.needs[need];
        const from = N.from === 'entrance' ? { f: 0, x: this._streetX(r.x) } : { f: r.f, x: r.x + r.w / 2 };
        for (const p of this.needProv[need] || []) {
          const m = this._fcMin(from, p.f, p.x + p.w / 2, p);
          out.push({ room: p, need, share: m == null ? null : this._provShare(m, p), min: m });
        }
        if (N.street) { const m = this._fcMin(from, 0, this._streetX(r.x)); out.push({ room: null, need, share: m == null ? null : needShare(m), min: m }); }
      }
      return (r.fcShares = out);
    }

    // penalty sources that reach room r (after its sensitivity), strongest first
    penaltySources(r) {
      const out = [];
      if (!isTenantRoom(r)) return out;
      for (let g = Math.max(CFG.MIN_FLOOR, r.f - 2); g <= Math.min(CFG.MAX_FLOOR, r.f + 2); g++) for (const s of this.floorRooms[fi(g)]) {
        if (!CFG.noise[s.type]) continue;
        const v = penaltyRaw(s.type, s.f, s.x, s.w, r);
        if (v > 0) out.push({ room: s, pen: Math.min(1, v * penaltySens(r)) });
      }
      return out.sort((a, b) => b.pen - a.pen);
    }

    // rooms a disturber of `type` at (f, x) would reach (ghost while building)
    penaltyArea(type, f, x) {
      const def = CFG.rooms[type], out = [];
      if (!def || !CFG.noise[type]) return out;
      x = type === 'bridge' ? CFG.TW : clampTower(x, def.w);   // qa-P7 F1: like checkRoom – the bridge fills the gap
      for (let g = Math.max(CFG.MIN_FLOOR, f - 2); g <= Math.min(CFG.MAX_FLOOR, f + 2); g++) for (const r of this.floorRooms[fi(g)]) {
        if (!isTenantRoom(r) || (r.h === 2 && g === r.f + 1 && r.f >= f - 2)) continue;   // E67: a block of four once
        const v = penaltyRaw(type, f, x, def.w, r);
        if (v > 0) out.push({ room: r, pen: Math.min(1, v * penaltySens(r)) });
      }
      return out;
    }

    // heatmap "Bedürfnisse": occupied rooms by their fulfilment, vacant ones by the forecast
    needStatus(r) {
      if (!isTenantRoom(r)) return 'none';
      const v = r.occupied && r.fulfil != null ? r.fulfil : this.forecast(r).fulfil, H = CFG.needHeat;
      return needWarn(v) ? 'bad' : v >= H.good ? 'good' : 'ok';
    }

    // heatmap "Lärm": penalty of the room after its sensitivity
    noiseStatus(r) {
      if (!isTenantRoom(r)) return 'none';
      const H = CFG.noiseHeat;
      return r.pen < H.ok ? 'good' : r.pen < H.bad ? 'ok' : 'bad';
    }

    // occupied luxury rooms (tier 2) for the ★★★ goal and the milestone (E25): a merged room counts merged-fold
    // (P6), a hotel round(occupancy last night × 2) – full = 2 luxury rooms
    luxuryRooms() {
      let n = 0;
      for (const r of this.rooms) {
        if (isTenantRoom(r)) { if (r.occupied && r.tier >= 2) n += r.merged || 1; }
        else if (r.type === 'hotel') n += Math.round((r.lastOcc || 0) * 2);
      }
      return n;
    }

    upgradedRooms() { let n = 0; for (const r of this.rooms) if (isTenantRoom(r) && r.occupied && r.tier >= 1) n++; return n; }

    // active upgrade (concept 5): costs upgradeShare of the build price, needs the star, no way back
    checkUpgrade(r) {
      const res = { ok: false, cost: 0, tier: (r.tier || 0) + 1 };
      if (!isTenantRoom(r)) { res.reason = 'Nur Büros und Wohnungen'; return res; }
      if (r.damaged) { res.reason = 'Erst reparieren'; return res; }
      const T = CFG.tiers[res.tier];
      if (!T) { res.reason = 'Höchste Stufe'; return res; }
      res.cost = Math.round(CFG.rooms[r.type].cost * CFG.upgradeShare);
      if (T.star > this.stars) { res.reason = T.label + ' erst ab ' + '★'.repeat(T.star); return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    upgrade(r) {
      const c = this.checkUpgrade(r);
      if (!c.ok) return c;
      this._doUpgrade(r, c);
      this._afterUpgrade();
      this.msg('▲ ' + CFG.rooms[r.type].label + ' ' + floorName(r.f) + ' ist jetzt ' + CFG.tiers[r.tier].label + ' (−' + c.cost.toLocaleString('de-DE') + ' €)', 'good');
      return c;
    }

    _doUpgrade(r, c) {
      this.money -= c.cost;
      r.tier = c.tier;
      r.pen = Math.min(1, r.penRaw * penaltySens(r));
      this._emit('upgrade', { room: r, tier: r.tier });
      if (this.milestones.upgrade == null) this._milestone('upgrade');
    }

    _afterUpgrade() { this.fcCache = new Map(); this.fcGen++; this._clearNeedOut(); this._checkMilestones(); }

    // whole floor: every office and flat on the lowest tier there goes up one step
    checkUpgradeFloor(f) {
      const rs = this.rooms.filter(r => r.f === f && isTenantRoom(r));
      const res = { ok: false, cost: 0, n: 0, rooms: [] };
      if (!rs.length) { res.reason = 'Keine Büros oder Wohnungen'; return res; }
      const low = Math.min(...rs.map(r => r.tier || 0));
      let reason = null;
      for (const r of rs) {
        if ((r.tier || 0) !== low) continue;
        const c = this.checkUpgrade(r);
        if (!c.ok && c.reason !== 'Zu wenig Geld') { reason = c.reason; continue; }
        res.rooms.push(r); res.cost += c.cost; res.n++;
      }
      if (!res.n) { res.reason = reason || 'Nichts aufzuwerten'; return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    upgradeFloor(f) {
      const c = this.checkUpgradeFloor(f);
      if (!c.ok) return c;
      for (const r of c.rooms) this._doUpgrade(r, this.checkUpgrade(r));
      this._afterUpgrade();
      this.msg('▲ ' + floorName(f) + ': ' + c.n + ' Räume aufgewertet (−' + c.cost.toLocaleString('de-DE') + ' €)', 'good');
      return c;
    }

    // a structure change lets rooms that moved out for needs take tenants again (if the forecast agrees)
    _clearNeedOut() { for (const r of this.rooms) r.needOut = false; }

    // ----- day cycle -----
    // today's counters; fl = net per floor so far (sales and repairs during the day, the rest in the evening)
    _newToday() {
      return { rent: 0, guests: 0, waitSum: 0, waitN: 0, sales: 0, repairs: 0, fl: new Float64Array(nFloors()),
        jobs: 0, jobsOpened: 0, breakdowns: 0, emergencies: 0, mechApp: [], mechFails: 0, visits: 0, visitFails: 0, visitGiveUps: 0,
        movedOut: 0, movedNeeds: 0 };
    }

    _startDay() {
      this.rand = mulberry32(this.seed + this.day * 7919);
      this.t = CFG.DAY_START;
      this.events = new Heap();
      this.walking.clear(); this.climbing.clear();
      // P5: today's quake is drawn now (own stream, no this.rand) and strikes at its hour (step)
      this.quakeToday = null;
      this._quakePlan = this.quakeDraw(this.day);
      // P3 (E19/E72): today's incident from its own stream, struck at its hour (step); the outage ends with the night
      this.incidentToday = null; this.outageUntil = 0;
      this._incPlan = this.incidentDraw(this.day);
      this._applyWeather(this.weatherDraw(this.day));   // P6 (E33): today's weather above the cloud line, own stream
      this._updatePower();   // P8 (E52): wind turbines stand still in a storm
      for (const l of this.links) l.used = 0;
      // hotel guests stay over night; who never checked in or was checking out is gone
      for (const p of [...this.persons]) if (p.kind === 'visitor' || p.emergency || p.mover || (p.kind === 'hotelguest' && (!p.guest || p.checkout))) this._kill(p);
      // maintenance: no mechanic is on the way in the morning; open jobs again from the wear
      let graph = false;
      for (const s of this.shafts) {
        for (let i = 0; i < s.qUp.length; i++) { s.qUp[i] = []; s.qDown[i] = []; }
        for (const car of s.cars) {
          car.pax = []; car.state = 'idle'; car.dir = 0; car.target = null;
          car.mech = null; car.fix = null; car.emerg = false; car.jobBlock = 0;
          car.job = car.wear >= this.serviceAt;
          this._setCond(car);
        }
        const n = s.cars.reduce((a, c) => a + (c.halt ? 0 : 1), 0);
        if ((n > 0) !== (s.running > 0)) graph = true;
        s.running = n;
        s.waitSum = 0; s.waitN = 0;
      }
      if (graph) this._structureChanged();
      this.today = this._newToday();
      const R = this.rand;
      for (const r of this.rooms) { r.tripSum = 0; r.tripN = 0; r.inside = 0; r.eSum = 0; r.eN = 0; r.failN = 0; r.queue = []; r.nd = {}; r.vN = 0; if (CFG.rooms[r.type].spaces) { r.users = 0; r.parked = 0; } }
      this._assignEntries();
      this._retypeVacant();   // P6: yesterday's queues change the restaurant minutes

      this._hour = Math.floor(this.t / 3600);
      this._updateWarn();

      // daily schedules; weekday profile (TOWER-a0009): on half days only part of each office comes,
      // on the weekend offices and the workshop stay closed and the residents make an outing
      const uni = (a, b) => a + R() * (b - a), W = CFG.week, kind = this.dayKind;
      this._markAway(kind);
      for (const p of this.persons) {
        p.pendingBack = null; p.car = null; p.outAt = null; p.parked = null;
        p.visit = null; p.visitQ = null; p.noScore = false; p.meal = false; p.kid = false; p.shop = false; p.goesOut = false; p.eve = null;
        if (p.kind === 'worker' || p.kind === 'resident' || p.kind === 'hotelguest') p.scoreRoom = p.home;
        p.energy = p.eMax; p.restT = this.t; p.restRate = CFG.energy.recoverPerHour;   // a night's sleep
        if (p.kind === 'worker') {
          p.state = 'out'; p.f = 0; p.where = null;
          if (p.away) continue;
          this._schedule(this._arriveAt(p.home, uni(hm(7, 30), hm(9, 0))), p, 'arrive');
          if (R() < 0.6) this._schedule(uni(hm(11, 45), hm(12, 45)), p, 'meal');
          this._schedule(this._leaveAt(p.home, uni(hm(17, 0), hm(18, 30))), p, 'leave');
        } else if (p.kind === 'resident') {
          p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
          if (p.garage && !p.garage.closed) this._park(p, p.garage);   // the resident's car stands in the garage over night (E49: not in a storm)
          // P6 tenant types: a penthouse sends only `outings` of its residents out and nobody to dinner, a seniors'
          // residence squeezes every trip into its hours (the draws stay as they are)
          const h = this._hoursOf(p.home), T = tenantOf(p.home);
          if (R() < 0.75 && (!T || T.outings == null || p.home.people.indexOf(p) < T.outings)) {   // P8: clan outings 0 = nobody
            p.goesOut = true;
            if (kind === 'weekend') {   // outing: out during the day, back a few hours later (same share as on weekdays)
              const t = uni(W.outing.leave[0], W.outing.leave[1]);
              this._schedule(h(t), p, 'leave');
              this._schedule(h(t + uni(W.outing.stay[0], W.outing.stay[1])), p, 'arrive');
            } else {
              this._schedule(h(uni(hm(6, 45), hm(8, 30))), p, 'leave');
              this._schedule(h(uni(hm(16, 30), hm(19, 30))), p, 'arrive');
            }
          }
          if (R() < 0.3 && !(T && T.outings != null)) this._schedule(h(uni(hm(19, 30), hm(20, 30))), p, 'meal');
        } else if (p.kind === 'hotelguest') {   // checked-in guests wake up in the hotel (P3; no random draw)
          p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
        } else if (p.kind === 'mechanic') {
          // shift: from the street to the workshop, out in the evening (no random draw: the day's stream stays)
          p.state = 'out'; p.f = 0; p.where = null; p.job = null; p.rjob = null; p.restUntil = 0;
          if (!this.isOpen('workshop')) continue;   // weekend: nobody comes, only the emergency service
          const i = p.home.staff.indexOf(p);
          this._schedule(CFG.mechanics.shiftStart + 60 * (i + 1), p, 'arrive');
          this._schedule(CFG.mechanics.shiftEnd, p, 'leave');
        }
      }

      // restaurant visitors from outside
      for (const r of this.rooms) {
        if (r.type !== 'restaurant' || !this.roomReachable(r)) continue;
        const q = r.score == null || r.score <= CFG.goodMin ? 1 : r.score <= CFG.okMin ? 0.7 : 0.4;
        const n = Math.round((14 + 4 * this.stars) * q * (kind === 'weekend' ? W.guests : 1));   // stars from 0: same as 10 + 4 × the old count
        for (const [a, b] of [[hm(11, 30), hm(13, 30)], [hm(18, 0), hm(20, 30)]]) {
          for (let i = 0; i < n; i++) {
            const v = this._newPerson('visitor', null);
            v.target = r; v.scoreRoom = r;
            this._schedule(uni(a, b), v, 'arrive');
          }
        }
      }
      this._planVisits();
      for (const r of this.rooms) if (r.type === 'hotel') this._planHotel(r);
      this._planDeliveries();
      this._planCleaning();
      this._planPublic();
      this._planCallers();   // P6 (E38): visitors of tenant types, planned last
      this._planTourists();  // P9 (E54): tourists of the space station, after them
      // P3 (E20): open orders paid with the emergency service (or with no workshop left) – it comes again this morning
      // when no workshop is open, without a new fee
      if (this.roomJobs.length && !this._workshopOpen()) {
        const ws = this.rooms.some(r => r.type === 'workshop');
        for (const r of this.roomJobs) if (r.damaged && !r.mech && (r.emerg || !ws)) { r.emerg = true; this._roomEmergency(r); }
      }
    }

    // deliveries (E15/E65): couriers from their own stream (this.rand untouched); a courier goes to the nearest reachable
    // parcel lockers with room (by way from the entrance) instead of the room. Planned last, so the people planned before
    // keep their ids
    _planDeliveries() {
      const D = CFG.delivery;
      for (const r of this.rooms) if (r.type === 'lockers') { r.booked = 0; r.parcels = 0; }
      if (this.stars < D.star || this.off.delivery || D.closed.includes(this.weekday)) return;
      const V = mulberry32(((this.seed ^ D.salt) + this.day) | 0);
      const lockers = this.rooms.filter(r => r.type === 'lockers' && this.roomReachable(r))
        .map(r => [r, this._plan(0, this._streetX(r.x), false, CFG.energy.ref, { f: r.f, x: r.x + r.w / 2 }, false).cost]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
      let n = 0, acc = (mulberry32((this.seed ^ D.salt) | 0)() + this.day * 0.6180339887) % 1;
      for (const r of this.rooms) {
        if (!isTenantRoom(r) || !r.occupied) continue;
        const T = tenantOf(r), k = (D.perRoom[r.tier] || 0) * (r.merged || 1) * ((T && T.couriers) || 1);   // E38 authority: × 2
        if (!k) continue;
        const m = Math.floor(acc + k + 1e-9) - Math.floor(acc + 1e-9);
        acc += k;
        for (let i = 0; i < m; i++) {
          const v = this._newPerson('visitor', null);
          v.role = 'courier'; v.scoreRoom = null; v.courierFor = r;
          v.target = lockers.find(l => l.booked < CFG.rooms.lockers.parcels) || r;
          if (v.target !== r) v.target.booked++;
          v.rng = mulberry32((V() * 4294967296) | 0); v.ownRng = true;   // E65: own stream for the street and the exit
          this._schedule(D.hours[0] + V() * (D.hours[1] - D.hours[0]), v, 'arrive');
          n++;
        }
      }
      this.today.couriers = n;
    }

    // cleaning (E23/E75, ★★★★): one cleaner per occupied office/flat from tier 1, planned last (the ids of everyone else stay).
    // A reachable logistics centre takes up to its `rooms` (the nearest by way first, rooms in build order); the rest from the street
    _planCleaning() {
      const C = CFG.cleaning, cap = CFG.rooms.logistics.rooms;
      for (const r of this.rooms) if (r.type === 'logistics') r.cleanings = 0;
      if (this.stars < C.star || this.off.cleaning) return;
      const V = mulberry32(((this.seed ^ C.salt) + this.day) | 0);
      const centers = this.rooms.filter(r => r.type === 'logistics');   // used when a way leads from it to the room (service lift too)
      let n = 0, k = 0;
      for (const r of this.rooms) {
        if (!isTenantRoom(r) || !r.occupied || !r.tier) continue;
        let c = null;
        if (centers.length) {
          const from = { f: r.f, x: r.x + r.w / 2 };
          let bc = Infinity;
          for (const L of centers) {
            if (L.cleanings >= cap) continue;
            const pl = this._planRole(from.f, from.x, false, CFG.energy.ref, this._spot(L), false, true);
            if (pl && pl.cost < bc) { bc = pl.cost; c = L; }
          }
        }
        const v = this._newPerson('visitor', null);
        v.role = 'cleaner'; v.scoreRoom = null; v.target = r; v.depot = c;
        v.rng = mulberry32((V() * 4294967296) | 0); v.ownRng = true;   // E65: own stream for the street and the exit
        const w = c ? C.center : C.street[k++ & 1];
        this._schedule(w[0] + V() * (w[1] - w[0]), v, 'arrive');
        if (c) c.cleanings++;
        n++;
      }
      this.today.cleanings = n;
    }

    // public rooms (E29/E65, ★★★★): their visitors from the own stream (this.rand untouched), planned last (the ids of everyone else
    // stay). Per open room visitors × trip rating (1 / 0.7 / 0.4) × visitK of the weekday; a share by train from the first reachable
    // station (they start and end there and pay its perUser), the rest from the street
    _planPublic() {
      const pubs = this.rooms.filter(r => CFG.rooms[r.type].public);
      this.today.publicPlanned = 0;
      if (!pubs.length) return;
      const P = CFG.publicVisits, V = mulberry32(((this.seed ^ P.salt) + this.day) | 0);
      const st = this.rooms.filter(r => r.type === 'station' && this.roomReachable(r))[0] || null;
      let n = 0;
      for (const r of pubs) {
        const def = CFG.rooms[r.type];
        if (!def.visitDays.includes(this.weekday) || !this.roomReachable(r)) continue;
        const q = r.score == null || r.score <= CFG.goodMin ? 1 : r.score <= CFG.okMin ? 0.7 : 0.4;
        const k = Math.round(def.visitors * q * ((def.visitK && def.visitK[this.weekday]) || 1));
        const W = def.visitWhen, tot = W.reduce((a, w) => a + w[1] - w[0], 0);
        for (let i = 0; i < k; i++) {
          const v = this._newPerson('visitor', null);
          v.role = 'public'; v.target = r; v.scoreRoom = r; v.walkIn = r;
          const train = V() < P.fromStation;   // always drawn: the stream does not depend on the station
          v.via = st && train ? st : null;
          let u = V() * tot, t = W[0][0];
          for (const w of W) { if (u < w[1] - w[0]) { t = w[0] + u; break; } u -= w[1] - w[0]; }
          const lv = V();
          if (def.until) v.until = def.until + lv * P.leaveSpread;
          v.rng = mulberry32((V() * 4294967296) | 0); v.ownRng = true;   // E65: own stream for the street and the exit
          this._schedule(t, v, 'arrive');
          n++;
        }
      }
      this.today.publicPlanned = n;
    }

    // tourists of the space station (TOWER-a0011 P9, E54/E65): the public mechanics (E29) with their own stream (this.rand untouched), planned
    // last (the ids of everyone else stay). Per reachable station tourists × trip rating (1 / 0.7 / 0.4) every day in visitWhen; a share by the
    // first reachable open airship port (CFG.tourists.fromAirship), a share by train, the rest from the street – they pay the entry's perUser
    _planTourists() {
      const ss = this.rooms.filter(r => r.type === 'spacestation');
      this.today.touristsPlanned = 0;
      if (!ss.length) return;
      const D = CFG.rooms.spacestation, P = CFG.publicVisits, V = mulberry32(((this.seed ^ CFG.tourists.salt) + this.day) | 0);
      const st = this.rooms.filter(r => r.type === 'station' && this.roomReachable(r))[0] || null;
      const ship = this.rooms.filter(r => r.type === 'airship' && !r.closed && this.roomReachable(r))[0] || null;
      const W = D.visitWhen, tot = W.reduce((a, w) => a + w[1] - w[0], 0);
      let n = 0;
      for (const r of ss) {
        if (!this.roomReachable(r)) continue;
        const q = r.score == null || r.score <= CFG.goodMin ? 1 : r.score <= CFG.okMin ? 0.7 : 0.4;
        const k = Math.round(D.tourists * q);
        for (let i = 0; i < k; i++) {
          const v = this._newPerson('visitor', null);
          v.role = 'tourist'; v.target = r; v.scoreRoom = r; v.walkIn = r;
          const air = V() < CFG.tourists.fromAirship, train = V() < P.fromStation;   // always drawn: the stream does not depend on the entries
          v.via = (air && ship) || (train && st) || null;
          let u = V() * tot, t = W[0][0];
          for (const w of W) { if (u < w[1] - w[0]) { t = w[0] + u; break; } u -= w[1] - w[0]; }
          v.rng = mulberry32((V() * 4294967296) | 0); v.ownRng = true;   // E65: own stream for the street and the exit
          this._schedule(t, v, 'arrive');
          n++;
        }
      }
      this.today.touristsPlanned = n;
    }

    // visitors of tenant types (E38/E65, ★★★★ types): the public mechanics (E29) with the tenant room as the destination, own stream (this.rand
    // untouched), planned last (the ids of everyone else stay). Only occupied rooms that are open today and reachable
    _planCallers() {
      const rs = this.rooms.filter(r => r.occupied && isTenantRoom(r) && tenantOf(r) && tenantOf(r).visitors);
      this.today.callersPlanned = 0;
      if (!rs.length) return;
      const P = CFG.publicVisits, V = mulberry32(((this.seed ^ CFG.callers.salt) + this.day) | 0);
      const st = this.rooms.filter(r => r.type === 'station' && this.roomReachable(r))[0] || null;
      let n = 0;
      for (const r of rs) {
        const T = tenantOf(r);
        if (!T.visitDays.includes(this.weekday) || !this.isOpen(r.type) || !this.roomReachable(r)) continue;
        const q = r.score == null || r.score <= CFG.goodMin ? 1 : r.score <= CFG.okMin ? 0.7 : 0.4;
        const k = Math.round(T.visitors * q), W = T.visitWhen, tot = W.reduce((a, w) => a + w[1] - w[0], 0);
        for (let i = 0; i < k; i++) {
          const v = this._newPerson('visitor', null);
          v.role = 'caller'; v.target = r; v.scoreRoom = r; v.stay = T.stay;
          const train = V() < P.fromStation;   // always drawn: the stream does not depend on the station
          v.via = st && train ? st : null;
          let u = V() * tot, t = W[0][0];
          for (const w of W) { if (u < w[1] - w[0]) { t = w[0] + u; break; } u -= w[1] - w[0]; }
          v.rng = mulberry32((V() * 4294967296) | 0); v.ownRng = true;   // E65: own stream for the street and the exit
          this._schedule(Math.min(t, W[W.length - 1][1] - 15 * 60), v, 'arrive');
          n++;
        }
      }
      this.today.callersPlanned = n;
    }

    // a visitor's day (E38): from the street (or the station, paying its perUser) to the tenant room, `stay` there, back the way it came
    _callerEvent(p, act) {
      const r = p.target;
      if (act === 'arrive') {
        if (p.state !== 'out') return;
        if (!this.rooms.includes(r) || !r.occupied) { this._kill(p); return; }
        const via = p.via && this.rooms.includes(p.via) && this.roomReachable(p.via) ? p.via : null;
        p.via = via;
        if (via) { this._useGarage(p, via); this._entryArrival(via); this.today.callersTrain = (this.today.callersTrain || 0) + 1; }
        this._startTrip(p, { f: r.f, x: r.x + r.w / 2, room: r }, via ? this._spot(via) : null);
      } else if (act === 'leave') {
        if (p.state !== 'in') return;
        this._startTrip(p, this._visitorOut(p));
      }
    }

    // a cleaner's day: from the street (or the logistics centre) to the room, `stay` there, back the same way; gone at the end
    _cleanerEvent(p, act) {
      const r = p.target, L = p.depot && this.rooms.includes(p.depot) ? p.depot : null;
      if (act === 'arrive') {
        if (p.state !== 'out') return;
        if (!this.rooms.includes(r)) { this._kill(p); return; }
        this._startTrip(p, { f: r.f, x: r.x + r.w / 2, room: r }, L ? this._spot(L) : null);
      } else if (act === 'leave') {
        if (p.state !== 'in') return;
        this._startTrip(p, L ? { ...this._spot(L), room: null } : this._street(p));
      }
    }

    // office leave time: luxury offices stay later (E30) – the same draw mapped onto CFG.luxuryOffice.leave,
    // so the day's random stream stays as it was
    _leaveAt(r, t) {
      const T = tenantOf(r);
      if (T && T.leave) return T.leave[0] + (t - hm(17, 0)) / hm(1, 30) * (T.leave[1] - T.leave[0]);   // P6 startup
      if (!r || r.tier < 2 || (T && T.tier === 0)) return t;
      const L = CFG.luxuryOffice.leave;
      return L[0] + (t - hm(17, 0)) / hm(1, 30) * (L[1] - L[0]);
    }

    // office arrival (P6): a tenant type with its own hours maps the same draw (7:30–9:00) onto them
    _arriveAt(r, t) {
      const T = tenantOf(r);
      return T && T.arrive ? T.arrive[0] + (t - hm(7, 30)) / hm(1, 30) * (T.arrive[1] - T.arrive[0]) : t;
    }

    // residents' trip times (P6 seniors): the day 6–22 squeezed linearly into the type's hours, order kept
    _hoursOf(r) {
      const T = tenantOf(r);
      if (!T || !T.hours) return t => t;
      const [a, b] = T.hours, d0 = hm(6, 0), d1 = hm(22, 0);
      return t => a + Math.max(0, Math.min(1, (t - d0) / (d1 - d0))) * (b - a);
    }

    // who of the offices stays away today: everyone on the weekend, on half days all but officeShare of each
    // office (which ones: fixed per office, tenancy and day from the seed, so a reload replays the same day)
    _markAway(kind) {
      for (const r of this.rooms) {
        if (r.type !== 'office') continue;
        const ps = r.people;
        for (const p of ps) p.away = kind === 'weekend';
        if (kind !== 'half') continue;
        const H = mulberry32((this.seed ^ Math.imul(r.id * 977 + 4099 * (r.tenancy || 0) + this.day * 7919 + 11, 0x9E3779B1)) | 0);
        const order = ps.map((p, i) => [H(), i]).sort((a, b) => a[0] - b[0]);
        const come = Math.round(ps.length * CFG.week.officeShare);
        order.forEach(([, i], k) => { ps[i].away = k >= come; });
      }
    }

    // P2: visits of upscale rooms and walk-in customers. Own random stream (towers without providers and
    // upscale rooms draw nothing extra and run as before); who is sporty / brings a child is fixed per
    // person by hash (seed, room, slot, tenancy) like the personal energy.
    _planVisits() {
      const V = mulberry32((this.seed ^ 0x2545F491) + this.day * 104729);
      const uni = (a, b) => a + V() * (b - a);
      const hash = (r, i, salt) => mulberry32((this.seed ^ Math.imul(r.id * 64 + i + 4099 * (r.tenancy || 0) + (salt ?? 7), 0x85EBCA6B)) | 0)();
      const N = CFG.needs, W = CFG.week, we = this.dayKind === 'weekend';
      // weekend: twice the residents at the gym over the whole day, every upscale flat shops
      const sportShare = N.sport.share * (we ? W.sport : 1), sportWhen = we ? W.sportWhen : N.sport.when;
      const shopEvery = we ? W.shopEvery : N.shopping.every;
      for (const r of this.rooms) {
        if (!isTenantRoom(r) || !r.occupied || !r.tier || !this.isOpen(r.type)) continue;
        const needs = needsOf(r);
        if (r.type === 'office') {
          if (needs.includes('coffee')) for (const p of r.people) {
            if (p.away || V() >= N.coffee.share) continue;
            const w = N.coffee.when[V() < 0.5 ? 0 : 1];
            this._schedule(uni(w[0], w[1]), p, 'coffee');
          }
          const here = r.people.filter(q => !q.away);   // half days: one of those who come brings the child
          if (needs.includes('childcare') && here.length) {
            const p = here[Math.floor(hash(r, 50) * here.length)];
            p.kid = true;
            this._schedule(N.childcare.pickup, p, 'pickup');
          }
          // luxury (E30): on the way out at 18–19 the gym (sport share) or the bar (evening share), fixed per person
          if (needs.includes('evening')) r.people.forEach((p, i) => {
            if (p.away) return;
            const h = hash(r, i, 23);
            p.eve = h < N.sport.share ? 'sport' : h < N.sport.share + N.evening.share ? 'evening' : null;
          });
        } else {
          const h = this._hoursOf(r);   // P6 seniors: their hours
          if (needs.includes('shopping') && (this.day + r.id) % shopEvery === 0) {
            const p = r.people.find(q => q.goesOut);   // on the way home from the street
            if (p) p.shop = true;
          }
          // P6 family flat: on Kita days one of those who go out brings the child on the way home (like an office in the morning)
          if (needs.includes('childcare') && this.isOpen('daycare')) {
            const p = r.people.find(q => q.goesOut && !q.shop);
            if (p) p.kid = true;
          }
          if (needs.includes('sport')) r.people.forEach((p, i) => {
            if (hash(r, i) >= sportShare) return;
            const w = sportWhen[Math.floor(V() * sportWhen.length)];
            this._schedule(h(uni(w[0], w[1])), p, 'sport');
          });
          // luxury flats (P3): spa and the bar like sport – who goes is fixed per person (hash), the time is drawn;
          // P6 shared flat: coffee the same way (when the café is open)
          for (const [need, salt] of [['spa', 13], ['evening', 19], ['coffee', 29]]) {
            if (!needs.includes(need) || !this._needOpen(need)) continue;
            const ws = (we && N[need].weekendWhen) || N[need].when;
            r.people.forEach((p, i) => {
              if (hash(r, i, salt) >= N[need].share) return;
              const w = ws[Math.floor(V() * ws.length)];
              this._schedule(h(uni(w[0], w[1])), p, need);
            });
          }
        }
      }
      // walk-in customers from outside (supermarket): all day, twice as many on the weekend
      const [a, b] = CFG.walkInHours;
      // P3 (E18/E65): a type with its own walkInHours (library) draws times and exits from its own stream per room and day
      const own = (r, salt) => mulberry32((this.seed ^ Math.imul(r.id * 7919 + this.day * 104729 + salt, 0x9E3779B1)) | 0);
      for (const r of this.rooms) {
        const def = CFG.rooms[r.type];
        if (def.walkInDays && !def.walkInDays.includes(this.weekday)) continue;
        const n = (def.walkIn || 0) * (we ? W.walkIn : 1);
        if (!n || !this.roomReachable(r)) continue;
        const H = def.walkInHours ? own(r, 0x11B) : null, [wa, wb] = def.walkInHours || [a, b];
        for (let i = 0; i < n; i++) {
          const v = this._newPerson('visitor', null);
          v.target = r; v.scoreRoom = r; v.walkIn = r;
          if (H) { v.rng = mulberry32((H() * 4294967296) | 0); v.ownRng = true; this._schedule(wa + H() * (wb - wa), v, 'arrive'); }
          else this._schedule(uni(a, b), v, 'arrive');
        }
      }
      // rooftop bar (P3, K13): own guests from outside in its evening window, counted like the restaurant's
      // (trip rating 1 / 0.7 / 0.4), twice as many on the weekend, half when it is built over
      for (const r of this.rooms) {
        const def = CFG.rooms[r.type];
        if (!def.guests || !this.roomReachable(r)) continue;
        const q = r.score == null || r.score <= CFG.goodMin ? 1 : r.score <= CFG.okMin ? 0.7 : 0.4;
        const n = Math.round(def.guests * q * (we ? W.guests : 1) * (r.roofed ? 0.5 : 1));
        const w = def.guestWhen || N.evening.when[0];
        const H = def.guestWhen ? own(r, 0x6E5) : null;   // P3 cinema (E65): own stream for times and the exit
        for (let i = 0; i < n; i++) {
          const v = this._newPerson('visitor', null);
          v.target = r; v.scoreRoom = r; v.walkIn = r;
          if (H) { v.rng = mulberry32((H() * 4294967296) | 0); v.ownRng = true; this._schedule(w[0] + H() * (w[1] - 30 * 60 - w[0]), v, 'arrive'); continue; }
          v.rng = mulberry32((this.seed ^ Math.imul(v.id, 0x2545F491)) | 0);   // street position: not this.rand
          this._schedule(uni(w[0], w[1] - 30 * 60), v, 'arrive');
        }
      }
    }

    // vacant rooms new tenants would take: reachable, not waiting for a structure change after moving out
    // for needs, forecast at least moveInMin (P2.9)
    vacantForRent() {
      return this.rooms.filter(r => isTenantRoom(r) && !r.occupied && !r.needOut && !r.damaged && this.isOpen(r.type) && this.roomReachable(r)
        && this.forecast(r, r.tier).fulfil >= CFG.moveInMin);
    }

    // move-ins per hour (TOWER-a0007): demand grows with the tower, at least 1
    demandPerHour() {
      let n = 0;
      for (const r of this.rooms) if (isTenantRoom(r) && r.occupied) n++;
      return Math.max(1, Math.ceil(n / CFG.demandPer));
    }

    // chance that a tenant looking at r takes it: 0 at moveInMin, sure from moveInMin + moveInRamp
    moveInChance(r) {
      return Math.max(0, Math.min(1, (this.forecast(r, r.tier).fulfil - CFG.moveInMin) / CFG.moveInRamp));
    }

    // demand stream: demandPerHour() tenants look at a random vacant room each and take it with
    // moveInChance – a room just above moveInMin fills slowly instead of all of them in one day
    _rentTick() {
      const R = this.rand, free = this.vacantForRent();
      for (let n = Math.min(this.demandPerHour(), free.length); n > 0; n--) {
        const i = Math.floor(R() * free.length);
        if (R() < this.moveInChance(free[i])) this._moveIn(free[i], true);
        free[i] = free[free.length - 1]; free.pop();
      }
    }

    // midday = they come from the street now (workers go home in the evening); else they start with the day
    _moveIn(r, midday) {
      const R = this.rand;
      if (r.merged > 1) this._retype(r);   // P6: the surroundings decide the tenant type now, fixed for the tenancy (E34)
      r.occupied = true; r.score = null; r.tenancy++;
      r.warnDays = 0; r.warnCause = null; r.meas = {}; r.nd = {}; r.fulfil = null;
      const kind = r.type === 'office' ? 'worker' : 'resident';
      for (let i = 0; i < capOf(r); i++) {
        const q = this._newPerson(kind, r);
        if (!midday) continue;
        this._schedule(this.t + R() * 1800, q, 'arrive');
        if (kind === 'worker') this._schedule(Math.max(this.t + 3600, this._leaveAt(r, hm(17, 0) + R() * hm(1, 30))), q, 'leave');
      }
      this._setWarn(r);
      this.msg('Neue Mieter: ' + this.roomLabel(r) + ' ' + floorName(r.f), 'good');
      this._emit('movein', { room: r });
    }

    // today's chance that the tenants of r go (0 on a good day): moveOutP by days below the threshold
    moveOutChance(r) {
      if (!isTenantRoom(r) || !r.occupied || !r.warnDays || !this.isOpen(r.type)) return 0;   // closed: no check (TOWER-a0009)
      if (this.staysForever(r)) return 0;   // P6 startup: never gives notice
      const P = CFG.moveOutP;
      return P[Math.min(r.warnDays, P.length) - 1];
    }

    // hourly check of rooms below the threshold; per hour 1 − (1 − P)^(1/hours), so the day sums to P
    _moveOutTick() {
      const R = this.rand, [a, b] = CFG.moveOutHours, hours = b - a + 1;
      for (const r of this.rooms.slice()) {
        const P = this.moveOutChance(r);
        if (P > 0 && R() < 1 - Math.pow(1 - P, 1 / hours)) this._moveOut(r);
      }
    }

    // why r is below the threshold: 'trip' (bad trip rating, the room becomes free) or 'needs' (the room
    // keeps its tier and waits for a structure change, P2.9); null = not below
    warnWhy(r) {
      if (r.score != null && r.score > CFG.okMin) return 'trip';
      return needWarn(r.fulfil) ? 'needs' : null;
    }

    // the tenants go now: people at home walk out to the street, the others are gone
    _moveOut(r) {
      const why = this.warnWhy(r) || r.warnCause || 'trip', label = this.roomLabel(r) + ' ' + floorName(r.f);
      const d = r.warnDays, days = d + (d > 1 ? ' Tage' : ' Tag');
      this.msg(label + ' zieht aus – ' + (why === 'trip' ? 'Ø ' + Math.round(r.score) + ' Min. pro Weg' : this.needReason(r)) + ' (' + days + ' unter der Schwelle)', 'bad');
      this._emit('moveout', { room: r });
      this._diary('moveout', label + ' zieht aus – ' + (why === 'trip' ? 'Wege zu lang' : this.needReason(r)));
      for (const p of r.people.slice()) {
        if (p.state === 'in' && p.where === r && !p.visit) this._walkOut(p);
        else this._kill(p);
      }
      r.occupied = false; r.score = null; r.warnDays = 0; r.warnCause = null; r.warn = 0;
      if (why === 'needs') r.needOut = true;
      if (r.merged > 1) this._retype(r);   // P6: vacant again – the type follows the surroundings until the next tenants
      this.today.movedOut++;
      if (why === 'needs') this.today.movedNeeds++;
    }

    // a tenant who moved out leaves the room for the street and is gone there (not rated, no events)
    _walkOut(p) {
      const i = p.home.people.indexOf(p);
      if (i >= 0) p.home.people.splice(i, 1);
      p.mover = true; p.home = null; p.scoreRoom = null; p.meal = false; p.kid = false; p.shop = false; p.pendingBack = null;
      this._startTrip(p, this._street(p));
    }

    // live trip rating: yesterday's score mixed with today's trips so far (as in the evening)
    tripScore(r) {
      const live = r.tripN > 0 ? r.tripSum / r.tripN : null;
      return r.score == null ? live : live == null ? r.score : 0.5 * r.score + 0.5 * live;
    }

    // sign over a room: 2 red = below the threshold, the tenants may go any hour; 1 yellow = close to it
    // (trip rating above warnNearWait × okMin or fulfilment at most warnNearNeed); 0 none
    warnLevel(r) {
      if (!isTenantRoom(r) || !r.occupied) return 0;
      if (r.warnDays > 0) return 2;
      const sc = this.tripScore(r);
      if (sc != null && sc > CFG.warnNearWait * CFG.okMin) return 1;
      return r.fulfil != null && Math.round(r.fulfil * 100) <= Math.round(CFG.warnNearNeed * 100) ? 1 : 0;
    }

    // why the sign is there, as text for the room panel
    warnReason(r) {
      const sc = this.tripScore(r);
      if (r.warnDays > 0 ? (this.warnWhy(r) || r.warnCause || 'trip') === 'trip' : sc != null && sc > CFG.warnNearWait * CFG.okMin) {
        return 'Ø ' + Math.round(r.warnDays > 0 ? r.score : sc) + ' Min. pro Weg';
      }
      return 'nur ' + Math.round((r.fulfil ?? 0) * 100) + ' % Erfüllung – ' + this.needReason(r);
    }

    _setWarn(r) { r.warn = this.warnLevel(r); }
    _updateWarn() { for (const r of this.rooms) if (isTenantRoom(r)) this._setWarn(r); }

    _endDay() {
      // unfinished trips count with the time spent so far
      for (const p of this.persons) {
        if (p.state === 'walk' || p.state === 'wait' || p.state === 'ride' || p.state === 'stranded' || p.state === 'climb') this._record(p, this.t - p.tripStart + 15 * 60);
      }
      // maintenance at night: running repairs and called emergency services finish (costs today),
      // mechanics on their way give the job back (it opens again tomorrow morning)
      for (const s of this.shafts) for (const car of s.cars) {
        if (car.fix === 'repair' || (car.mech && car.mech.emergency)) this._finishRepair(s, car, true);
        else if (car.mech) { car.mech.job = null; car.mech = null; car.fix = null; this._setCond(car); }
      }
      this._roomJobsNight();   // P3 (E20): unfinished room repairs stay open orders (no longer done by the night)
      const T = this.today, fl = T.fl, kind = this.dayKind;
      let rent = 0, upkeepFloors = 0, upkeepRooms = 0, upkeepShafts = 0;

      // forecasts from now on with today's measured waits (P2.1) – only from working days (TOWER-a0009):
      // a quiet Sunday would forecast Monday too well
      const workday = kind !== 'weekend';
      for (const s of this.shafts) if (s.waitN && workday) s.lastWait = s.waitSum / s.waitN / 60;
      for (const r of this.rooms) if (r.qN + r.guN) {   // providers' queues
        if (workday) { r.lastQ = r.qN ? r.qSum / r.qN : 0; r.lastGU = r.guN / (r.qN + r.guN); }
        r.qSum = 0; r.qN = 0; r.guN = 0;
      }
      this.fcCache = new Map(); this.fcGen++;
      for (const r of this.rooms) {
        const def = CFG.rooms[r.type];
        // closed today (office, café, Kita on the weekend): rating, fulfilment and warning days pause at
        // Friday's state; the rent goes on (TOWER-a0009)
        const closed = !this.isOpen(r.type);
        if (r.eN) r.eLast = r.eSum / r.eN;
        if (!closed) { r.lastFails = r.failN; r.lastVisits = r.vN; }
        const up = this.roomUpkeep(r);
        if (up) { upkeepRooms += up; fl[fi(r.f)] -= up; }
        if (def.noPeople) { const re = this.rentOf(r); rent += re; fl[fi(r.f)] += re; }   // E36: server, self-storage
        if (r.type === 'office' || r.type === 'condo') {
          if (r.tier) { const c = this.tierUpkeep(r); upkeepRooms += c; fl[fi(r.f)] -= c; }
          if (!r.occupied) continue;
          if (!closed) this._settleNeeds(r);
          const re = this.rentOf(r);
          rent += re; fl[fi(r.f)] += re;
          if (closed) continue;
          if (r.tripN > 0) {
            const avg = r.tripSum / r.tripN;
            r.score = r.score == null ? avg : 0.5 * r.score + 0.5 * avg;
            r.lastAvg = avg;
          }
          // below the threshold (bad trips or needs): warning from the first day, tomorrow the tenants may
          // go (_moveOutTick); one good day resets it (TOWER-a0007) – for offices only a full day (Tu–Th):
          // a half day can start a warning but not wash it away (TOWER-a0009)
          const why = this.warnWhy(r);
          if (why) {
            r.warnDays++; r.warnCause = why;
            if (r.warnDays === 1) {
              const label = CFG.rooms[r.type].label + ' ' + floorName(r.f);
              this.msg('⚠ ' + label + ': ' + (why === 'trip' ? 'Ø ' + Math.round(r.score) + ' Min. pro Weg' : 'nur noch ' + Math.round(r.fulfil * 100) + ' % – ' + this.needReason(r)), 'bad');
              this._emit('downgrade', { room: r });
            }
          } else if (r.type !== 'office' || kind === 'full') { r.warnDays = 0; r.warnCause = null; }
        } else if (r.tripN > 0 && (def.seats || def.suites)) {
          const avg = r.tripSum / r.tripN;
          r.score = r.score == null ? avg : 0.5 * r.score + 0.5 * avg;
          r.lastAvg = avg;
        }
      }
      // hotel (P3): every guest checked in tonight pays the night (booked here, not during the day – K15d);
      // occupancy and fulfilment of its guests' needs drive tomorrow's requests
      let hotel = 0, hotelGuests = 0;
      for (const r of this.rooms) {
        if (r.type !== 'hotel') continue;
        const def = CFG.rooms.hotel, n = r.guests.length, inc = n * def.night;
        hotel += inc; hotelGuests += n; fl[fi(r.f)] += inc;
        r.lastOcc = n / def.suites;
        this._settleNeeds(r);
        for (const g of r.guests) g.nights--;
        r.guestsNight = r.guests.map(g => ({ nights: g.nights, key: g.key }));
      }
      T.sales += hotel; this.money += hotel;
      // underground garage (P4): every user of today pays (E29); booked here like the hotel nights. E27: every entry room
      // (station, heliport) the same way – entries {type: {users, income, arrivals}} next to the garage's own fields
      let garage = 0, garageUsers = 0, entries = null;
      for (const r of this.rooms) {
        const def = CFG.rooms[r.type];
        if (!def.spaces) continue;
        const inc = r.users * def.perUser;
        if (r.type === 'garage') { garage += inc; garageUsers += r.users; }
        else {
          const e = (entries || (entries = {}))[r.type] || (entries[r.type] = { users: 0, income: 0, arrivals: (T.entryIn && T.entryIn[r.type]) || 0 });
          e.users += r.users; e.income += inc; T.sales += inc; this.money += inc;
        }
        fl[fi(r.f)] += inc;
        r.lastUsers = r.users;
      }
      T.sales += garage; this.money += garage;
      for (const s of this.shafts) {
        const c = this.shaftUpkeep(s), fs = this._doorFloors(s);
        upkeepShafts += c;
        for (const f of fs) fl[fi(f)] -= c / fs.length;
      }
      for (const l of this.links) { const c = CFG.links[l.kind].upkeep; upkeepShafts += c; fl[fi(l.f)] -= c; }
      for (let f = CFG.MIN_FLOOR; f <= CFG.MAX_FLOOR; f++) for (let t = 0; t < 2; t++) if (f !== 0 && this.floorUsed(f, t)) { const c = this.floorUpkeep(f); upkeepFloors += c; fl[fi(f)] -= c; }   // E60: each tower pays its floors
      // base costs of the star reached (E7): a fixed item of its own, belongs to no floor (floorNet stays per floor)
      const baseCost = CFG.stars[Math.min(this.stars, CFG.stars.length - 1)].baseCost || 0;
      const upkeep = upkeepFloors + upkeepRooms + upkeepShafts + baseCost;
      const interest = Math.round(CFG.economy.loanRate * this.loan);
      this.money += rent - upkeep - interest;   // sales and repairs were booked during the day
      const net = rent + T.sales - upkeep - T.repairs - interest;
      this.floorNet = Array.from(fl);
      const E = CFG.economy, wasBlocked = this.negDays >= E.loanBlockDays;
      this.negDays = net < 0 ? this.negDays + 1 : 0;
      this.lastDay = { day: this.day, rent, upkeep, upkeepFloors, crossings: T.crossings || 0, guests: T.guests, guestIncome: T.sales, avgWait: T.waitN ? T.waitSum / T.waitN / 60 : 0, movedOut: T.movedOut,
        movedNeeds: T.movedNeeds, visits: T.visits, visitFails: T.visitFails, visitGiveUps: T.visitGiveUps,
        avgFelt: T.tripN ? T.feltSum / T.tripN : 0, avgEnergy: T.tripN ? T.eSum / T.tripN : 1, fails: T.fails || 0, modes: T.modes || {},
        sales: T.sales, hotel, hotelGuests, garage, garageUsers, arrivals: T.arrivals || 0, garageArrivals: T.garageArrivals || 0, waitEG: T.waitEGn ? T.waitEG / T.waitEGn / 60 : 0, waitEGn: T.waitEGn || 0, waitEGsum: T.waitEG || 0, upkeepFloors, upkeepRooms, upkeepShafts, baseCost, repairs: T.repairs, interest, net,
        couriers: T.couriers || 0, parcels: T.parcels || 0, ...(entries ? { entries } : {}),   // E27 (P5)
        ...(T.publicPlanned ? { publicPlanned: T.publicPlanned, publicTrain: T.publicTrain || 0 } : {}),   // E29 (P5)
        ...(T.touristsPlanned ? { tourists: T.touristsPlanned, touristsVia: T.touristsVia || 0 } : {}),   // E54 (P9)
        ...(T.callersPlanned ? { callers: T.callersPlanned, callersTrain: T.callersTrain || 0, callersIn: T.callersIn || 0 } : {}),   // E38 (P6)
        ...(T.cleanings != null ? { cleanings: T.cleanings, cleaned: T.cleaned || 0 } : {}),   // P4 (E23)
        jobs: T.jobs, jobsOpened: T.jobsOpened, breakdowns: T.breakdowns, emergencies: T.emergencies, mechFails: T.mechFails, approaches: T.mechApp.slice(), ...this.workshopStats() };
      // stats + stars: a room is satisfied with good trips and no needs warning (P2.6)
      const occ = this.rooms.filter(r => (r.type === 'office' || r.type === 'condo') && r.occupied);
      const okRooms = occ.filter(r => (r.score == null || r.score <= CFG.okMin) && !r.warnDays).length;
      this.sat = occ.length ? okRooms / occ.length : 1;
      const pop = this.population;
      while (this.stars < CFG.stars.length - 1) {
        const req = CFG.stars[this.stars + 1];
        const rest = this.rooms.filter(r => r.type === 'restaurant').length;
        if (pop >= req.pop && this.sat >= req.sat && rest >= (req.restaurants || 0) && this.upgradedRooms() >= (req.upgraded || 0) && this.luxuryRooms() >= (req.luxury || 0)) {
          this.stars++;
          this.starDays[this.stars] = this.day;   // several stars on one evening get the same day (K10b)
          if (this.stars === CFG.quake.star) this.quakes.from = null;   // the calm period runs from starDays (P5)
          this.msg('★ Neuer Stern! Jetzt ' + this.stars + (this.stars === 1 ? ' Stern' : ' Sterne') + ' – bauen bis ' + floorName(this.maxFloor) + ', graben bis ' + floorName(this.minFloor), 'star');
          this._diary('star', (this.stars === 1 ? '1 Stern' : this.stars + ' Sterne') + ' erreicht – bauen bis ' + floorName(this.maxFloor) + ', graben bis ' + floorName(this.minFloor));
          this._emit('star', { stars: this.stars });
        } else break;
      }
      // calm week (E6): 7 evenings in a row without a move-out, only counted with at least one occupied room
      for (const r of this.rooms) if (r.shaken > 0) r.shaken--;   // P5: one evening of the quake fright less
      this.calmDays = T.movedOut === 0 && occ.length >= 1 ? this.calmDays + 1 : 0;
      if (this.calmDays >= 7) this._milestone('calmWeek');
      this._checkMilestones();
      // E2: no 🏆 any more (`won` is only kept in the save) – P9 (E55): the goal's streak with the platform
      this._goalEvening();
      const eu = n => Math.round(n).toLocaleString('de-DE');
      this.msg('Tag ' + this.day + ': +' + eu(rent) + ' € Miete, +' + eu(T.sales) + ' € Umsatz, −' + eu(upkeep - baseCost) + ' € Betrieb'
        + (baseCost ? ', −' + eu(baseCost) + ' € Grundkosten' : '') + (T.repairs ? ', −' + eu(T.repairs) + ' € Wartung' : '') + (interest ? ', −' + eu(interest) + ' € Zins' : '')
        + ' = ' + (net >= 0 ? '+' : '−') + eu(Math.abs(net)) + ' €', net >= 0 ? 'day' : 'bad');
      if (this.negDays >= E.loanBlockDays && !wasBlocked) this.msg('Kredit gesperrt: ' + E.loanBlockDays + ' Tage in Folge Verlust', 'bad');
      this._emit('day', this.lastDay);
      this.day++;
      if (this.onDayEnd) this.onDayEnd();
      this._startDay();
    }

    get population() {
      let n = 0;
      for (const r of this.rooms) if (r.occupied) n += capOf(r);
      return n;
    }

    // visitors from outside (restaurant guests, walk-in customers) currently inside the tower
    get visitorsInside() {
      let n = 0;
      for (const p of this.persons) if (p.kind === 'visitor' && p.state !== 'out') n++;
      return n;
    }

    // ----- star overlay data (TOWER-a0010 P2, E5) -----
    // { next: { star, criteria: [{ label, have, need, ok, unit? }], goal, unlocks: [text] } | null,
    //   reached: [{ star, day | null, unlocks }] } – criteria read generically from CFG.stars
    starInfo() {
      const S = CFG.stars, nxt = this.stars < S.length - 1 ? this.stars + 1 : null;
      const reached = [];
      for (let i = 0; i <= this.stars; i++) reached.push({ star: i, day: this.starDays[i] ?? null, unlocks: this.starUnlocks(i) });
      let next = null;
      if (nxt != null) {
        const q = S[nxt], c = [];
        const add = (label, have, need, unit) => c.push({ label, have, need, ok: have >= need, unit: unit || undefined });
        if (q.pop) add('Leute', this.population, q.pop);
        if (q.sat) add('Zufrieden', Math.floor(this.sat * 100 + 1e-9), Math.round(q.sat * 100), '%');
        if (q.restaurants) add('Restaurant', this.rooms.filter(r => r.type === 'restaurant').length, q.restaurants);
        if (q.upgraded) add('Gehoben belegt', this.upgradedRooms(), q.upgraded);
        if (q.luxury) add('Luxus belegt', this.luxuryRooms(), q.luxury);
        // the goal as one line ("700 · 80 % · 10 Luxus belegt")
        const goal = [q.pop && q.pop.toLocaleString('de-DE'), q.sat && Math.round(q.sat * 100) + ' %', q.restaurants && (q.restaurants > 1 ? q.restaurants + ' Restaurants' : 'Restaurant'),
          q.upgraded && q.upgraded + ' Gehoben belegt', q.luxury && q.luxury + ' Luxus belegt'].filter(Boolean).join(' · ');
        next = { star: nxt, criteria: c, goal, unlocks: this.starUnlocks(nxt) };
      }
      return { next, reached, goal: next ? null : this.goalInfo() };   // P9 (E55): after the last star the goal
    }

    // what star i brings, derived from CFG: height, depth, base costs, room types, tiers, elevator types
    starUnlocks(i) {
      const S = CFG.stars, q = S[i], p = i > 0 ? S[i - 1] : null, out = [];
      const eu = n => n.toLocaleString('de-DE') + ' €';
      if (!p || q.maxFloor !== p.maxFloor) out.push('Bauen bis ' + floorName(q.maxFloor));
      if (!p || q.minFloor !== p.minFloor) out.push('Graben bis ' + floorName(q.minFloor));
      for (const d of Object.values(CFG.rooms)) if ((d.star || 0) === i && (i > 0 || !d.basementOnly)) out.push(d.icon + ' ' + d.label);
      for (const d of Object.values(CFG.shafts)) if ((d.star || 0) === i) out.push('🛗 ' + d.label);
      for (const d of Object.values(CFG.links)) if ((d.star || 0) === i) out.push(d.icon + ' ' + d.label);
      if (i > 0) for (const T of CFG.tiers) if (T.star === i && !T.locked) out.push('Stufe ' + T.label);
      if (q.baseCost && (!p || q.baseCost !== p.baseCost)) out.push('Grundkosten ' + eu(q.baseCost) + ' pro Tag');
      return out;
    }

    nextStarReq() { return this.stars < CFG.stars.length - 1 ? CFG.stars[this.stars + 1] : null; }

    // ----- simulation step -----
    step(dt) {
      const SUB = 2;
      while (dt > 0) {
        const d = Math.min(SUB, dt); dt -= d;
        this.t += d;
        const h = Math.floor(this.t / 3600);
        if (h !== this._hour) {
          this._hour = h;
          if (h >= CFG.moveOutHours[0] && h <= CFG.moveOutHours[1]) this._moveOutTick();
          if (h >= CFG.demandHours[0] && h <= CFG.demandHours[1]) this._rentTick();
          this._updateWarn();
          this._dispatch();                   // safety net: paused jobs, mechanics back from a break
          if (this._quakePlan && h >= this._quakePlan.hour) { const lv = this._quakePlan.level; this._quakePlan = null; this._quake(lv); }
          if (this._incPlan && h >= this._incPlan.hour) { const ip = this._incPlan; this._incPlan = null; this._incident(ip.kind, null, ip.u); }
          // P9 (E55): the day after the goal at launchAt the first cabin starts (with the platform still standing; once)
          const gl = this.goal;
          if (gl.done != null && gl.launched == null && this.day > gl.done && h * 3600 >= CFG.goal.launchAt && this._hasPlatform()) this._launch();
        }
        while (this.events.size && this.events.peek().t <= this.t) this._doEvent(this.events.pop());
        for (const p of this.walking) {
          const dx = p.tx - p.x, m = CFG.walkSpeed * d;
          this._spend(p, Math.min(m, Math.abs(dx)) * CFG.energy.corridor, d, 1);
          if (Math.abs(dx) <= m) {
            p.x = p.tx; this.walking.delete(p);
            if (p.after === 'queue') this._enqueue(p); else if (p.after === 'link') this._startClimb(p); else this._arrive(p);
          } else p.x += Math.sign(dx) * m;
        }
        for (const p of this.climbing) {
          const c = p.climb, k = (this.t - c.t0) / c.dur;
          if (k >= 1) this._finishClimb(p, false);
          else { p.cy = c.from + (c.to - c.from) * k; p.x = c.x0 + (c.x1 - c.x0) * k; }
        }
        // E4: idle cars skip the floor scan when their shaft has no queue at all (_enqueue sets the flag again)
        for (const s of this.shafts) {
          let any = false;
          if (s._sv) { for (let k = 0; k < s._sv.length && !any; k++) any = this._hasQueue(s, s._sv[k]); }   // K8: served floors only
          else for (let i = 0; i < s.qUp.length && !any; i++) any = s.qUp[i].length > 0 || s.qDown[i].length > 0;
          s._anyQ = any;
        }
        if (!(this.outageUntil > this.t)) for (const s of this.shafts) for (const car of s.cars) this._stepCar(s, car, d);   // P3 outage: every car stands
        if (this.t >= CFG.DAY_END) { this._endDay(); }
      }
    }

    _enqueue(p) {
      const s = p.shaft;
      if (!this.shafts.includes(s) || !this.serves(s, p.f) || !this.serves(s, p.legTo)
        || (s.twin && Math.min(p.f, p.legTo) < s.split && Math.max(p.f, p.legTo) > s.split)) { this._nextLeg(p); return; }   // TWIN: no leg across the split
      p.state = 'wait'; p.waitStart = this.t; p.eWaitT = this.t;
      const i = p.f - s.f0;
      (p.legTo > p.f ? s.qUp : s.qDown)[i].push(p);
      s._anyQ = true;
    }

    _hasQueue(s, f) { const i = f - s.f0; return s.qUp[i].length > 0 || s.qDown[i].length > 0; }

    // TWIN (E25): the queue of floor f a car serves – only on its own floors; at the split the lower car takes those going down,
    // the upper those going up (NOQ = empty, never filled)
    _tq(s, car, f, up) {
      if (f < car.lo || f > car.hi || (f === s.split && (car.hi === s.split) === up)) return NOQ;
      return (up ? s.qUp : s.qDown)[f - s.f0];
    }
    _twinQueue(s, car, f) { return this._tq(s, car, f, true).length > 0 || this._tq(s, car, f, false).length > 0; }

    // double deck (E13): a stop at f (lower deck) serves f and f + 1; a rider leaves at the stop legTo − deck
    _stopQueue(s, f) { return this._hasQueue(s, f) || (s.dbl && f + 1 <= s.f1 && this._hasQueue(s, f + 1)); }
    _servesStop(s, f) { return this.serves(s, f) || (s.dbl && this.serves(s, f + 1)); }
    _carTop(s) { return s.dbl ? s.f1 - ((s.f1 - s.f0) & 1) : s.f1; }

    _requestsBeyond(s, car, from, dir) {
      if (s.twin) {
        for (const p of car.pax) if ((p.legTo - from) * dir > 0) return true;
        for (let f = from + dir; f >= car.lo && f <= car.hi; f += dir) if (this._twinQueue(s, car, f)) return true;
        return false;
      }
      if (s.dbl) {
        for (const p of car.pax) if ((p.legTo - p.deck - from) * dir > 0) return true;
        for (let f = dir > 0 ? from + 2 : from - 1; f >= s.f0 && f <= s.f1; f += dir) if (this._hasQueue(s, f)) return true;
        return false;
      }
      for (const p of car.pax) if ((p.legTo - from) * dir > 0) return true;
      if (s._sv) {   // K8: only the floors a queue can stand on (ascending)
        const sv = s._sv;
        if (dir > 0) { for (let k = sv.length - 1; k >= 0 && sv[k] > from; k--) if (this._hasQueue(s, sv[k])) return true; }
        else for (let k = 0; k < sv.length && sv[k] < from; k++) if (this._hasQueue(s, sv[k])) return true;
        return false;
      }
      for (let f = from + dir; f >= s.f0 && f <= s.f1; f += dir) if (this._hasQueue(s, f)) return true;
      return false;
    }

    _board(s, car, f) {
      if (car.halt) return 0;                       // out of service: nobody gets in
      if (s.dbl) return this._boardDouble(s, car, f);
      if (s.twin) return this._boardTwin(s, car, f);
      const i = f - s.f0;
      if (car.dir === 0) car.dir = s.qUp[i].length ? 1 : s.qDown[i].length ? -1 : 0;
      if (car.dir === 0) return 0;
      const q = car.dir > 0 ? s.qUp[i] : s.qDown[i];
      const cap = CFG.shafts[s.kind].cap;
      let n = 0;
      if (s.dd && car.dir > 0 && s.running >= 2 && q.length && (f === s.f0 || this.isLobby(f, s.c))) {
        // destination dispatch (E61): the first one (or the riders already inside) fix the band, the others wait for the next car
        const band = this._ddBands(s, f);
        let key = null;
        for (const p of car.pax) if (p.legTo > f) { key = band(p.legTo); break; }
        const keep = [];
        while (q.length && car.pax.length < cap) {
          const p = q.shift(), b = band(p.legTo), free = p.legTo - f <= CFG.dispatch.free;
          if (key == null && !free) key = b;
          if (!free && b !== key) { keep.push(p); continue; }
          this._take(s, car, p, f); n++;
        }
        if (CFG.dispatch.fill) while (keep.length && car.pax.length < cap) { this._take(s, car, keep.shift(), f); n++; }
        if (keep.length) q.unshift(...keep);
        return n;
      }
      while (q.length && car.pax.length < cap) { this._take(s, car, q.shift(), f); n++; }
      return n;
    }

    // destination dispatch (E61): band of a target floor above f – the served stops above f in ⌈n / running cars⌉ wide bands
    _ddBands(s, f) {
      const rank = new Map();
      for (let g = f + 1; g <= s.f1; g++) if (this.serves(s, g)) rank.set(g, rank.size);
      const w = Math.max(1, Math.ceil(rank.size / Math.max(1, s.running)));
      return g => Math.floor((rank.get(g) ?? rank.size) / w);
    }

    // p gets in at floor f (waiting time into the statistics)
    _take(s, car, p, f) {
      const w = this.t - p.waitStart;
      s.waitSum += w; s.waitN++; this.today.waitSum += w; this.today.waitN++;
      if (f === 0 && this.t >= 7 * 3600 && this.t < 9 * 3600) { this.today.waitEG = (this.today.waitEG || 0) + w; this.today.waitEGn = (this.today.waitEGn || 0) + 1; }   // measuring only (P4, K18)
      this._drainWait(p);
      p.state = 'ride'; p.car = car; car.pax.push(p); p.rideStart = this.t; p.tripElev = true;
    }

    // TWIN (E25): only the car's own queue at f
    _boardTwin(s, car, f) {
      if (car.dir === 0) car.dir = this._tq(s, car, f, true).length ? 1 : this._tq(s, car, f, false).length ? -1 : 0;
      if (car.dir === 0) return 0;
      const q = this._tq(s, car, f, car.dir > 0), cap = CFG.shafts[s.kind].cap;
      let n = 0;
      while (q.length && car.pax.length < cap) { this._take(s, car, q.shift(), f); n++; }
      return n;
    }

    // double deck (E13): the stop f takes the queues of f (lower deck) and f + 1 (upper deck), cap / 2 each
    _boardDouble(s, car, f) {
      const top = Math.min(f + 1, s.f1);
      if (car.dir === 0) {
        for (let g = f; g <= top && !car.dir; g++) if (this.serves(s, g) && s.qUp[g - s.f0].length) car.dir = 1;
        for (let g = f; g <= top && !car.dir; g++) if (this.serves(s, g) && s.qDown[g - s.f0].length) car.dir = -1;
      }
      if (car.dir === 0) return 0;
      const half = CFG.shafts[s.kind].cap / 2;
      let n = 0;
      for (let g = f; g <= top; g++) {
        if (!this.serves(s, g)) continue;
        const deck = g - f, q = car.dir > 0 ? s.qUp[g - s.f0] : s.qDown[g - s.f0];
        let on = 0;
        for (const p of car.pax) if (p.deck === deck) on++;
        while (q.length && on < half) { const p = q.shift(); this._take(s, car, p, g); p.deck = deck; on++; n++; }
      }
      return n;
    }

    _openDoors(s, car, f) {
      car.y = f; car.state = 'doors';
      if (car.target === f) car.target = null;
      let n = 0;
      for (let k = car.pax.length - 1; k >= 0; k--) {
        const p = car.pax[k];
        if (s.dbl ? p.legTo - p.deck !== f : p.legTo !== f) continue;
        car.pax.splice(k, 1); n++;
        this._endRide(p);
        p.f = p.legTo; p.x = s.c + 0.5 + ((p.ownRng ? p.rng() : this.rand()) < 0.5 ? -0.8 : 0.8); p.car = null; p.state = 'walk'; p.byElev = true;
        this._nextLeg(p);
      }
      if (car.dir !== 0 && car.pax.length === 0 && !this._requestsBeyond(s, car, f, car.dir)) {
        let same = 0, other = 0;
        if (s.twin) { same = this._tq(s, car, f, car.dir > 0).length; other = this._tq(s, car, f, car.dir < 0).length; }
        else for (let g = f; g <= (s.dbl ? Math.min(f + 1, s.f1) : f); g++) {
          const i = g - s.f0;
          same += (car.dir > 0 ? s.qUp[i] : s.qDown[i]).length; other += (car.dir > 0 ? s.qDown[i] : s.qUp[i]).length;
        }
        if (!same && other) car.dir = -car.dir;
      }
      n += this._board(s, car, f);
      car.timer = CFG.doorTime + CFG.boardTime * n;
      this._emit('door', { shaft: s, f, n });
      if (n > 0) this._wear(s, car, CFG.shafts[s.kind].wearPerStop);   // a door cycle with people
    }

    _covered(s, car, f) {
      const cap = CFG.shafts[s.kind].cap;
      for (const c2 of s.cars) {
        if (c2 === car || c2.halt) continue;
        if (c2.target === f) return true;
        if (c2.state === 'doors' && Math.round(c2.y) === f) return true;
        if (c2.state === 'moving' && c2.pax.length < cap && (f - c2.y) * c2.dir > 0) return true;
      }
      return false;
    }

    _stepCar(s, car, dt) {
      if (car.halt) { this._stepHalted(s, car, dt); return; }
      const def = CFG.shafts[s.kind];
      if (car.state === 'doors') {
        car.timer -= dt;
        if (car.timer > 0) return;
        const f = Math.round(car.y);
        if (this._servesStop(s, f)) {
          const n = this._board(s, car, f);
          if (n > 0) { car.timer = CFG.boardTime * n; return; }
        }
        if (car.dir !== 0 && this._requestsBeyond(s, car, f, car.dir)) { car.state = 'moving'; return; }
        if (car.dir !== 0 && this._requestsBeyond(s, car, f, -car.dir)) {
          car.dir = -car.dir;
          if (this._servesStop(s, f)) { const n = this._board(s, car, f); if (n > 0) { car.timer = CFG.boardTime * n; return; } }
          car.state = 'moving'; return;
        }
        car.dir = 0;
        if (this._servesStop(s, f) && (s.twin ? this._twinQueue(s, car, f) : this._stopQueue(s, f))) { const n = this._board(s, car, f); car.timer = CFG.boardTime * n + 1; return; }
        car.state = 'idle'; car.target = null;
        return;
      }
      if (car.state === 'idle') {
        const cf = Math.round(car.y);
        car.target = null;
        if (car.pax.length) { // safety: never idle with passengers inside
          const p = car.pax[0], to = s.dbl ? p.legTo - p.deck : p.legTo;
          if (to === cf) { car.y = cf; this._openDoors(s, car, cf); return; }
          car.dir = to > car.y ? 1 : -1; car.state = 'moving'; return;
        }
        if (s._anyQ === false) return;
        let best = null, bd = Infinity;
        const lo = s.twin ? car.lo : s.f0, top = s.twin ? car.hi : this._carTop(s), stp = s.dbl ? 2 : 1;
        if (s._sv) for (const f of s._sv) {   // K8: the same scan over the floors a queue can stand on (ascending, same ties)
          if (!this._hasQueue(s, f) || this._covered(s, car, f)) continue;
          const d = Math.abs(f - cf);
          if (d < bd) { bd = d; best = f; }
        } else for (let f = lo; f <= top; f += stp) {
          if (s.twin ? !this._twinQueue(s, car, f) : (!this._stopQueue(s, f) || this._covered(s, car, f))) continue;
          const d = Math.abs(f - cf);
          if (d < bd) { bd = d; best = f; }
        }
        if (best == null) return;
        if (best === cf && Math.abs(car.y - cf) < 1e-6) { car.dir = 0; this._openDoors(s, car, cf); return; }
        car.target = best; car.dir = best > car.y ? 1 : -1; car.state = 'moving';
        return;
      }
      // moving (worn cars from slowAt are slower)
      let y = car.y, rem = def.speed * dt * (car.wear >= CFG.wear.slowAt ? CFG.wear.slowFactor : 1) * this.powerK;   // E52: short of power
      const lo = s.twin ? car.lo : s.f0, top = s.twin ? car.hi : s.dbl ? this._carTop(s) : s.f1;   // TWIN: the car's own floors
      while (rem > 0) {
        const next = car.dir > 0 ? Math.floor(y + 1e-6) + 1 : Math.ceil(y - 1e-6) - 1;
        if (next < lo || next > top) { car.y = Math.max(lo, Math.min(top, Math.round(y))); car.dir = 0; car.state = 'idle'; car.target = null; return; }
        const dist = Math.abs(next - y);
        if (dist > rem + 1e-6) { y += car.dir * rem; rem = 0; break; }
        y = next; rem = Math.max(0, rem - dist);
        this._wear(s, car, def.wearPerFloor);
        if (car.halt) { car.y = y; car.state = 'idle'; car.target = null; return; }   // broke down: _stepHalted takes over at this floor
        if (this._shouldStop(s, car, next)) { this._openDoors(s, car, next); return; }
      }
      car.y = y;
    }

    // out of service: nobody new gets in; riders are brought to their floor, then the car goes empty
    // to the service floor and waits there (for the mechanic, the repair, or forever if nobody comes)
    _stepHalted(s, car, dt) {
      const def = CFG.shafts[s.kind];
      if (car.fix === 'repair') { if (this.t >= car.repairEnd) this._finishRepair(s, car, false); return; }
      if (car.fix === 'inspect' && this.t >= car.repairEnd) { this._endInspect(s, car); return; }   // P5: quake inspection over
      if (car.state === 'doors') {
        car.timer -= dt;
        if (car.timer > 0) return;
        car.state = 'idle'; car.dir = 0; car.target = null;
        return;
      }
      if (car.state === 'idle') {
        const cf = Math.round(car.y), at = Math.abs(car.y - cf) < 1e-6;
        if (car.pax.length) {
          let best = null, bd = Infinity;
          for (const p of car.pax) { const to = s.dbl ? p.legTo - p.deck : p.legTo, d = Math.abs(to - car.y); if (d < bd) { bd = d; best = to; } }
          if (at && best === cf) { car.y = cf; this._openDoors(s, car, cf); return; }
          car.target = null; car.dir = best > car.y ? 1 : -1; car.state = 'moving';
          return;
        }
        const home = s.svc;
        if (home == null) return;
        if (at && cf === home) {
          if (car.fix === 'park' && car.mech) {
            const m = car.mech;
            if (m.state === 'work' && m.f === home) this._startRepair(s, car);
            else if (m.state === 'work') { car.fix = null; this._refresh(s, car); this._mechTrip(m, 'job', { f: home, x: this.svcX(s, home), room: null }); }
          }
          return;
        }
        car.target = home; car.dir = home > car.y ? 1 : -1; car.state = 'moving';
        return;
      }
      // moving: stop only for riders and at the service floor
      let y = car.y, rem = def.speed * dt * (car.wear >= CFG.wear.slowAt ? CFG.wear.slowFactor : 1) * this.powerK;
      const lo = s.twin ? car.lo : s.f0, hi = s.twin ? car.hi : s.f1;
      while (rem > 0) {
        const next = car.dir > 0 ? Math.floor(y + 1e-6) + 1 : Math.ceil(y - 1e-6) - 1;
        if (next < lo || next > hi) { car.y = Math.max(lo, Math.min(hi, Math.round(y))); car.dir = 0; car.state = 'idle'; car.target = null; return; }
        const dist = Math.abs(next - y);
        if (dist > rem + 1e-6) { y += car.dir * rem; rem = 0; break; }
        y = next; rem = Math.max(0, rem - dist);
        this._wear(s, car, def.wearPerFloor);
        if (this._servesStop(s, next) && car.pax.some(p => (s.dbl ? p.legTo - p.deck : p.legTo) === next)) { this._openDoors(s, car, next); return; }
        if (!car.pax.length && (car.target === next || car.target == null)) { car.y = next; car.state = 'idle'; car.dir = 0; car.target = null; return; }
      }
      car.y = y;
    }

    _shouldStop(s, car, f) {
      if (s.dbl) return this._shouldStopDouble(s, car, f);
      if (!this.serves(s, f)) return false;
      if (s.twin) {   // TWIN: riders, the car's own queue, its target, or the end of its way
        for (const p of car.pax) if (p.legTo === f) return true;
        const q = this._tq(s, car, f, car.dir > 0);
        if (q.length && car.pax.length < CFG.shafts[s.kind].cap) return true;
        return car.target === f || !this._requestsBeyond(s, car, f, car.dir);
      }
      for (const p of car.pax) if (p.legTo === f) return true;
      const i = f - s.f0;
      const q = car.dir > 0 ? s.qUp[i] : s.qDown[i];
      if (q.length && car.pax.length < CFG.shafts[s.kind].cap) return true;
      if (car.target === f) return true;
      if (!this._requestsBeyond(s, car, f, car.dir)) return true;
      return false;
    }

    // double deck (E13): stops only on f0, f0 + 2, …; riders of either deck, waiting people on f or f + 1 with room on their deck
    _shouldStopDouble(s, car, f) {
      if (((f - s.f0) & 1) || !this._servesStop(s, f)) return false;
      for (const p of car.pax) if (p.legTo - p.deck === f) return true;
      const half = CFG.shafts[s.kind].cap / 2;
      for (let d = 0; d < 2; d++) {
        const g = f + d;
        if (g > s.f1 || !this.serves(s, g)) continue;
        const q = car.dir > 0 ? s.qUp[g - s.f0] : s.qDown[g - s.f0];
        if (!q.length) continue;
        let on = 0;
        for (const p of car.pax) if (p.deck === d) on++;
        if (on < half) return true;
      }
      if (car.target === f) return true;
      if (!this._requestsBeyond(s, car, f, car.dir)) return true;
      return false;
    }

    // ----- info for UI -----
    roomStatus(r) {
      if (r.type === 'skylobby') return 'lobby';
      if ((r.type === 'office' || r.type === 'condo') && !r.occupied) return this.roomReachable(r) ? 'vacant' : 'unreachable';
      if ((r.type === 'workshop' || CFG.rooms[r.type].seats || CFG.rooms[r.type].suites || CFG.rooms[r.type].spaces) && !this.roomReachable(r)) return 'unreachable';
      const sc = this.tripScore(r);
      if (sc == null) return 'good';
      return sc <= CFG.goodMin ? 'good' : sc <= CFG.okMin ? 'ok' : 'bad';
    }

    liveAvg(r) { return r.tripN > 0 ? r.tripSum / r.tripN : null; }

    // Ø share of energy left on arrival (today, else yesterday), null = no trips yet
    liveEnergy(r) { return r.eN > 0 ? r.eSum / r.eN : r.eLast; }

    // heatmap "Energie": good = fresh, ok = tired, bad = exhausted
    energyStatus(r) {
      const st = this.roomStatus(r);
      if (st === 'vacant' || st === 'unreachable' || st === 'lobby') return st;
      const e = this.liveEnergy(r);
      if (e == null) return 'none';
      return e >= CFG.energyGood ? 'good' : e >= CFG.energyOk ? 'ok' : 'bad';
    }
  }

  const api = { CFG, Game, floorName, fmtTime, needShare, needWarn, capOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TowerEngine = api;
})(this);
