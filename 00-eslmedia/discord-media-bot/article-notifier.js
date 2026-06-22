import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export function createArticleNotifier(options) {
  const {
    botToken,
    channelId,
    roleId = "",
    source,
    articleBaseUrl,
    checkIntervalMs,
    stateDir,
    maxAnnouncementsPerRun = 3
  } = options;
  const statePath = path.join(stateDir, "announced-articles.json");

  async function checkForNewArticles() {
    if (!botToken || !channelId) {
      console.log("Article notifier skipped: missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID.");
      return;
    }

    const articles = loadArticles(resolveSourcePath(source));
    const announced = loadState();

    const freshArticles = articles
      .filter((article) => !announced.includes(article.file))
      .sort((a, b) => (a.sortKey || "").localeCompare(b.sortKey || ""));

    if (!freshArticles.length) {
      console.log("No new articles to announce.");
      return;
    }

    let announcedCount = 0;

    for (const article of freshArticles.slice(0, maxAnnouncementsPerRun)) {
      const result = await sendArticleAnnouncement(article);

      if (result.rateLimited) {
        console.log(`Discord rate limited article notifier. Stopping this run; retry after ${result.retryAfterMs}ms.`);
        break;
      }

      announced.push(article.file);
      saveState(announced);
      announcedCount += 1;
    }

    console.log(`Announced ${announcedCount} of ${freshArticles.length} new article(s).`);
  }

  function startWatching() {
    console.log(`Watching for new ESL Media articles every ${checkIntervalMs}ms...`);
    setInterval(() => {
      checkForNewArticles().catch((error) => {
        console.error("Watcher check failed:", error);
      });
    }, checkIntervalMs);
  }

  function resolveSourcePath(articleSource) {
    return path.isAbsolute(articleSource) ? articleSource : path.resolve(stateDir, "..", articleSource);
  }

  function loadArticles(sourcePath) {
    const sourceText = fs.readFileSync(sourcePath, "utf8");
    const context = { window: {} };
    vm.runInNewContext(sourceText, context, { filename: sourcePath });
    const articles = context.window?.ESL_MEDIA_ARTICLES;

    if (!Array.isArray(articles)) {
      throw new Error("Could not parse ESL_MEDIA_ARTICLES from media manifest.");
    }

    return articles;
  }

  function loadState() {
    ensureStateDir();

    if (!fs.existsSync(statePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(statePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveState(announced) {
    ensureStateDir();
    fs.writeFileSync(statePath, JSON.stringify(announced, null, 2));
  }

  function ensureStateDir() {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
  }

  async function sendArticleAnnouncement(article) {
    const url = new URL(article.file, articleBaseUrl).toString();
    const roleMention = roleId ? `<@&${roleId}> ` : "";

    const payload = {
      content: `${roleMention}New ESL Media article just dropped.`,
      embeds: [
        {
          title: article.title,
          url,
          description: article.blurb,
          color: 0x111b36,
          fields: [
            { name: "Desk", value: article.desk || article.category || "Media", inline: true },
            { name: "Writer", value: article.author || "ESL Media", inline: true },
            { name: "Tag", value: article.tag || "Feature", inline: true }
          ],
          footer: {
            text: "European Super League Media"
          }
        }
      ]
    };

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();

      if (response.status === 429) {
        return {
          rateLimited: true,
          retryAfterMs: getRetryAfterMs(response, body)
        };
      }

      throw new Error(`Discord API error ${response.status}: ${body}`);
    }

    return {
      rateLimited: false,
      retryAfterMs: 0
    };
  }

  return {
    checkForNewArticles,
    startWatching
  };
}

function getRetryAfterMs(response, body) {
  const retryAfterHeader = Number(response.headers.get("retry-after"));

  if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
    return Math.ceil(retryAfterHeader * 1000);
  }

  try {
    const parsed = JSON.parse(body);
    const retryAfter = Number(parsed.retry_after);

    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.ceil(retryAfter * 1000);
    }
  } catch {
    // Fall through to the conservative default.
  }

  return 60000;
}
