"""Builds src/locales/<lang>.json from the shared base (inherited from Tinnara, which inherited from Migrano)
+ scripts/i18n/<lang>.json overrides + food names from scripts/i18n/foods.tsv. Tinnitus-only sections are dropped first.
Run: python3 scripts/i18n/build.py"""
import json, os, csv, re
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
DROP = {"loud": None, "weather": None, "medDays": None, "diary": ["tags"],
        "diary.groups": ["sound"],
        "home": ["louderNow", "louderHint", "endSpike", "spikesMonth_one", "spikesMonth_other", "recent"],
        "home.fields": ["loudness", "distress", "noise"], "home.fieldHint": ["distress", "noise"],
        "episode.journey": ["sound"], "calendar": ["spike", "loudness"],
        "insights": ["loud90", "loud90Hint", "avgLoud", "avgDistress", "spikes", "avgSpikeHours", "shareOfSpikes", "patPressure"],
        "insights.contrast": ["noise"], "learn": ["pressureYes", "pressureNo"], "learn.contrast": ["noise"],
        "report": ["pressureCol", "pressureNote", "loudShort", "distressShort", "legendLoud", "legendSpikes", "spikes"],
        "widget": ["louderNow", "openSpike", "spikes_one", "spikes_other"], "settings": ["triggers"], "paywall.reasons": ["weather"],
        "onboarding": ["sideQ", "soundQ", "since"], "redFlags": None}
LANGS = ["en", "da", "de", "sv", "nb"]
foods = list(csv.DictReader(open(os.path.join(ROOT, "scripts/i18n/foods.tsv")), delimiter="\t"))
def merge(a, b):
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(a.get(k), dict): merge(a[k], v)
        else: a[k] = v
for lang in LANGS:
    base = json.load(open(os.path.join(ROOT, "scripts", "i18n", "base", f"{lang}.json")))
    for sec, keys in DROP.items():
        parts = sec.split("."); node = base
        for part in parts[:-1]: node = node.get(part, {})
        if keys is None: node.pop(parts[-1], None)
        else:
            for k in keys: node.get(parts[-1], {}).pop(k, None)
    merge(base, json.load(open(os.path.join(ROOT, "scripts", "i18n", f"{lang}.json"))))
    base.setdefault("food", {})["items"] = {r["key"]: r[lang] for r in foods}
    s = json.dumps(base, ensure_ascii=False, indent=2)
    bad = [l.strip()[:100] for l in s.splitlines() if re.search(r"tinnit|igrän|igræn|igrene|loudness|lautstärke|lydstyrke|ljudstyrka|\bspike|\børe\b|\børet\b|\bOhr\b|\børa\b", l, re.I) or re.search(r"\bENT\b|\bHNO\b|\bÖNH\b", l)]
    if bad: print(f"WARN {lang}: leftover words:", bad[:10])
    open(os.path.join(ROOT, "src", "locales", f"{lang}.json"), "w").write(s + "\n")
    print(lang, "ok", len(s))
