export const COMMANDS = [
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
];
