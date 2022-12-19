const tmi = require('tmi.js')
const accents = require('remove-accents')

class GuessBot {
    constructor(db, options, loginInfo) {
        this.db = db
        this.connected = false
        options = Object.assign({}, options)
        this.debug = options.debug || false

        this.client = new tmi.Client({
            options: { debug: false },
            identity: {
                username: loginInfo.username,
                password: loginInfo.oauthToken
            },
            channels: [ loginInfo.channel ]
        })

        this.client.on('message', async (channel, tags, message, own) => {
            if (own) { return }
            if (this.guess.tmdb_id > -1) {
                await this.handleMessage(channel, tags, message)
            }
        })
        this.client.on("connected", () => {
            console.log("Connected to Twitch chat")
            this.connected = true
        })
        this.client.on("disconnected", () => {
            console.log("Disconnected from Twitch chat")
            this.connected = false
        })

        this.skippedWords = new Set([
            'the', 'in', 'of', 'on', 'a', 'an', 'part', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'
        ])

        this.DefaultCurrentGuessing = {
            title: '',
            tmdb_id: -1
        }

        this.winnerCallback = () => {}
        this.guessCallback = () => {}

        this.guess = this.clone(this.DefaultCurrentGuessing)
        this.resetGuess()
    }

    setGuess(titles, id) {
        this.resetGuess()

        titles = Array.from(titles)

        this.guess.title = titles[0]
        this.guess.tmdb_id = id

        this.matching_words = titles.map(title => {
            return this.extractWords(title)
        }).filter(theset => {
            return theset.size > 0
        })
    }

    resetGuess() {
        this.guess = this.clone(this.DefaultCurrentGuessing)
        this.matching_words = []
        this.guesses = []
    }

    setCallbacks(winner, guess) {
        if (winner) {
            this.winnerCallback = winner
        }
        if (guess) {
            this.guessCallback = guess
        }
    }

    connect() {
        this.client.connect().catch(console.error)
    }

    async handleMessage(channel, tags, message) {
        if (this.guess.tmdb_id < 0) {
            return false
        }
        let messageWords = this.extractWords(message)

        let foundMatch = false
        for (let matches of this.matching_words) {
            let currentMatch = 0
            for (let word of messageWords) {
                if (matches.has(word)) {
                    currentMatch += 1
                }
            }
            if (currentMatch == matches.size) {
                foundMatch = true
                break
            }
        }

        this.guesses.push({ username: tags.username, message: message })
        if (foundMatch) {
                let additionalMessage = ''
                if (this.guesses.length > 10) {
                    additionalMessage = " That was a hard one!"
                }
                if (this.connected) {
                    await this.client.say(channel, `Congratulations @${tags.username}! You guessed the movie - it was "${this.guess.title}${additionalMessage}"`)
                } else if (this.debug) {
                    console.error("You're not connected to send the message")
                }
                this.db.prepare("INSERT INTO winners (tmdb_id, created_at, username, guess) VALUES(?, ?, ?, ?)").run(this.guess.tmdb_id, Date.now(), tags.username, message)
                this.winnerCallback(tags.username, this.guess.title)

                return true
        } else {
            this.db.prepare("INSERT INTO guesses (tmdb_id, created_at, username, guess) VALUES(?, ?, ?, ?)").run(this.guess.tmdb_id, Date.now(), tags.username, message)
        }
        this.guessCallback(tags.username)

        return false
    }

    // private

    clone(el) {
        return JSON.parse(JSON.stringify(el))
    }

    extractWords(title) {
        title = title || ''
        // Removing special characters
        title = title.replace(new RegExp("(/|!|\\?|,|\\.|:|\\\\)+", 'gi'), " ")
        title = title.replace(new RegExp("([ ]+)", "gi", "gi"), " ")
        title = title.replace(new RegExp("('s|'re|'t|\\-|\\+|=|\\(|\\))", "gi"), '')
        title = accents(title)
        let words = title.toLowerCase().split(' ')
        // remove words to be skipped (a, the, and)
        words = words.filter(word => {
            return !this.skippedWords.has(word) && word.length > 1
        })
        // remove numbers
        words = words.filter(word => {
            return !(parseInt(word) == word)
        })
        return new Set(words)
    }
}

module.exports = GuessBot