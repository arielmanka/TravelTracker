"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let dbInstance = null;
/**
 * Connects to the SQLite database, ensuring directories exist, and initializes schemas.
 */
async function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    const dbPath = process.env.DATABASE_PATH || './data/travel_tracker.db';
    // Ensure the directory path exists
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    // Open sqlite database
    dbInstance = await (0, sqlite_1.open)({
        filename: dbPath,
        driver: sqlite3_1.default.Database
    });
    // Enable foreign key constraints in SQLite
    await dbInstance.run('PRAGMA foreign_keys = ON');
    // Create tables if they do not exist
    await initializeSchema(dbInstance);
    return dbInstance;
}
/**
 * Runs DDL statements to construct tables if they are missing
 */
async function initializeSchema(db) {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      country TEXT NOT NULL,
      city TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      exit_date TEXT NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      location TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      amount REAL,
      currency TEXT,
      notes TEXT,
      FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS limit_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country TEXT NOT NULL UNIQUE,
      max_days INTEGER NOT NULL,
      rolling_period_days INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
      UNIQUE(country_id, name)
    );

    CREATE TABLE IF NOT EXISTS journey_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country TEXT NOT NULL,
      city TEXT NOT NULL,
      entry_time TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      location TEXT NOT NULL,
      amount REAL,
      currency TEXT,
      notes TEXT
    );
  `);
    await seedDefaultCountriesAndCities(db);
    console.log('SQLite schemas verified and initialized.');
}
async function seedDefaultCountriesAndCities(db) {
    // Map of every registered European country to its major cities.
    // We insert a country if it is missing, and add cities that do not yet exist
    // for that country, so re-running on an existing database is safe.
    const COUNTRY_CITIES = {
        'Albania': ['Tirana', 'Durrës', 'Vlorë', 'Elbasan', 'Shkodër', 'Fier', 'Korçë', 'Berat', 'Lushnjë', 'Kavajë'],
        'Andorra': ['Andorra la Vella', 'Escaldes-Engordany', 'Encamp', 'Sant Julià de Lòria', 'La Massana'],
        'Armenia': ['Yerevan', 'Gyumri', 'Vanadzor', 'Vagharshapat', 'Hrazdan', 'Abovyan', 'Kapan', 'Gavar'],
        'Austria': ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'St. Pölten', 'Dornbirn'],
        'Azerbaijan': ['Baku', 'Ganja', 'Sumqayıt', 'Mingəçevir', 'Nakhchivan', 'Shirvan', 'Lankaran'],
        'Belarus': ['Minsk', 'Gomel', 'Mogilev', 'Vitebsk', 'Grodno', 'Brest', 'Bobruisk', 'Baranovichi'],
        'Belgium': ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liège', 'Namur', 'Leuven', 'Charleroi', 'Mons', 'Kortrijk', 'Mechelen'],
        'Bosnia and Herzegovina': ['Sarajevo', 'Banja Luka', 'Mostar', 'Tuzla', 'Zenica', 'Bijeljina', 'Brčko', 'Foča'],
        'Bulgaria': ['Sofia', 'Plovdiv', 'Varna', 'Burgas', 'Ruse', 'Stara Zagora', 'Pleven', 'Sliven', 'Dobrich', 'Shumen'],
        'Croatia': ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Pula', 'Slavonski Brod', 'Karlovac', 'Dubrovnik'],
        'Cyprus': ['Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia'],
        'Czech Republic': ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice', 'Hradec Králové', 'Pardubice'],
        'Denmark': ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers', 'Kolding', 'Horsens', 'Vejle', 'Frederiksberg'],
        'Estonia': ['Tallinn', 'Tartu', 'Narva', 'Pärnu', 'Kohtla-Järve', 'Viljandi', 'Rakvere'],
        'Finland': ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu', 'Turku', 'Jyväskylä', 'Lahti', 'Kuopio', 'Pori'],
        'France': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Grenoble', 'Toulon', 'Rouen', 'Dijon', 'Angers', 'Nîmes', 'Villeurbanne', 'Le Mans'],
        'Georgia': ['Tbilisi', 'Kutaisi', 'Batumi', 'Rustavi', 'Gori', 'Zugdidi', 'Poti'],
        'Germany': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden', 'Hanover', 'Nuremberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster'],
        'Greece': ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa', 'Volos', 'Ioannina', 'Chania', 'Chalcis', 'Rhodes', 'Kavala', 'Serres'],
        'Hungary': ['Budapest', 'Debrecen', 'Miskolc', 'Szeged', 'Pécs', 'Győr', 'Nyíregyháza', 'Kecskemét', 'Székesfehérvár'],
        'Iceland': ['Reykjavík', 'Kópavogur', 'Hafnarfjörður', 'Akureyri', 'Reykjanesbær', 'Garðabær'],
        'Ireland': ['Dublin', 'Cork', 'Limerick', 'Galway', 'Waterford', 'Drogheda', 'Dundalk', 'Swords', 'Bray', 'Navan'],
        'Italy': ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Bari', 'Catania', 'Venice', 'Verona', 'Messina', 'Padua', 'Trieste', 'Brescia', 'Taranto', 'Prato', 'Modena', 'Reggio Calabria'],
        'Kazakhstan': ['Almaty', 'Nur-Sultan', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz', 'Pavlodar'],
        'Kosovo': ['Pristina', 'Prizren', 'Peja', 'Mitrovica', 'Gjakova', 'Gjilan'],
        'Latvia': ['Riga', 'Daugavpils', 'Liepāja', 'Jelgava', 'Jūrmala', 'Ventspils', 'Rēzekne'],
        'Liechtenstein': ['Vaduz', 'Schaan', 'Balzers', 'Triesen', 'Eschen'],
        'Lithuania': ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys', 'Alytus', 'Marijampolė'],
        'Luxembourg': ['Luxembourg City', 'Esch-sur-Alzette', 'Differdange', 'Dudelange', 'Ettelbruck'],
        'Malta': ['Valletta', 'Birkirkara', 'Mosta', 'Qormi', 'San Ġwann', 'Sliema', 'Żabbar', 'St. Julian\'s'],
        'Moldova': ['Chișinău', 'Tiraspol', 'Bălți', 'Bender', 'Rîbnița', 'Cahul'],
        'Monaco': ['Monaco', 'Monte Carlo', 'La Condamine', 'Fontvieille'],
        'Montenegro': ['Podgorica', 'Nikšić', 'Herceg Novi', 'Bar', 'Bijelo Polje', 'Berane', 'Cetinje'],
        'Netherlands': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen', 'Enschede', 'Haarlem', 'Arnhem', 'Zaanstad'],
        'North Macedonia': ['Skopje', 'Bitola', 'Kumanovo', 'Prilep', 'Tetovo', 'Veles', 'Ohrid'],
        'Norway': ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen', 'Fredrikstad', 'Kristiansand', 'Tromsø', 'Sandnes', 'Sarpsborg'],
        'Poland': ['Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Bydgoszcz', 'Lublin', 'Białystok', 'Katowice', 'Gdynia', 'Częstochowa', 'Radom', 'Sosnowiec', 'Toruń', 'Rzeszów'],
        'Portugal': ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Funchal', 'Setúbal', 'Aveiro', 'Évora', 'Faro', 'Guimarães'],
        'Romania': ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov', 'Galați', 'Ploiești', 'Oradea', 'Brăila', 'Arad'],
        'Russia': ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Chelyabinsk', 'Samara', 'Ufa', 'Rostov-on-Don', 'Omsk', 'Krasnoyarsk', 'Voronezh', 'Perm'],
        'San Marino': ['San Marino', 'Serravalle', 'Borgo Maggiore', 'Domagnano'],
        'Serbia': ['Belgrade', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica', 'Zrenjanin', 'Čačak', 'Pančevo', 'Kragujevac', 'Šabac'],
        'Slovakia': ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Nitra', 'Banská Bystrica', 'Trnava', 'Martin'],
        'Slovenia': ['Ljubljana', 'Maribor', 'Celje', 'Kranj', 'Velenje', 'Koper', 'Novo Mesto', 'Ptuj'],
        'Spain': ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Granada', 'Elche', 'Oviedo', 'Badalona', 'Cartagena', 'Tarragona'],
        'Sweden': ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle'],
        'Switzerland': ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Winterthur', 'Lucerne', 'St. Gallen', 'Lugano', 'Biel/Bienne', 'Thun', 'Köniz'],
        'Turkey': ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Adana', 'Gaziantep', 'Konya', 'Antalya', 'Kayseri', 'Mersin', 'Eskişehir', 'Diyarbakır', 'Samsun', 'Denizli', 'Trabzon'],
        'Ukraine': ['Kyiv', 'Kharkiv', 'Odessa', 'Dnipro', 'Donetsk', 'Zaporizhzhia', 'Lviv', 'Kryvyi Rih', 'Mykolaiv', 'Mariupol', 'Luhansk', 'Vinnytsia', 'Makiivka', 'Sevastopol'],
        'United Kingdom': ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Leeds', 'Liverpool', 'Edinburgh', 'Bristol', 'Sheffield', 'Cardiff', 'Belfast', 'Leicester', 'Nottingham', 'Newcastle', 'Southampton', 'Brighton', 'Oxford', 'Cambridge', 'Bath', 'York'],
        'Vatican City': ['Vatican City'],
    };
    await db.run('BEGIN TRANSACTION');
    try {
        for (const [countryName, cities] of Object.entries(COUNTRY_CITIES)) {
            // Insert country if it doesn't exist yet
            await db.run('INSERT OR IGNORE INTO countries (name) VALUES (?)', [countryName]);
            const row = await db.get('SELECT id FROM countries WHERE name = ?', [countryName]);
            if (!row)
                continue;
            const countryId = row.id;
            // Insert each city if it doesn't exist for this country
            for (const city of cities) {
                await db.run('INSERT OR IGNORE INTO cities (country_id, name) VALUES (?, ?)', [countryId, city]);
            }
        }
        await db.run('COMMIT');
        console.log('Country and city seed complete.');
    }
    catch (error) {
        await db.run('ROLLBACK');
        console.error('Failed to seed countries and cities:', error);
    }
}
