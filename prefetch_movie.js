const got = require('got')
const sqlite = require('better-sqlite3')
const path = require('path')
const stream = require('stream')
const fs = require('fs')
const { promisify } = require('util')

require('dotenv').config()

const API_KEY = process.env.API_KEY

const db = sqlite(path.join(__dirname, 'tmp', 'top_movies.sqlite'))
db.exec('CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY AUTOINCREMENT, tmdb_id INTEGER, place INTEGER, genres TEXT, title TEXT, original_title TEXT, adult INTEGER, poster_path TEXT, backdrop_path TEXT, should_download INTEGER DEFAULT 0, downloaded INTEGER DEFAULT 0)')

let tmdbConfiguration = {}
const pipeline = promisify(stream.pipeline)

async function fetchConfigurationIfNeeded() {
    let now = Date.now()
    if (tmdbConfiguration.fetchedAt && now - tmdbConfiguration.fetchedAt < 24 * 60 * 60 * 1000) {
        return tmdbConfiguration
    }
    tmdbConfiguration = await got(`https://api.themoviedb.org/3/configuration?api_key=${API_KEY}`).json()
    tmdbConfiguration.fetchedAt = now
}

async function fetchGenres() {
    let movies = await got(`https://api.themoviedb.org/3/genre/movie/list?api_key=${API_KEY}&language=en-US`).json()
    return movies
}

async function fetchTopRated(page, region = '') {
    page = page || 1
    console.log(`Fetching Top Rated from page ${page}`)
    let movies = await got(`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&language=en-US&region=${region}&page=${page}`).json()
    return movies
}

async function fetchMovieInfo(tmdb_id) {
    console.log(`Fetching ${tmdb_id}`)
    let movieDetails = await got(`https://api.themoviedb.org/3/movie/${tmdb_id}?api_key=${API_KEY}`).json()
    return movieDetails
}

function niceTime(ms) {
    let s = Math.floor(ms / 1000)
    let ranges = ['s', 'min', 'hours']
    let rangeIndex = 0
    let result = []
    while (s > 0) {
        let diff = s - Math.floor(s / 60) * 60
        result.push(`${diff}${ranges[rangeIndex]}`)
        rangeIndex += 1
        s = (s - diff) / 60
      	if (rangeIndex == ranges.length) { break; }
    }
    return result.reverse().join(' ')
}

async function downloadFromAPI() {
    let start = Date.now()

    let place = 1
    let genreResult = await fetchGenres()
    let genres = {}
    for (let genre of genreResult.genres) {
        genres[genre.id] = genre.name
    }

    for (let i = 1; i <= 100; i++) {
        let result = await fetchTopRated(i, 'US')
        let movies = result.results
        for (let movie of movies) {
            let movieGenres = movie.genre_ids.map(id => {
                return genres[id] || id 
            })
            if (db.prepare("SELECT COUNT(id) AS count FROM movies WHERE tmdb_id = ?").get(movie.id).count == 0) {
                db.prepare("INSERT INTO movies (tmdb_id, place, genres, title, original_title, adult, poster_path, backdrop_path) VALUES(?, ?, ?, ?, ?, ?, ?, ?)").run(movie.id, place, movieGenres.join(','), movie.title, movie.original_title, movie.adult ? 1 : 0, movie.poster_path, movie.backdrop_path)
            }
            place += 1
        }
    }

    let time = niceTime(Date.now() - start)

    console.log(`Added ${place - 1} movies to the database in ${time}`)
}

async function downloadPosters() {
    let start = Date.now()

    await fetchConfigurationIfNeeded()

    let posters = 0
    let movies = db.prepare("SELECT * FROM movies WHERE should_download > 0 AND downloaded = 0 ORDER BY place").all()
    for (let movie of movies) {
        let url = `${tmdbConfiguration.images.base_url}original${movie.poster_path}`
        await pipeline(
            got.stream(url),
            fs.createWriteStream(path.join(__dirname, 'tmp', 'posters', `${movie.tmdb_id}_original.jpg`))
        )

        if (movie.backdrop_path) {
            let backdropURL = `${tmdbConfiguration.images.base_url}original${movie.backdrop_path}`
            await pipeline(
                got.stream(backdropURL),
                fs.createWriteStream(path.join(__dirname, 'tmp', 'posters', `${movie.tmdb_id}_back_original.jpg`))
            )
        }
        db.prepare("UPDATE movies SET downloaded = 1 WHERE id = ?").run(movie.id)

        posters += 1
    }

    let time = niceTime(Date.now() - start)
    console.log(`Added ${posters - 1} posters in ${time}`)
}

async function main() {
    // await downloadFromAPI()
    await downloadPosters()
}
main()