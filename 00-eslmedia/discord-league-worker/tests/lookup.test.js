import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { findAutocompleteChoices, handleLeague, handlePlayer, handleTeam } from "../src/lookup.js";

const root = path.resolve("..", "..");
const discordDir = path.join(root, "00-build", "database", "discord");

const players = JSON.parse(fs.readFileSync(path.join(discordDir, "players.json"), "utf8"));
const teams = JSON.parse(fs.readFileSync(path.join(discordDir, "teams.json"), "utf8"));
const league = JSON.parse(fs.readFileSync(path.join(discordDir, "league.json"), "utf8"));

const playerResponse = handlePlayer("Larry Bird", players);
assert.equal(playerResponse.type, 4);
assert.match(playerResponse.data.embeds[0].title, /^Larry Bird/);
assert.ok(playerResponse.data.embeds[0].fields.some((field) => field.name === "PTS | REB | AST | STL | BLK"));

const playerMiss = handlePlayer("zzzz-no-player", players);
assert.match(playerMiss.data.content, /could not find a player/);

const autocompleteChoices = findAutocompleteChoices("lar", players, (player) => player.name);
assert.ok(autocompleteChoices.some((choice) => choice.name === "Larry Bird"));
assert.ok(autocompleteChoices.length <= 25);

const teamResponse = handleTeam("AFC Richmond", teams);
assert.equal(teamResponse.type, 4);
assert.equal(teamResponse.data.embeds[0].title, "AFC Richmond");

const leagueResponse = handleLeague(league);
assert.equal(leagueResponse.type, 4);
assert.equal(leagueResponse.data.embeds[0].title, "European Super League");

console.log("lookup tests passed");
