# Burnaby DashCam Pros — Multipage Website + Supabase Visual Editor

This package replaces the former **single-page** marketing site with the supplied **14-page design**, while preserving its Supabase editor-login and image-storage setup. All 14 public pages are real static HTML files; they are not client-rendered shells. **Text and image changes are embedded into the HTML source by the GitHub Actions build**, so View Page Source and search crawlers can see published copy.

## Pages

- `/index.html` — Homepage
- `/services.html` — Services and pricing
- `/services/installation.html` — Installation
- `/services/tesla.html` — Tesla & EVs
- `/services/rideshare.html` — Rideshare & fleets
- `/how-it-works.html` — Process
- `/case-studies.html` — Case studies
- `/case-studies/sedan-commuter.html` — Commuter case study
- `/case-studies/tesla-model-3.html` — Tesla case study
- `/case-studies/rideshare-fleet.html` — Rideshare fleet case study
- `/past-work.html` — Project gallery and comparison sliders
- `/about.html` — About
- `/contact.html` — Contact
- `/404.html` — Not-found page (excluded from sitemap)

## Visual editor

Open `/admin/`. Sign in with an **existing authorized Supabase editor**. The sidebar and drop-down allow you to select every page. An editable iframe shows the actual page, with Desktop / Tablet / Mobile preview modes. Click visible text, a link, an image, an input placeholder, or an iframe to edit it. The inspector also has per-page SEO title and meta-description fields. The image upload control reuses the existing `site-media` storage bucket and its upload permissions. Publish saves all pending page edits in the existing `public.cms_content` row and calls the existing authenticated `publish-html` Edge Function.

New data is in `cms_content.payload.pageOverrides`, keyed by relative page path. The previous payload keys remain untouched. Existing Supabase Auth, `cms_editors` authorization, RLS, and the public publishable key are retained. **No new database tables or privileged client-side keys are needed.**

### HTML publishing

`.github/workflows/deploy.yml` runs on `main` pushes or `workflow_dispatch` from the existing `publish-html` Edge Function. It:

1. Reads the latest `cms_content.payload` from Supabase using the **publishable** key.
2. Applies page-specific text, image, link, placeholder, and metadata changes to `site-templates/**/*.html`.
3. Generates HTML for every public page, `sitemap.xml`, `robots.txt`, and `cms-pages.json` into `_site/`.
4. Commits the refreshed HTML source files back to the repository with `[skip ci]` (to avoid an infinite loop).
5. Publishes `_site` to GitHub Pages using the Pages artifact action.

Unlike the earlier approach, the build uses the lightweight Python `beautifulsoup4` parser and **does not download Chromium or Playwright**. The website also queries the public content record on page load so readers can see fresh edits even before GitHub finishes the HTML build; the static HTML itself is still the published snapshot.

### Preserving design and functionality

All supplied original website pages, navigation, responsive styling, gallery, before/after sliders, reveal-on-scroll behavior, and local image assets are included. The edit markers are inline spans and `data-*` attributes only; they do not add separate visual sections or replace the design. The hero image is the supplied `generated/hero-premium.jpg`, not the previous dashboard's hero override.

**Limitations carried over from the uploaded multipage site:** the contact and newsletter forms display simulated success; they do *not* send email or save subscribers. Business contact details, testimonials, review statistics, and case-study claims in the uploaded site should be verified before production use. The site still uses Tailwind's browser CDN and Lucide CDN as in the provided design.

## Repository deployment

To upgrade `mshahrooz/Dashcam-Pro`, place these package contents at the **repository root**, replacing old `index.html`, old `admin/`, and old `.github/workflows/deploy.yml`. Keep `.nojekyll` and `supabase-config.js`. The old `site-template.html` and `scripts/build-seo.cjs` are legacy and should no longer be used.

Under GitHub **Settings → Pages**, choose **GitHub Actions** as the deployment source. The existing `publish-html` Edge Function invokes `.github/workflows/deploy.yml` by filename; the name remains compatible with the existing function and `GITHUB_WORKFLOW_TOKEN` secret.

The first GitHub Actions deployment will copy the original 14 multipage templates into `_site`; later changes made through the visual editor update Supabase, trigger the workflow, and refresh the source HTML of all affected pages. Scheduled polling is not required.

## Content file structure

- `site-templates/**/*.html`: immutable annotated HTML source used for rendering.
- `index.html`, `services.html`, etc.: published HTML snapshot at repository root.
- `cms-pages.json`: last published page-specific override snapshot.
- `assets/js/pages-manifest.json`: editable page list and original SEO metadata.
- `assets/js/cms-live.js`: public safe preview/instant refresh support.
- `admin/index.html`, `admin/app.js`, `admin/styles.css`: multipage visual editor.
- `scripts/build_pages.py`: HTML source generator, sitemap and robots.
- `assets/` and `generated/`: original shared JS/CSS/media assets.
- `.github/workflows/deploy.yml`: deployment and repository-source sync.

When changing the underlying layout, edit the matching HTML under `site-templates/`, not the auto-generated root HTML. Existing editor markers must remain stable to retain previously saved edits. The `scripts_prepare.py` script used for the initial conversion is intentionally not included in the deployment package.

## Local static build / testing

```bash
python -m pip install beautifulsoup4==4.12.3
CMS_OFFLINE=1 python scripts/build_pages.py
python -m http.server 8000
```

`CMS_OFFLINE=1` renders using committed `cms-pages.json` without making a Supabase request. Real publishing (default) fetches the live Supabase payload, and deployment fails rather than publishing stale content if the database is unavailable. The editor requires a hosted origin and your existing Supabase login.

## Before-and-after imagery

The matched-angle **after** previews in `assets/images/before-after/*-after.svg` use the corresponding `*-before.png` vehicle interior as their base, with an illustrative camera drawn near the mirror. They demonstrate potential camera placement, **not photographic evidence of a completed customer installation**. Actual placement and hardware may differ. Do not replace the paired images with unrelated vehicle photos; preserve the same angle and vehicle on both sides of each comparison. The old `*-after.png` files are retained only for backwards compatibility and are not linked from current pages.

Service-card images and page-header imagery are stored locally under `generated/`. When changing any page's imagery, update both its published HTML and the matching `site-templates/` file so CMS rebuilds keep the changes. If adding or removing CMS-editable images, update `assets/js/pages-manifest.json` accordingly.
