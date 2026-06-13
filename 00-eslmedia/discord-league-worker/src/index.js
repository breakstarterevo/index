import nacl from "tweetnacl";
import { InteractionResponseType, InteractionType } from "discord-interactions";
import { loadCommandData } from "./data.js";
import { findAutocompleteChoices, handleCommand } from "./lookup.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "esl-discord-league-worker" });
    }

    if (request.method !== "POST" || url.pathname !== "/interactions") {
      return new Response("Not found", { status: 404 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");

    if (!env.DISCORD_PUBLIC_KEY) {
      console.error("Missing DISCORD_PUBLIC_KEY secret.");
      return new Response("Missing Discord public key", { status: 500 });
    }

    if (!signature || !timestamp) {
      console.error("Missing Discord signature headers.");
      return new Response("Missing Discord signature headers", { status: 401 });
    }

    const isValid = verifyDiscordRequest(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY);

    if (!isValid) {
      console.error("Discord signature verification failed.");
      return new Response("Bad request signature", { status: 401 });
    }

    const interaction = JSON.parse(rawBody);
    if (interaction.type === InteractionType.PING) {
      return json({ type: InteractionResponseType.PONG });
    }

    if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
      if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
        return json(await handleAutocomplete(interaction, env));
      }

      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "Unsupported interaction.", flags: 64 },
      });
    }

    try {
      const data = await loadCommandData(interaction.data.name, env);
      return json(handleCommand(interaction.data, data, env));
    } catch (error) {
      console.error(error);
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "I could not reach the live league data right now. Try again in a minute.",
          flags: 64,
        },
      });
    }
  },
};

async function handleAutocomplete(interaction, env) {
  const command = interaction.data;
  const focused = command.options?.find((option) => option.focused);
  const query = focused?.value || "";

  try {
    if (command.name === "player") {
      const data = await loadCommandData("player", env);
      return {
        type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: {
          choices: findAutocompleteChoices(query, data.players || [], (player) => player.name),
        },
      };
    }

    if (["team", "youth", "schedule", "simrecap", "resignings"].includes(command.name)) {
      const data = await loadCommandData("team", env);
      return {
        type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: {
          choices: findAutocompleteChoices(query, data.teams || [], (team) => team.name),
        },
      };
    }
  } catch (error) {
    console.error("Autocomplete failed:", error);
  }

  return {
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: { choices: [] },
  };
}

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function verifyDiscordRequest(rawBody, signature, timestamp, publicKey) {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + rawBody),
      hexToUint8Array(signature),
      hexToUint8Array(publicKey.trim()),
    );
  } catch (error) {
    console.error("Discord signature verification threw:", error);
    return false;
  }
}

function hexToUint8Array(hex) {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("Invalid hex value.");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
