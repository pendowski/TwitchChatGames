const got = require('got')
const fastify = require('fastify')
const path = require('path')
const ws = require('ws')

const database = require('./database')
const importMovies = require('./movie_import')
const Bot = require('./guess_bot')

require('dotenv').config()

const PORT = process.env.PORT || 8080
const WSPORT = process.env.WSPORT || 8181
const API_KEY = process.env.API_KEY
const app = fastify()

const db = database(path.join(__dirname, 'tmp', 'movies.sqlite'))
const wss = new ws.WebSocketServer({ port: WSPORT })
let bot = new Bot(db, {}, {
    username: process.env.TWITCH_USERNAME,
    oauthToken: process.env.TWITCH_TOKEN,
    channel: process.env.TWITCH_CHANNEL
})

console.log(`Using TMDB Key: ${API_KEY}`)

let tmdbConfiguration = {}

let Settings = {
    'category': {
        title: 'Category',
        value: 'toprated',
        type: 'enum',
        options: ['toprated', 'popular']
    },
    'min': {
        title: 'Minimum Page',
        value: 1,
        type: 'integer'
    },
    'max': {
        title: 'Maximum Page',
        value: 10,
        type: 'integer'
    },
    'tick': {
        title: 'Pixelation Tick Length (ms)',
        value: 3000,
        type: 'integer'
    },
    'intro': {
        title: 'Time for the Intro screen (ms)',
        value: 8000,
        type: 'integer'
    }
}

function reloadSettings() {
    let rows = db.prepare('SELECT key, value FROM settings').all()
    let settings = JSON.parse(JSON.stringify(Settings))
    for (const row of rows) {
        settings[row.key].value = row.value
    }
    return settings
}
Settings = reloadSettings()
console.log("Settings", Settings)

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        console.log(data)
    })
})

function wssBroadcast(json) {
    wss.clients.forEach(client => {
        client.send(JSON.stringify(json))
    })
}

app.register(require("@fastify/view"), {
    engine: {
      eta: require("eta"),
    },
    root: path.join(__dirname, 'views')
})

app.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/',
})

app.get('/update', async (req, res) => {
    res.view('update.eta')
})

app.get('/performupdate', async (req, res) => {
    await importMovies(db, console.log)
})

app.get('/twitch', async (req, res) => {
    res.view('twitch.eta')
})

app.get('/poster', async (req, res) => {
    res.view('poster.eta', {
        web_socket_port: WSPORT,
        tick_length: Settings.tick.value,
        auto_play: req.query.auto == 'true' || false,
        intro_time: Settings.intro.value
    })
})

app.get('/randomlocal', async (req, res) => {
    await fetchConfigurationIfNeeded()
    let minPopularity = req.query.min_popularity || 0.0
    let maxPolularity = req.query.max_popularity || 90000.0
    let tmdb_id = db.prepare("SELECT tmdb_id FROM movies WHERE popularity >= ? AND popularity <= ? AND adult = 0 ORDER BY RANDOM() LIMIT 1").get(minPopularity, maxPolularity)
    let movieInfo = await fetchMovieInfo(tmdb_id.tmdb_id)
    movieInfo.poster_url = `${tmdbConfiguration.images.base_url}w780${movieInfo.poster_path}`
    res.send(movieInfo)
})

app.get('/random', async (req, res) => {
    await fetchConfigurationIfNeeded()
    res.redirect(`/random${Settings.category.value}`)
})

app.get('/randomtoprated', async (req, res) => {
    await fetchConfigurationIfNeeded()
    let minPage = parseInt(req.query.min  || Settings.min.value || 1)
    let maxPage = parseInt(req.query.max || Settings.max.value || 500)
    let page = randomInteger(minPage, maxPage)
    let movies = await fetchTopRated(page)
    let movieInfo = movies.results[Math.floor(Math.random() * movies.results.length)]
    movieInfo.poster_url = `${tmdbConfiguration.images.base_url}w780${movieInfo.poster_path}`
    res.send(movieInfo)
})

app.get('/randompopular', async (req, res) => {
    await fetchConfigurationIfNeeded()
    let minPage = parseInt(req.query.min  || Settings.min.value || 1)
    let maxPage = parseInt(req.query.max || Settings.max.value || 500)
    let page = randomInteger(minPage, maxPage)
    let movies = await fetchPopular(page)
    let movieInfo = movies.results[Math.floor(Math.random() * movies.results.length)]
    movieInfo.poster_url = `${tmdbConfiguration.images.base_url}w780${movieInfo.poster_path}`
    res.send(movieInfo)
})

app.get('/image', async (req, res) => {
    let url = req.query.url || ''
    if (url.length == 0) {
        return res.send({ error: 'Missing url parameter' })
    }
    console.log(`Fetching ${url}`)
    let downloadStream = await got(url)
    console.log(`Downloaded ${downloadStream.rawBody.length} of data`)
    res.send(downloadStream.rawBody)
})

app.get('/settings', async (req, res) => {
    let changedKeys = updateSettings(req)

    console.log("Updated", changedKeys)

    let rows = db.prepare('SELECT key, value FROM settings').all()
    let settings = JSON.parse(JSON.stringify(Settings))
    for (const row of rows) {
        settings[row.key].value = row.value
    }
    Settings = reloadSettings()
    res.send({
        settings: Settings,
        changedKeys: changedKeys
    })
})

app.post('/settings', async (req, res) => {
    let changedKeys = updateSettings(req)
    Settings = reloadSettings()
    res.send({
        settings: Settings,
        changedKeys: changedKeys
    })
})

function updateSettings(req) {
    let validKeys = Object.keys(Settings)
    let changedKeys = []

    function validate(key, value) {
        switch (Settings[key].type) {
            case 'integer':
                return Number.isInteger(value) ? true : Number.isInteger(parseInt(value))
            case 'enum':
                return Settings[key].options.indexOf(value) !== -1
            default:
                throw 'Unsupported type'
        }
    }

    for (const key of validKeys) {
        if (req.query[key] != null && validate(key, req.query[key])) {
            console.log("Found key", key, "with value", req.query[key])
            if (db.prepare("SELECT COUNT(key) AS count FROM settings WHERE key = ?").get(key).count > 0) {
                db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(req.query[key].trim(), key)
            } else {
                db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, req.query[key].trim())
            }
            changedKeys.push(key)
        }
    }
    return changedKeys
}

// Callbacks for the chat bot to know when to look for messages
app.get('/start', async (req, res) => {
    const title = req.query.title
    const alt_title = req.query.alt_title
    const tmdbid = req.query.tmdb_id

    bot.setGuess([title, alt_title], tmdbid)
    console.log(`Starting listening for answers ${title}`)

    res.send({
        title, alt_title
    })
})

app.get('/heartbeat', async (req, res) => {

})

app.get('/stop', async (req, res) => {
    bot.resetGuess()
    console.log(`Stopped listening for answers`)
})
// --  

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fetchConfigurationIfNeeded() {
    let now = Date.now()
    if (tmdbConfiguration.fetchedAt && now - tmdbConfiguration.fetchedAt < 24 * 60 * 60 * 1000) {
        return tmdbConfiguration
    }
    tmdbConfiguration = await got(`https://api.themoviedb.org/3/configuration?api_key=${API_KEY}`).json()
    tmdbConfiguration.fetchedAt = now
}

async function fetchTopRated(page, region = '') {
    page = page || 1
    console.log(`Fetching Top Rated from page ${page}`)
    let movies = await got(`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&language=en-US&region=${region}&page=${page}`).json()
    return movies
}

async function fetchPopular(page, region = '') {
    page = page || 1
    console.log(`Fetching Top Rated from page ${page}`)
    let movies = await got(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US&region=${region}&page=${page}`).json()
    return movies
}

async function fetchMovieInfo(tmdb_id) {
    console.log(`Fetching ${tmdb_id}`)
    let movieDetails = await got(`https://api.themoviedb.org/3/movie/${tmdb_id}?api_key=${API_KEY}`).json()
    return movieDetails
}

async function main() {
    await app.listen({
        port: PORT
    })
    console.log(`Server is running at ${PORT}`)
    console.log(`WebSocket server running at ${WSPORT}`)

    bot.connect()
    bot.setCallbacks((winner, title) => {
        console.log(`We have a winner: ${winner} with the title ${title}`)
        wssBroadcast({
            winner: winner
        })
    })
}
main()