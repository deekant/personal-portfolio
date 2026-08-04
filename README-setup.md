# Webflow → Cloudflare Pages auto-deploy pipeline

Publish in Webflow Designer as normal → the live site gets mirrored and
pushed to GitHub automatically → Cloudflare Pages redeploys. No manual
export/reupload, ever.

## How it fits together

```
Webflow (you hit Publish)
   -> site_publish webhook
      -> Cloudflare Worker (webhook-relay.js)
         -> GitHub repository_dispatch
            -> GitHub Action (mirror-deploy.yml)
               -> wget --mirror the live .webflow.io site
               -> commits mirrored files to the repo
                  -> Cloudflare Pages (already watching the repo) auto-deploys
```

## Setup steps

### 1. Create the GitHub repo
A plain repo is fine - this is where the mirrored static files will live.
Push this folder's `.github/workflows/mirror-deploy.yml` into it as a
starting point.

### 2. Add one repo secret
Repo -> Settings -> Secrets and variables -> Actions -> New repository secret:

- `WEBFLOW_SITE_URL` = `https://kantalinskydima.webflow.io/`
  (or your custom domain if you point one at Webflow's hosting later)

### 3. Create a GitHub Personal Access Token
Used by the Cloudflare Worker to trigger the Action.
Settings -> Developer settings -> Personal access tokens -> generate one
scoped to `repo` (classic) or Contents: Read & write + Metadata: Read-only
(fine-grained, scoped to just this repo). Copy it - you'll paste it once
into the Worker secret in step 4.

### 4. Deploy the Cloudflare Worker
From `cloudflare-worker/`:

```bash
npm install -g wrangler   # if you don't have it already
wrangler login
```

Edit `wrangler.toml` and set `GITHUB_OWNER` / `GITHUB_REPO` to your actual
values, then:

```bash
wrangler deploy
wrangler secret put GITHUB_TOKEN
# paste the PAT from step 3 when prompted
```

`wrangler deploy` prints your Worker's URL, something like:
`https://webflow-publish-relay.<your-subdomain>.workers.dev`
Keep this - you need it for step 6.

### 5. Connect Cloudflare Pages to the repo
Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git
-> pick the repo. Build settings:
- Framework preset: **None**
- Build command: *(leave empty)*
- Build output directory: `/` (repo root, since the mirror writes there)

### 6. Register the Webflow webhook
Tell me your deployed Worker URL from step 4 and I'll register the
`site_publish` webhook on your site directly through the Webflow connector -
no manual step needed on your end for this part.

### 7. Test it end to end
Make a small change in Webflow Designer, hit Publish, then:
- Check the repo's **Actions** tab - a "Mirror published Webflow site" run
  should start within a few seconds
- Once it finishes (usually well under a minute for a small site), check
  Cloudflare Pages' deployment log - a new deploy should kick off
  automatically
- Confirm the change is live on your Cloudflare Pages URL

## Notes / things worth knowing

- **Forms and CMS**: intentionally not handled here since you don't use
  them. If that ever changes, this pipeline would need real rework (see
  the earlier conversation about Webflow's export limitations).
- **wget mirror quirks**: very occasionally a static mirror handles deeply
  nested relative paths slightly differently than Webflow's own hosting.
  Worth a visual pass over the mirrored site after the first couple of
  publishes to confirm nothing looks off, then it's normally maintenance-free.
- **Manual re-trigger**: the Action also supports `workflow_dispatch`, so
  you can re-run the mirror from the Actions tab anytime without needing
  to republish in Webflow.
- **Custom domain**: point your actual domain at Cloudflare Pages (not at
  Webflow) in Cloudflare DNS - Webflow's `.webflow.io` URL is only used
  internally here as the mirror source.
