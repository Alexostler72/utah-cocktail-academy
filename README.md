# Utah Cocktail Academy

Utah Cocktail Academy is a local-first bartender training application built with HTML, CSS, and vanilla JavaScript. It combines a searchable cocktail database, adaptive study tools, a simulated bar shift, ingredient and technique references, progress tracking, and a centralized Utah alcohol-rule configuration.

## Included in this version

- 56 classic, common, modern, and nonalcoholic cocktail records
- Separate standard/historical and Utah-service specifications
- Client-side compliance calculations driven by `data/utah-rules.json`
- 118 quiz questions and 20 Practice Bar scenarios
- Flashcards with simple spaced repetition
- Recipe builder, reverse-identification, missing-ingredient, error-spotting, similar-drink, and timed modes
- Ingredient encyclopedia, 16 technique guides, 15 glass types, and 7 ice types
- “What Can I Make?” inventory matching
- Browser-only favorites, notes, workplace specs, custom cocktails, mastery, history, and settings
- JSON export/import and no analytics
- Responsive desktop, tablet, and mobile navigation
- Installable PWA-style manifest and offline app shell

## Run locally

Because browsers block local JSON requests from `file://` pages, serve the folder through a local web server.

```bash
python -m http.server 8000
```

Open `http://localhost:8000` from the project directory.

## Publish with GitHub Pages

1. Open the repository on GitHub.
2. Select **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and the `/ (root)` folder.
5. Save and wait for GitHub to display the published Pages address.

All application paths are relative, so the site works from a project Pages subdirectory.

## Data layout

```text
utah-cocktail-academy/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── assets/
│   └── icon.svg
├── data/
│   ├── cocktails.json
│   ├── ingredients.json
│   ├── techniques.json
│   ├── glassware.json
│   ├── utah-rules.json
│   ├── questions.json
│   └── scenarios.json
└── tests/
    └── validate-data.mjs
```

## Add a cocktail

Add a new object to `data/cocktails.json` and use an existing complete record as the schema. Keep these principles:

1. Give the record a unique kebab-case `id`.
2. Preserve the recognized national or historical build in `standardSpecification`.
3. Put the operational Utah candidate in `utahSpecification`; never overwrite the classic recipe silently.
4. Give every ingredient an explicit classification such as `primary_spirit`, `secondary_spirit`, `wine`, `fortified_wine`, `beer`, `heavy_beer`, `flavored_malt_beverage`, `bitters`, `juice`, `syrup`, `mixer`, or `classification_uncertain`.
5. Use `classification_uncertain` whenever an official basis is not established. The interface will tell the learner to verify the classification with Utah DABS or management.
6. Update the record review date and verification notes.
7. Run the validation test.

## Update Utah rules

All numeric compliance limits come from `data/utah-rules.json`.

When a rule changes:

1. Verify it against the current Utah Code, Utah administrative rules, DABS guidance, or an official legislative publication.
2. Update the relevant value under `limits`.
3. Update or add the detailed record under `rules`, including the effective date, official source, verification date, exceptions, and verification status.
4. Update affected lessons and scenarios.
5. Change `lastLegallyReviewed` to the actual verification date.
6. Change the service-worker cache version so returning users receive the revised data promptly.
7. Run the validation and browser tests before publishing.

The app displays a warning after the configured review window expires. A bartender’s manual review date is stored separately in localStorage and does not rewrite the official source date.

## Test the compliance calculator

Run structural validation:

```bash
node tests/validate-data.mjs
node --check js/app.js
```

Then test through the interface:

1. Open a drink whose primary spirit is at or below the configured maximum and confirm the primary total.
2. Temporarily copy a record and set primary spirit above the configured limit; it should display **Do not serve as written** and identify that quantity.
3. Add a `classification_uncertain` ingredient; it should display **Requires license-specific review**.
4. Change a numeric limit only in `data/utah-rules.json`, refresh, and confirm that the live calculation and law dashboard update without changing JavaScript.
5. Compare the **Utah build** and **Standard / historical** tabs and confirm that a modified classic remains visibly distinct.
6. Refresh after favoriting, writing notes, setting mastery, or selecting inventory; the state should persist.
7. Export progress, reset it, and import the JSON backup.

## Legal scope

This is a study and operational-reference tool, not an approved alcohol-server training course and not a substitute for the establishment’s license, policies, management instructions, or current DABS guidance. Ingredient classification, license type, service setting, and statutory exceptions can change the result. When the official classification is uncertain, the app deliberately refuses to guess.

Initial legal configuration was reviewed on **2026-06-23** against official Utah sources, including:

- Utah Code § 32B-5-304, metered dispensing and quantity limits
- Utah Code § 32B-4-422, patron possession and service restrictions
- Utah Code § 32B-1-407, proof-of-age verification
- Utah DABS identification-law updates
- Utah DABS training requirements
- Utah DABS retail-license guidance

Open the **Utah Law** section in the app for direct official-source links and effective dates.
