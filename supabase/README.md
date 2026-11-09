# Burnaby DashCam Pros — Supabase Content Studio

A private web dashboard for your existing GitHub Pages website, **without Google Sheets or Apps Script**.

## One-time setup

1. Open [Supabase](https://supabase.com/dashboard/projects) and create or choose a project.
2. Go to **SQL Editor → New query**, paste the entire contents of [setup.sql](./setup.sql), and run it. This creates the content table, editor allowlist, secure Row Level Security (RLS) policies, image bucket, and a copy of the site's existing content.
3. In **Authentication → Users**, create a user with an email address and password. Use **Add user** and ensure the email is confirmed (or use your project's email-verification flow).
4. In **SQL Editor**, run this command, replacing the example with the exact email of the user you created:

   ```sql
   insert into public.cms_editors(user_id)
   select id from auth.users where lower(email) = lower('YOUR_EDITOR_EMAIL')
   on conflict (user_id) do nothing;
   ```

5. In **Project Settings → API Keys / Connect**, copy your Supabase **Project URL** (such as `https://abc.supabase.co`) and a **publishable** or legacy **anon** key.
6. Open **supabase-config.js** in the root of your GitHub repository and replace the two placeholders with that Project URL and the publishable/anon key. Commit the change.
7. Open **https://mshahrooz.github.io/Dashcam-Pro/admin/** and sign in with the user from step 3. Select a section, edit content, and click **Publish changes**.
8. Open **https://mshahrooz.github.io/Dashcam-Pro/** and refresh to see published content.

The live website reads changes directly from Supabase on every page visit, so there is no GitHub Actions polling delay. Existing content stays online from `cms-data.json` until you configure Supabase.

## Visual Editor (recommended for clients)

Open **https://mshahrooz.github.io/Dashcam-Pro/admin/** and sign in.

1. The dashboard opens the **Visual Editor** automatically, showing the real homepage inside the dashboard.
2. Scroll or use **Jump to** to find the section you want to change.
3. **Click the text, image, product, service, customer review, article, or vehicle brand** you want to edit.
4. Use the editing panel to the right (or bottom sheet on mobile). Your draft changes are reflected immediately in the preview.
5. Click **Publish changes** to save them to Supabase and make them live. The public website reflects updates after refresh, without rebuilding GitHub Pages.

You can use the **Desktop / Tablet / Mobile** buttons to preview responsive layouts. Click **Dashboard** to return to the original detailed editor, including SEO fields and multi-item management. **Discard edits** restores the last published version of the content if you haven't published yet.

**Important:** A preview edit is not public until you publish. The dashboard does not edit HTML layout or CSS; it edits the content fields that the website supports. Existing demo testimonials and other sample claims must be reviewed before publishing.

## What your dashboard can edit

- Website content: more than 130 headings, paragraphs, CTA labels, business contact details, page metadata and more.
- Products: prices, product descriptions, channel types, ratings, badges, tabs and image uploads; add/remove products.
- Services: the four existing cards, descriptions, links and visibility.
- Customer reviews: the four existing testimonial cards and visibility.
- Articles: the three existing preview cards, including pictures and links.
- Vehicle showcase: all displayed brand names.
- Media: hero, rideshare, installation, Tesla and product/article images via secure uploads to Supabase Storage.

## Access & security

- The website and public images can be read by everyone.
- Only authenticated users whose IDs appear in `public.cms_editors` can edit the website or upload images.
- The dashboard never uses a service role secret; never place your `service_role` key into JavaScript or GitHub Pages.
- The public publishable key is designed for browser use, with RLS protecting changes.
- Don't enable uncontrolled public editor registrations. Create editors through Authentication and add them to the allowlist.
- No spreadsheet access is used anywhere in the publishing system.

## Notes

- Content updates are immediate for new visits or page refreshes; there is no scheduled five-minute wait.
- Image uploads are limited to JPG, PNG or WebP under 5MB.
- The existing homepage has four service cards, four review cards and three article cards. The dashboard edits those existing slots.
- `cms-data.json` is only an emergency/static fallback. Once Supabase is live, editing it is not necessary.
- Existing business details, reviews and marketing claims in the seed are examples; verify and replace any unverified information before launch.
- The current contact/newsletter forms in the original website are visual demonstrations, not connected to a real inbox. This CMS does not change their behavior.
- For search engines that don't execute JavaScript, changes to SEO meta tags may require a GitHub HTML redeploy to be reflected in crawled HTML. The visitor-facing content updates immediately.

## Static HTML synchronization

`site-template.html` is the source of truth for layout, styling, and scripts. GitHub Actions reads published Supabase CMS content and renders the homepage into `_site/index.html`, commits the generated root `index.html` and `cms-data.json`, then deploys it to GitHub Pages. Edit `site-template.html` rather than the auto-generated `index.html` when changing the layout. The visual dashboard is unchanged. The deployment runs for code pushes and every five minutes to detect new Supabase publishes; scheduled runs can be delayed. GitHub Actions uses the browser-safe Supabase publishable key; it does not require any private API key. If a publish is not reflected in View Page Source, inspect the GitHub Actions run for failures.


### Reliable publish trigger (required one-time setup)

The admin dashboard now calls the authenticated `publish-html` Supabase Edge Function after a successful CMS save. The function checks the Supabase signed-in user AND their membership in `public.cms_editors`, then requests GitHub's `workflow_dispatch` for `.github/workflows/deploy.yml`. This is separate from the GitHub scheduled workflow (which can be delayed or entirely skipped).

**Required:** Create a fine-grained GitHub personal access token scoped to repository `mshahrooz/Dashcam-Pro` with **Actions: Read and write** permission, then in Supabase Dashboard > Edge Functions > Secrets create the secret `GITHUB_WORKFLOW_TOKEN` with that token. Never add the token to `supabase-config.js`, browser code, the repository, or `cms-data.json`. If missing, the admin explicitly reports that Supabase saved the content but static HTML was **not** deployed.

After the secret is configured, editing and clicking **Publish changes** invokes the workflow immediately, which regenerates and commits the root `index.html` and deploys GitHub Pages. A scheduled 5-minute check remains only as a fallback (not a latency guarantee). Check the GitHub Actions run for success before expecting the updated View Page Source.
