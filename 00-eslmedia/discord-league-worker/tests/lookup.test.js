import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  findAutocompleteChoices,
  handleHelp,
  handleLeague,
  handlePlayer,
  handleResignings,
  handleSchedule,
  handleSimRecap,
  handleStandings,
  handleTeam,
  handleYouth,
} from "../src/lookup.js";

const root = path.resolve("..", "..");
const discordDir = path.join(root, "00-build", "database", "discord");

const players = JSON.parse(fs.readFileSync(path.join(discordDir, "players.json"), "utf8"));
const teams = JSON.parse(fs.readFileSync(path.join(discordDir, "teams.json"), "utf8"));
const league = JSON.parse(fs.readFileSync(path.join(discordDir, "league.json"), "utf8"));
const databaseDir = path.join(root, "00-build", "database");
const youthIntake = JSON.parse(fs.readFileSync(path.join(databaseDir, "youth_intake.json"), "utf8"));
const standings = JSON.parse(fs.readFileSync(path.join(databaseDir, "standings.json"), "utf8"));
const schedule = JSON.parse(fs.readFileSync(path.join(databaseDir, "schedule.json"), "utf8"));
const monthlyTeamForm = JSON.parse(fs.readFileSync(path.join(databaseDir, "monthly", "monthly_team_form.json"), "utf8"));
const fullPlayers = JSON.parse(fs.readFileSync(path.join(databaseDir, "players.json"), "utf8"));
const playerStatsFeed = JSON.parse(fs.readFileSync(path.join(databaseDir, "player_stats.json"), "utf8"));
const fullPlayerStats = Array.isArray(playerStatsFeed?.players) ? playerStatsFeed.players : [];

const helpResponse = handleHelp();
assert.equal(helpResponse.type, 4);
assert.match(helpResponse.data.embeds[0].title, /Help/);

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

const youthResponse = handleYouth("Valencia", teams, youthIntake);
assert.equal(youthResponse.type, 4);
assert.equal(youthResponse.data.embeds[0].title, "Valencia Youth");
assert.match(youthResponse.data.embeds[0].fields[0].value, /OVR\/POT/);
assert.match(youthResponse.data.embeds[0].fields[0].value, /\[[^\]]+\]\(https:\/\/eurosuperleague\.github\.io\/index\/00-assets\/html\/unified-player\.htm\?id=player\d+\)/);

const standingsResponse = handleStandings("3", standings);
assert.equal(standingsResponse.type, 4);
assert.equal(standingsResponse.data.embeds[0].title, "ECL Standings");
assert.match(standingsResponse.data.embeds[0].description, /PROMO/);
assert.doesNotMatch(standingsResponse.data.embeds[0].description, /RELEG/);

const clbStandingsResponse = handleStandings("clb", standings);
assert.match(clbStandingsResponse.data.embeds[0].description, /CHAMP/);
assert.match(clbStandingsResponse.data.embeds[0].description, /RELEG/);

const elbStandingsResponse = handleStandings("2", standings);
assert.match(elbStandingsResponse.data.embeds[0].description, /PROMO/);
assert.match(elbStandingsResponse.data.embeds[0].description, /RELEG/);

const scheduleResponse = handleSchedule("Valencia", teams, schedule);
assert.equal(scheduleResponse.type, 4);
assert.equal(scheduleResponse.data.embeds[0].title, "Valencia Schedule");
assert.ok(scheduleResponse.data.embeds[0].fields.some((field) => field.name === "Next Calendar Month"));

const simRecapResponse = handleSimRecap("Benfica", teams, monthlyTeamForm);
assert.equal(simRecapResponse.type, 4);
assert.equal(simRecapResponse.data.embeds[0].title, "Benfica Sim Recap");
assert.match(simRecapResponse.data.embeds[0].description, /Record:/);

const resigningsResponse = handleResignings("", fullPlayers, fullPlayerStats, teams);
assert.equal(resigningsResponse.type, 4);
assert.equal(resigningsResponse.data.embeds[0].title, "FA Re-signing Rights");
assert.match(resigningsResponse.data.embeds[0].description, /FA players grouped/);

const teamResigningsResponse = handleResignings("Valencia", fullPlayers, fullPlayerStats, teams);
assert.equal(teamResigningsResponse.type, 4);
assert.match(teamResigningsResponse.data.embeds[0].title, /Re-signing Rights/);

console.log("lookup tests passed");
