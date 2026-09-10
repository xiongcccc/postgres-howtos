# Content Editing

For new or revised Howto articles, read `maintenance/editorial-standard.md`
before drafting. Apply the same standard to conference slides, PDFs, upstream
translations, and practice notes. Keep attribution accurate, distinguish external
cases from local experiments, and review prose for template-like repetition.

Read `maintenance/CATALOG.md` when adding or updating articles or navigation.
Edit `data/articles.json` for titles, topics, aliases, sources and validation
metadata, then run `node maintenance/build-catalog.mjs` and
`node --test maintenance/test-catalog.cjs`. Do not manually edit generated
README/navigation/index files. Homepage prose lives in `maintenance/home-template.md`.

Preserve existing article routes. Use absolute document paths such as
`/docs/100.md` for Markdown links, following the repository's Docsify conventions.
Do not commit or push unless the user requests it.
