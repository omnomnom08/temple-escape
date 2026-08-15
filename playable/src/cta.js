// Where the call to action goes. ONE literal, because it is needed in two places that cannot
// see each other: game.js opens it directly when no SDK is present, and vite.config.js feeds it
// to @smoud/playable-sdk as the APP_STORE_URL / GOOGLE_PLAY_URL build-time defines the SDK
// resolves its own destination from.
//
// Written twice, those two drift, and the failure is silent — the click simply goes nowhere,
// which is exactly what happened when only game.js had a URL.
export const CTA_URL = 'https://youtu.be/-bTpp8PQSog?si=mtGKrW1uW5TX2WPX&t=6';
