#!/usr/bin/env python3
"""Generates the Fodmara pages under ilumie.com/fodmara/ (GitHub Pages, repo ilumie-site) into ../ilumie-site/fodmara (or argv[1]).
Usage: python3 scripts/site-gen.py [out_dir]  — then commit/push ilumie-site. No own domain (playbook #65): every link is /fodmara/…,
the shared ilumie.com certificate covers it, mail goes to the alias fodmara@ilumie.com."""
import os, sys, datetime
from PIL import Image

BASE = "/fodmara"; HOST = "https://ilumie.com"; MAIL = "fodmara@ilumie.com"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "ilumie-site", "fodmara")
ROOT = os.path.join(os.path.dirname(__file__), "..")
UPDATED = datetime.date.today().strftime("%-d %B %Y"); UPDATED_DA = datetime.date.today().strftime("%-d/%-m %Y")
ICON = open(os.path.join(ROOT, "resources", "icon.svg")).read().replace("<svg ", '<svg role="img" aria-label="Fodmara" ', 1)

STYLE = """:root{--bg:#f5f3ee;--fg:#1b2421;--muted:#66706b;--card:#fff;--brand:#24453C;--accent:#E48056;--max:760px}
@media(prefers-color-scheme:dark){:root{--bg:#101614;--fg:#ecf0ee;--muted:#9aa59f;--card:#19221f;--brand:#9CC7B5;--accent:#F09A72}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg);line-height:1.6}
header,main,footer{max-width:var(--max);margin:0 auto;padding:0 20px}
header{display:flex;align-items:center;justify-content:space-between;padding-top:20px;padding-bottom:12px;gap:12px;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;text-decoration:none;color:var(--fg);font-size:1.15rem}.logo svg{width:34px;height:34px;border-radius:8px}
nav a{color:var(--muted);text-decoration:none;margin-left:16px;font-size:.95rem}nav a:hover{color:var(--brand)}
.hero{padding:48px 0 28px}.hero h1{font-family:Georgia,"Iowan Old Style",serif;font-weight:500;font-size:2.4rem;line-height:1.15;margin:0 0 12px}.hero p{font-size:1.15rem;color:var(--muted);max-width:580px}
.badges{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.badge{display:inline-block;padding:12px 18px;border-radius:12px;background:var(--fg);color:var(--bg);text-decoration:none;font-weight:600}.badge.soon{opacity:.5}
.badge small{display:block;font-weight:400;font-size:.75rem;opacity:.8}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:32px 0}
.card{background:var(--card);border-radius:16px;padding:20px}.card h3{margin:0 0 6px;font-size:1.05rem}.card p{margin:0;color:var(--muted);font-size:.95rem}
.callout{border-left:4px solid var(--accent);padding:12px 16px;background:var(--card);border-radius:0 12px 12px 0;margin:24px 0}
.shots{display:flex;gap:12px;overflow-x:auto;padding:8px 0 16px}.shots img{height:420px;width:auto;border-radius:18px;flex:none;box-shadow:0 8px 30px rgba(0,0,0,.15)}
.disclaimer{font-size:.9rem;color:var(--muted);border-top:1px solid #8884;padding-top:16px;margin-top:32px}
h2{margin-top:36px}article h2{font-size:1.25rem}article h3{font-size:1.05rem;margin-top:24px}.muted{color:var(--muted)}a{color:var(--brand)}
footer{padding:40px 20px;color:var(--muted);font-size:.9rem;border-top:1px solid #ddd3;margin-top:48px}footer a{color:var(--muted)}.lang{font-size:.85rem}
@media(max-width:600px){.hero h1{font-size:1.9rem}.shots img{height:340px}nav a{margin-left:10px}}
"""

def page(lang, title, desc, body, alt):
    other = "da" if lang == "en" else "en"
    nav = {"en": ("Privacy", "Terms", "Support"), "da": ("Privatliv", "Vilkår", "Support")}[lang]
    pre = BASE if lang == "en" else f"{BASE}/da"
    opre = BASE if other == "en" else f"{BASE}/da"
    foot = {"en": f"© 2026 Therkildsen Group · CVR 46203798 · Fodmara is an <a href=\"/\">Ilumie</a> app · <a href=\"mailto:{MAIL}\">{MAIL}</a>",
            "da": f"© 2026 Therkildsen Group · CVR 46203798 · Fodmara er en <a href=\"/da/\">Ilumie</a>-app · <a href=\"mailto:{MAIL}\">{MAIL}</a>"}[lang]
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}"><link rel="icon" href="{BASE}/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="{BASE}/style.css">
<link rel="alternate" hreflang="en" href="{HOST}{BASE}{alt}"><link rel="alternate" hreflang="da" href="{HOST}{BASE}/da{alt}"></head><body>
<header><a class="logo" href="{pre}/">{ICON}Fodmara</a><nav><a href="{pre}/privacy/">{nav[0]}</a><a href="{pre}/terms/">{nav[1]}</a><a href="{pre}/support/">{nav[2]}</a><a class="lang" href="{opre}{alt}">{other.upper()}</a></nav></header>
<main>{body}</main>
<footer>{foot}</footer>
</body></html>"""

def shots(lang):
    return '<div class="shots">' + "".join(f'<img src="{BASE}/shots/{lang}-{i}.jpg" alt="" loading="lazy" width="430" height="932">' for i in range(1, 7)) + "</div>"

INDEX = {
"en": ("Fodmara – private FODMAP & IBS diary", "Meals, symptoms and toilet visits in seconds, a planner for the FODMAP reintroduction and a PDF for your dietitian. No account.", f"""
<section class="hero"><h1>The IBS diary your dietitian asks for.</h1>
<p>One number a day for your gut, meals in five seconds, the Bristol scale in one tap – and a planner that walks you through the low-FODMAP reintroduction, one group at a time.</p>
<div class="badges"><span class="badge soon">App Store<small>Coming soon</small></span><span class="badge soon">Google Play<small>Coming soon</small></span></div></section>
{shots("en")}
<div class="features">
<div class="card"><h3>One number a day</h3><p>Your gut 0–10, plus bloating, pain, sleep and stress. Five seconds in the evening.</p></div>
<div class="card"><h3>Meals without counting</h3><p>Your usual foods first, 130+ foods to search, and a quiet line saying which FODMAP groups the plate typically contains.</p></div>
<div class="card"><h3>Reintroduction, step by step</h3><p>Three test days with a small, medium and large portion, three pause days, reminders – and your results in one overview.</p></div>
<div class="card"><h3>What comes before a flare-up</h3><p>Which foods and groups were eaten before your bad days, compared with other meals – plus your Bristol types.</p></div>
</div>
<div class="callout"><strong>Private by design.</strong> No account, no cloud, no analytics. Your diary lives on your phone and only you can export it.</div>
<section><h2>When to see a doctor</h2><p>Blood in your stool, weight loss you can't explain, symptoms that wake you at night or a lasting change in bowel habits after 50 are not typical of IBS. Fodmara shows these signs clearly – a diary is never a reason to wait.</p></section>
<section><h2>Free and Pro</h2><p>Daily check-ins, meals, toilet visits, flare-ups, the calendar and the widget are free, forever. Fodmara Pro adds the reintroduction planner, patterns, the PDF report, PIN lock, encrypted backup and unlimited history – yearly with a 7-day free trial, or one lifetime purchase.</p></section>
<p class="disclaimer">Fodmara is a self-observation diary, not a medical device. It does not diagnose, does not use official FODMAP measurements and gives no diet advice. Talk to your doctor or dietitian about what you log.</p>"""),
"da": ("Fodmara – privat FODMAP- og IBS-dagbog", "Måltider, symptomer og toiletbesøg på sekunder, en plan for FODMAP-genintroduktionen og en PDF til din diætist. Ingen konto.", f"""
<section class="hero"><h1>IBS-dagbogen, din diætist beder om.</h1>
<p>Ét tal om dagen for maven, måltider på fem sekunder, Bristol-skalaen med ét tryk – og en plan, der fører dig gennem lav-FODMAP-genintroduktionen, én gruppe ad gangen.</p>
<div class="badges"><span class="badge soon">App Store<small>Kommer snart</small></span><span class="badge soon">Google Play<small>Kommer snart</small></span></div></section>
{shots("da")}
<div class="features">
<div class="card"><h3>Ét tal om dagen</h3><p>Maven 0–10 plus oppustethed, smerter, søvn og stress. Fem sekunder om aftenen.</p></div>
<div class="card"><h3>Måltider uden at tælle</h3><p>Dine faste fødevarer først, 130+ fødevarer at søge i og en stille linje om, hvilke FODMAP-grupper tallerkenen typisk indeholder.</p></div>
<div class="card"><h3>Genintroduktion, trin for trin</h3><p>Tre testdage med lille, mellem og stor portion, tre pausedage, påmindelser – og dine resultater samlet ét sted.</p></div>
<div class="card"><h3>Hvad der kommer før et udbrud</h3><p>Hvilke fødevarer og grupper du spiste før de dårlige dage, sammenlignet med andre måltider – plus dine Bristol-typer.</p></div>
</div>
<div class="callout"><strong>Privat fra bunden.</strong> Ingen konto, ingen sky, ingen sporing. Din dagbog bor på din telefon, og kun du kan eksportere den.</div>
<section><h2>Hvornår skal du til lægen</h2><p>Blod i afføringen, vægttab du ikke kan forklare, symptomer der vækker dig om natten eller en varig ændring i afføringsvanerne efter 50 passer ikke på IBS. Fodmara viser tegnene tydeligt – en dagbog er aldrig en grund til at vente.</p></section>
<section><h2>Gratis og Pro</h2><p>Daglige check-ins, måltider, toiletbesøg, udbrud, kalender og widget er gratis – for altid. Fodmara Pro giver genintroduktionsplanen, mønstre, PDF-rapporten, PIN-lås, krypteret backup og ubegrænset historik – årligt med 7 dages gratis prøve eller som ét engangskøb.</p></section>
<p class="disclaimer">Fodmara er en selvobservations-dagbog, ikke medicinsk udstyr. Den stiller ikke diagnoser, bruger ingen officielle FODMAP-målinger og giver ingen kostråd. Tal med din læge eller diætist om det, du logger.</p>"""),
}

PRIVACY = {
"en": ("Privacy policy – Fodmara", "Fodmara stores all data on your device and collects nothing.", f"""<article><h1>Privacy policy</h1><p class="muted">Last updated {UPDATED}</p>
<p>Fodmara is an IBS and low-FODMAP diary. What you eat and how your gut feels is about as private as data gets, so the app is built so that we never see it.</p>
<h2>Who we are</h2><p>Fodmara is published by Therkildsen Group, CVR 46203798, Teglkrogen 10, 8800 Viborg, Denmark, under the Ilumie brand. Contact: <a href="mailto:{MAIL}">{MAIL}</a>.</p>
<h2>Where your data is</h2><p>Everything you log – check-ins, meals, toilet visits, flare-ups, reintroduction tests, notes and medication names – is stored only on your device, in the app's own storage. There is no account and no server-side copy. We cannot read, restore or delete your diary.</p>
<h2>What we collect</h2><p>Nothing. Fodmara contains no analytics, no advertising SDKs and no crash reporting that identifies you.</p>
<h2>Purchases</h2><p>If you buy Fodmara Pro, the purchase is handled by Apple or Google. To check that a purchase is valid, the app uses RevenueCat, which receives an anonymous app user id and the purchase receipt – never your diary.</p>
<h2>Meal photos</h2><p>A photo you attach to a meal is stored as a file inside the app on your device. It is not uploaded, not included in the encrypted backup and not in the PDF. Deleting the meal deletes the photo.</p>
<h2>Apple Health (optional, Pro)</h2><p>If you turn on Apple Health export, the app writes your flare-ups and toilet visits to Health as symptom entries (abdominal cramps, bloating, diarrhoea, constipation, nausea, heartburn). It never reads anything from Health. You can turn it off at any time; entries already written stay in Health until you delete them there.</p>
<h2>Backup and PDF</h2><p>An encrypted backup file or a PDF report is only created when you ask for it, and you choose where it goes. The backup is encrypted with a passphrase only you know.</p>
<h2 id="deletion">Data deletion</h2><p>Fodmara has no accounts and no server-side data, so you delete it yourself:</p><ul><li><strong>Delete in the app:</strong> Settings → Your data → Delete all data.</li><li><strong>Delete the app:</strong> removing it from your phone deletes everything it stored.</li><li>Backup files you exported are yours; delete them where you saved them.</li></ul>
<h2>Not a medical device</h2><p>Fodmara is a self-observation diary. It does not diagnose, does not use official FODMAP measurements and does not recommend a diet or treatment.</p>
<h2>Children</h2><p>Fodmara is not directed at children under 13 and does not knowingly collect data from them (it collects none from anyone).</p>
<h2>Changes</h2><p>If this policy changes, the date above changes and the app's store page links to the new version.</p></article>"""),
"da": ("Privatlivspolitik – Fodmara", "Fodmara gemmer alle data på din enhed og indsamler intet.", f"""<article><h1>Privatlivspolitik</h1><p class="muted">Sidst opdateret {UPDATED_DA}</p>
<p>Fodmara er en IBS- og lav-FODMAP-dagbog. Hvad du spiser, og hvordan din mave har det, er nogle af de mest private data, der findes, så appen er bygget, så vi aldrig ser dem.</p>
<h2>Hvem vi er</h2><p>Fodmara udgives af Therkildsen Group, CVR 46203798, Teglkrogen 10, 8800 Viborg, under brandet Ilumie. Kontakt: <a href="mailto:{MAIL}">{MAIL}</a>.</p>
<h2>Hvor dine data er</h2><p>Alt, du logger – check-ins, måltider, toiletbesøg, udbrud, genintroduktionstest, noter og navne på medicin – gemmes kun på din enhed i appens egen lagerplads. Der er ingen konto og ingen kopi på en server. Vi kan ikke læse, gendanne eller slette din dagbog.</p>
<h2>Hvad vi indsamler</h2><p>Intet. Fodmara indeholder ingen analytics, ingen reklame-SDK'er og ingen fejlrapportering, der identificerer dig.</p>
<h2>Køb</h2><p>Køber du Fodmara Pro, håndteres købet af Apple eller Google. For at kontrollere købet bruger appen RevenueCat, som modtager et anonymt bruger-id og købskvitteringen – aldrig din dagbog.</p>
<h2>Måltidsfotos</h2><p>Et foto, du knytter til et måltid, gemmes som en fil inde i appen på din enhed. Det uploades ikke, kommer ikke med i den krypterede backup og ikke i PDF'en. Sletter du måltidet, slettes fotoet.</p>
<h2>Apple Sundhed (valgfrit, Pro)</h2><p>Slår du eksport til Apple Sundhed til, skriver appen dine udbrud og toiletbesøg til Sundhed som symptom-poster (mavekramper, oppustethed, diarré, forstoppelse, kvalme, halsbrand). Den læser aldrig noget fra Sundhed. Du kan slå det fra når som helst; allerede skrevne poster bliver i Sundhed, til du sletter dem dér.</p>
<h2>Backup og PDF</h2><p>En krypteret backupfil eller en PDF-rapport laves kun, når du beder om det, og du vælger selv, hvor den skal hen. Backuppen er krypteret med en adgangsfrase, kun du kender.</p>
<h2 id="deletion">Sletning af data</h2><p>Fodmara har ingen konti og ingen data på servere, så du sletter selv:</p><ul><li><strong>Slet i appen:</strong> Indstillinger → Dine data → Slet alle data.</li><li><strong>Slet appen:</strong> fjerner du den fra telefonen, slettes alt, den har gemt.</li><li>Backupfiler, du har eksporteret, er dine; slet dem dér, hvor du gemte dem.</li></ul>
<h2>Ikke medicinsk udstyr</h2><p>Fodmara er en selvobservations-dagbog. Den stiller ikke diagnoser, bruger ingen officielle FODMAP-målinger og anbefaler ikke kost eller behandling.</p>
<h2>Børn</h2><p>Fodmara henvender sig ikke til børn under 13 og indsamler ikke bevidst data fra dem (den indsamler ingen fra nogen).</p>
<h2>Ændringer</h2><p>Ændres politikken, ændres datoen ovenfor, og appens butiksside linker til den nye version.</p></article>"""),
}

TERMS = {
"en": ("Terms of use – Fodmara", "Terms for using the Fodmara app.", f"""<article><h1>Terms of use</h1><p class="muted">Last updated {UPDATED}</p>
<p>These terms apply to the Fodmara app published by Therkildsen Group (CVR 46203798), Viborg, Denmark. On the App Store, Apple's <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">standard licence agreement (EULA)</a> also applies.</p>
<h2>What Fodmara is</h2><p>Fodmara is a personal IBS and low-FODMAP diary: it stores what you log and shows counts, averages and shares of it. The food list shows which FODMAP groups foods typically contain, from public sources. It is not a medical device, does not diagnose, does not use official FODMAP measurements and does not tell you what to eat. Talk to your doctor or dietitian before changing your diet.</p>
<h2>Purchases</h2><p>Fodmara Pro is sold as a yearly subscription with a 7-day free trial or as a one-time lifetime purchase, through Apple or Google. Subscriptions renew automatically until you cancel them in your store account; refunds follow the store's rules.</p>
<h2>Your data</h2><p>Your diary stays on your device. Keeping it (for example with the encrypted backup) is your responsibility – we have no copy.</p>
<h2>Liability</h2><p>Fodmara is provided "as is". To the extent permitted by law, we are not liable for indirect losses, including decisions made from what the app shows.</p>
<h2>Contact</h2><p><a href="mailto:{MAIL}">{MAIL}</a></p></article>"""),
"da": ("Vilkår for brug – Fodmara", "Vilkår for brug af Fodmara-appen.", f"""<article><h1>Vilkår for brug</h1><p class="muted">Sidst opdateret {UPDATED_DA}</p>
<p>Disse vilkår gælder for appen Fodmara, udgivet af Therkildsen Group (CVR 46203798), Viborg. På App Store gælder desuden Apples <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">standard-licensaftale (EULA)</a>.</p>
<h2>Hvad Fodmara er</h2><p>Fodmara er en personlig IBS- og lav-FODMAP-dagbog: den gemmer det, du logger, og viser optællinger, gennemsnit og andele. Fødevarelisten viser, hvilke FODMAP-grupper fødevarer typisk indeholder, fra offentlige kilder. Den er ikke medicinsk udstyr, stiller ikke diagnoser, bruger ingen officielle FODMAP-målinger og fortæller dig ikke, hvad du skal spise. Tal med din læge eller diætist, før du ændrer din kost.</p>
<h2>Køb</h2><p>Fodmara Pro sælges som årsabonnement med 7 dages gratis prøve eller som et engangskøb for livstid via Apple eller Google. Abonnementer fornyes automatisk, til du opsiger dem i din butikskonto; refusion følger butikkens regler.</p>
<h2>Dine data</h2><p>Din dagbog bliver på din enhed. At passe på den (fx med den krypterede backup) er dit ansvar – vi har ingen kopi.</p>
<h2>Ansvar</h2><p>Fodmara leveres "som den er". I det omfang loven tillader det, er vi ikke ansvarlige for indirekte tab, herunder beslutninger truffet ud fra det, appen viser.</p>
<h2>Kontakt</h2><p><a href="mailto:{MAIL}">{MAIL}</a></p></article>"""),
}

SUPPORT = {
"en": ("Support – Fodmara", "Help and frequently asked questions for Fodmara.", f"""<article><h1>Support</h1>
<p>Write to <a href="mailto:{MAIL}">{MAIL}</a> – or use Settings → About → Send feedback in the app, which adds your app version for us.</p>
<h3>What does the 0–10 number mean?</h3><p>Your gut symptoms for the day as a whole, on your own scale – 0 is no symptoms, 10 is as bad as it gets. Compare it with your own days, not with other people.</p>
<h3>Why are there no traffic lights or portion sizes?</h3><p>How much of a food you tolerate is personal and depends a lot on the amount. Fodmara only shows which FODMAP groups a food typically contains; your dietitian decides what and how much.</p>
<h3>How does a reintroduction test work?</h3><p>Pick a group and a test food. On three days you eat a small, medium and large portion, then three pause days follow. Fodmara reminds you, shows your gut score next to the week before, and you record the result.</p>
<h3>I changed phone – where is my diary?</h3><p>Fodmara has no account, so data does not move by itself. Export an encrypted backup (Settings → Your data) on the old phone and import it on the new one.</p>
<h3>Reminders don't show</h3><p>Check that notifications are allowed for Fodmara in your phone's settings and that the daily reminder is turned on in Fodmara's settings.</p></article>"""),
"da": ("Support – Fodmara", "Hjælp og ofte stillede spørgsmål om Fodmara.", f"""<article><h1>Support</h1>
<p>Skriv til <a href="mailto:{MAIL}">{MAIL}</a> – eller brug Indstillinger → Om → Send feedback i appen, så kommer din app-version med.</p>
<h3>Hvad betyder tallet 0–10?</h3><p>Dine mavegener for dagen som helhed på din egen skala – 0 er ingen gener, 10 er så slemt som det bliver. Sammenlign med dine egne dage, ikke med andres.</p>
<h3>Hvorfor er der ingen trafiklys eller portionsstørrelser?</h3><p>Hvor meget af en fødevare du tåler, er personligt og afhænger meget af mængden. Fodmara viser kun, hvilke FODMAP-grupper en fødevare typisk indeholder; din diætist afgør hvad og hvor meget.</p>
<h3>Hvordan virker en genintroduktionstest?</h3><p>Vælg en gruppe og en testfødevare. Tre dage spiser du en lille, mellem og stor portion, derefter følger tre pausedage. Fodmara minder dig om det, viser dit mavetal ved siden af ugen før, og du noterer resultatet.</p>
<h3>Jeg har skiftet telefon – hvor er min dagbog?</h3><p>Fodmara har ingen konto, så data flytter ikke af sig selv. Eksportér en krypteret backup (Indstillinger → Dine data) på den gamle telefon og importér den på den nye.</p>
<h3>Påmindelser vises ikke</h3><p>Tjek, at notifikationer er tilladt for Fodmara i telefonens indstillinger, og at den daglige påmindelse er slået til i Fodmaras indstillinger.</p></article>"""),
}

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(content)

def main():
    for lang in ("en", "da"):
        pre = "" if lang == "en" else "/da"
        for name, data, alt in (("index", INDEX, "/"), ("privacy", PRIVACY, "/privacy/"), ("terms", TERMS, "/terms/"), ("support", SUPPORT, "/support/")):
            title, desc, body = data[lang]
            rel = f"{pre}/index.html" if name == "index" else f"{pre}/{name}/index.html"
            write(os.path.join(OUT, rel.lstrip("/")), page(lang, title, desc, body, alt))
    write(os.path.join(OUT, "style.css"), STYLE)
    write(os.path.join(OUT, "favicon.svg"), open(os.path.join(ROOT, "resources", "icon.svg")).read())
    # landing-page screenshots: the store frames, downscaled to light JPEGs
    os.makedirs(os.path.join(OUT, "shots"), exist_ok=True)
    for lang in ("en", "da"):
        for i in range(1, 7):
            f = os.path.join(ROOT, "store", "screenshots", lang, f"store-iphone-6.7-{i}.png")
            if os.path.exists(f):
                im = Image.open(f).convert("RGB"); im.thumbnail((645, 1398)); im.save(os.path.join(OUT, "shots", f"{lang}-{i}.jpg"), quality=82, optimize=True)
    print("site written to", os.path.abspath(OUT))

if __name__ == "__main__":
    main()
