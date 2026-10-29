# WIP – Klimara phase 2 (paused 29 Oct 2026)

Unfinished. Does **not** typecheck or build yet; nothing has been tested. Paused on purpose so phase 2–5 can be built
in one go with the strongest model. Use this branch as a head start or throw it away – `main` is still empty.

Done here (copied from Fodmara 7fb3cbb, IBS modules removed):
- renamed ids/bundle/App Group/widget/codemagic/podspecs to klimara; app.config.json (RevenueCat + ASC_APP_ID still TODO)
- design tokens (paper #F6F2EE, petrol #22394A, terracotta #D9653B), codemagic icon/splash colours
- settings: menoStage, lastPeriodDate replace the FODMAP keys
- src/domain/klimara: config, tagsets, migrations 20 (tags) + 21 (regimen), data.ts (logFlush, flushSeries/Trend,
  last period, regimen CRUD), store, routes (deep link klimara://flush/new), reminders (check-in only), widget, wishes,
  health (hotFlashes), csv, demo seeder, screens Home / EpisodeSheet (quick·journey·full) / Calendar / Insights (basic) /
  InfoSheets, components FlushMark / WidgetPreview / Spark(max)
- health-bridge plugin switched to hotFlashes + nightSweats (Swift + d.ts)
- onboarding setup (stage, last period, since, HRT) and settings section "Your transition"
- scripts/i18n/base = Fodmara's built locales; scripts/i18n/en.json = Klimara overrides

Missing before phase 2 is done:
- scripts/i18n/{da,de,sv,nb}.json overrides and a new build.py (drop gutScale, meal, stool, foods, food, fodmap, phase,
  test, learn, old home/episode/calendar/insights/notif/widget/redFlags/health/meds/diary; leftover-word check)
- check-keys / check-dynamic adapted (check-dynamic still points at fodmara files)
- smoke.mjs rewritten for Klimara; typecheck, release build, smoke
- README rewrite; site-gen.py, store-frames.mjs, screenshots.mjs, asc-sync IAP texts are still Fodmara (phase 5)
- widget Swift still draws the Fodmara belly (phase 3/5); no URL scheme registration found for deep links – verify
