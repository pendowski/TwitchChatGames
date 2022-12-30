# TwitchChatGames

A set of games to engage your Twitch viewers into being part of the stream.

Guessing the movie, game, who's that pokemon and whatever you think of.

![Preview of one of the games](https://shaw.stream/pixelated.gif)

## Installation

To install the dependencies use your manager of choice
```npm install```
or
```yarn install```

The project uses environment variables to be configured. You can also use `.env` file to set them in one file.

| Name | Default | Description |
| -- | -- | -- |
| PORT | 8080 | HTTP Server Port |
| WSPORT | 8181 | WebSocket Port used as a communication channel between the server, twitch chat and the website |
| TWITCH_USERNAME | - | Twitch username of your bot |
| TWITCH_TOKEN | - | Twitch OAuth token for your bot account |
| TWITCH_CHANNEL | - | Name of your Twitch channel |
| API_KEY | - | TMDB API Key to be able to download latest movie data and posters |

You have to be a [registered Twitch developer](https://dev.twitch.tv) to be able to generate the token for your Twitch username/bot.

Same goes for downloading movie data from [TMDB API](https://developers.themoviedb.org).
