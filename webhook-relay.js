/**
 * Webflow → GitHub publish relay
 *
 * Webflow's native webhooks can only POST to a plain URL with no custom
 * headers, so they can't authenticate directly against GitHub's API.
 * This tiny Worker sits in between: it receives Webflow's site_publish
 * webhook, then fires an authenticated repository_dispatch event at
 * GitHub, which triggers the mirror-and-deploy Action.
 *
 * Deploy with: wrangler deploy
 * Requires one secret: GITHUB_TOKEN (a GitHub PAT with `repo` scope)
 * Requires two vars (set in wrangler.toml or dashboard):
 *   GITHUB_OWNER  - your GitHub username or org
 *   GITHUB_REPO   - the repo name Cloudflare Pages is watching
 */

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Optional but recommended: verify this really came from Webflow.
    // Webflow signs webhook payloads - see WEBFLOW_WEBHOOK_SECRET below
    // if you want to add signature verification later. For a personal
    // portfolio site this is a reasonable v1 to ship without it.

    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return new Response("Invalid JSON payload", { status: 400 });
    }

    const githubResponse = await fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "webflow-publish-relay",
        },
        body: JSON.stringify({
          event_type: "webflow-publish",
          client_payload: {
            publishedOn: payload.publishedOn || new Date().toISOString(),
            siteId: payload.site_id || payload.siteId || null,
          },
        }),
      }
    );

    if (!githubResponse.ok) {
      const errText = await githubResponse.text();
      return new Response(
        `GitHub dispatch failed: ${githubResponse.status} ${errText}`,
        { status: 502 }
      );
    }

    return new Response("OK - mirror deploy triggered", { status: 200 });
  },
};
