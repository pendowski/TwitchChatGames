module.exports = function(path) {
    const sqlite = require('better-sqlite3')
    const db = sqlite(path)

    db.exec("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, visible INTEGER DEFAULT 1)")
    db.exec("CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, answer TEXT, alt_answers TEXT, image TEXT, visible INTEGER DEFAULT 1)")
    db.exec("CREATE TABLE IF NOT EXISTS question_to_category(question_id INTEGER, category_id INTEGER, FOREIGN KEY(question_id) REFERENCES questions(id), FOREIGN KEY category_id REFERENCES categories(id), PRIMARY KEY (question_id, category_id)")
    db.exec("CREATE TABLE IF NOT EXISTS packs(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, author TEXT, url TEXT, custom INTEGER DEFAULT 0, visible INTEGER DEFAULT 1)")
    db.exec("CREATE TABLE IF NOT EXISTS question_to_pack (question_id INTEGER, pack_id INTEGER, FOREIGN KEY(question_id) REFERENCES questions(id), FOREIGN KEY(pack_id) REFERENCES packs(id)")
    db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE PRIMARY KEY, value TEXT)")

    db.exec("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, session_key TEXT UNIQUE, created_at INTEGER NOT NULL, ended_at INTEGER)")

    db.exec("CREATE TABLE IF NOT EXISTS guesses (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER, pack_id INTEGER, session_id INTEGER, answer TEXT, username TEXT, created_at INTEGER, FOREIGN KEY(session_id) REFERENCES sessions(id))")
    db.exec("CREATE TABLE IF NOT EXISTS winners (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER, pack_id INTEGER, session_id INTEGER, answer TEXT, username TEXT, created_at INTEGER, FOREIGN KEY(session_id) REFERENCES sessions(id))")

    return db
}