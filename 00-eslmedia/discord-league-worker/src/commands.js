export const COMMANDS = [
  {
    name: "help",
    description: "Show ESL bot commands",
    type: 1,
  },
  {
    name: "player",
    description: "Look up an ESL player",
    type: 1,
    options: [
      {
        name: "name",
        description: "Player name, for example Larry Bird",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "team",
    description: "Look up an ESL team",
    type: 1,
    options: [
      {
        name: "name",
        description: "Team name, for example AFC Richmond",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "league",
    description: "Show the current ESL league overview",
    type: 1,
  },
  {
    name: "youth",
    description: "Show youth rights/intake players for an ESL team",
    type: 1,
    options: [
      {
        name: "team",
        description: "Team name, for example Valencia",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "standings",
    description: "Show standings by tier",
    type: 1,
    options: [
      {
        name: "tier",
        description: "Tier, for example 3, ECL, or tier3",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "schedule",
    description: "Show recent results and next calendar month for a team",
    type: 1,
    options: [
      {
        name: "team",
        description: "Team name, for example Valencia",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "simrecap",
    description: "Show a team's latest monthly sim recap",
    type: 1,
    options: [
      {
        name: "team",
        description: "Team name, for example Benfica",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
];
