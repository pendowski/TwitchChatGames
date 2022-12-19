const database = require('../database')
const Bot = require('../guess_bot')

beforeEach(() => {
    this.db = database(":memory:")
    this.bot = new Bot(this.db)

    this.testGuess = async (title) => {
        return await this.bot.handleMessage("channel", { username: "User"}, title)
    }
})

test("removing words", async () => {
    this.bot.setGuess(["The Godfather Part II", "The Godfather Part 2"], 2)

    expect(await this.testGuess("godfather")).toBeTruthy()

    this.bot.setGuess(["Gabriel's Inferno: Part III"], 3)

    expect(await this.testGuess("gabriel inferno")).toBeTruthy()
})

test("guessing correctly", async () => {
    this.bot.setGuess(["The Godfather Part II", "The Godfather Part 2"], 2)

    expect(await this.testGuess("Godfather")).toBeTruthy()
})

test("longer message than necesary", async () => {
    this.bot.setGuess(["Neon Genesis Evangelion", "新世紀エヴァンゲリオン"], 2)

    expect(await this.testGuess("I think it's NEon Genesis Evangelion")).toBeTruthy()
})

test("wrong guess", async () => {
    this.bot.setGuess(["Neon Genesis Evangelion", "新世紀エヴァンゲリオン"], 2)

    expect(await this.testGuess("I think it's Neo Genesis Evangelion")).toBeFalsy()
})

test("Before setting the title", async () => {
    expect(await this.testGuess("I think it's Neo Genesis Evangelion")).toBeFalsy()
})

test("After reset", async () => {

    this.bot.setGuess(["Neon Genesis Evangelion", "新世紀エヴァンゲリオン"], 2)
    this.bot.resetGuess()

    expect(await this.testGuess("I think it's Neo Genesis Evangelion")).toBeFalsy()
})

test("Empty message", async () => {

    this.bot.resetGuess()
    expect(await this.testGuess(" ")).toBeFalsy()

    this.bot.setGuess(["Neon Genesis Evangelion", "新世紀エヴァンゲリオン"], 2)
    expect(await this.testGuess(" ")).toBeFalsy()
})

test("Removing accents", async () => {

    this.bot.setGuess(["Amélie", "Amélie"], 2)

    expect(await this.testGuess("amelie")).toBeTruthy()
})

test("Titles with special characters", async () => {

    this.bot.setGuess(["Frost/Nixon", "Frost/Nixon"], 2)

    expect(await this.testGuess("frost nixon")).toBeTruthy()
})