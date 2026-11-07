# Builds Tech-Arena-Participant-Guide.pdf (A4, 4 pages, comic style). Usage: python3 scripts/make-brochure.py
import math
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

F = '/Users/ajith/tech_arena/app/node_modules/@expo-google-fonts'
pdfmetrics.registerFont(TTFont('Bang', f'{F}/bangers/400Regular/Bangers_400Regular.ttf'))
pdfmetrics.registerFont(TTFont('SG', f'{F}/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf'))
pdfmetrics.registerFont(TTFont('SGM', f'{F}/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf'))
pdfmetrics.registerFont(TTFont('SGB', f'{F}/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'))

INK = HexColor('#111111'); PAPER = HexColor('#FFF6DF'); WHITE = HexColor('#FFFFFF')
RED = HexColor('#E4002B'); YEL = HexColor('#FFD400'); BLUE = HexColor('#1E5BFF'); GREEN = HexColor('#14A44D')
PINK = HexColor('#FF4FA3'); PURPLE = HexColor('#7B3FE4'); ORANGE = HexColor('#FF7A1A'); GREY = HexColor('#555048')
LBLUE = HexColor('#DCE7FF'); LYEL = HexColor('#FFF0A3'); LPINK = HexColor('#FFD9EC'); LGREEN = HexColor('#D5F5DF')
W, H = A4
M = 36  # page margin

def page_bg(c):
    c.setFillColor(PAPER); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(HexColor('#EFE3C2'))
    for y in range(0, int(H) + 14, 14):
        for x in range((y // 14) % 2 * 7, int(W) + 14, 14):
            c.circle(x, y, 0.9, stroke=0, fill=1)

def panel(c, x, y, w, h, fill=WHITE, shadow=5, r=12, lw=2.6):
    c.setFillColor(INK); c.roundRect(x + shadow, y - shadow, w, h, r, stroke=0, fill=1)
    c.setFillColor(fill); c.setStrokeColor(INK); c.setLineWidth(lw); c.roundRect(x, y, w, h, r, stroke=1, fill=1)

def caption(c, x, y, text, fill=YEL, size=11, tilt=-2, font='SGB'):
    tw = pdfmetrics.stringWidth(text, font, size) + 16
    c.saveState(); c.translate(x, y); c.rotate(tilt)
    c.setFillColor(fill); c.setStrokeColor(INK); c.setLineWidth(1.8); c.rect(0, -5, tw, size + 10, stroke=1, fill=1)
    c.setFillColor(INK); c.setFont(font, size); c.drawString(8, 0, text)
    c.restoreState()
    return tw

def shout(c, x, y, text, size, fill=WHITE, shadow=2.5):
    # Outlined comic headline with an offset ink shadow; state is restored so the outline mode
    # does not leak into later text.
    c.saveState()
    c.setFont('Bang', size)
    c.setFillColor(INK); c.drawString(x + shadow, y - shadow, text)
    t = c.beginText(x, y); t.setFont('Bang', size); t.setTextRenderMode(2); c.setLineWidth(size / 22)
    c.setFillColor(fill); c.setStrokeColor(INK); t.textOut(text); t.setTextRenderMode(0); c.drawText(t)
    c.restoreState()

def burst(c, cx, cy, R, fill=YEL, pts=14, depth=0.74, shadow=5):
    p = []
    for i in range(pts * 2):
        a = math.pi * i / pts - math.pi / 2
        rr = R if i % 2 == 0 else R * depth
        p.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    for dx, col, stroke in ((shadow, INK, 0), (0, fill, 1)):
        path = c.beginPath(); path.moveTo(p[0][0] + dx, p[0][1] - dx)
        for q in p[1:]: path.lineTo(q[0] + dx, q[1] - dx)
        path.close(); c.setFillColor(col); c.setStrokeColor(INK); c.setLineWidth(2.6)
        c.drawPath(path, stroke=stroke, fill=1)

def para(c, x, y, text, w, font='SG', size=10.5, lead=14.5, color=INK):
    c.setFillColor(color); c.setFont(font, size)
    for line in simpleSplit(text, font, size, w):
        c.drawString(x, y, line); y -= lead
    return y

def num(c, x, y, n, fill=RED, r=13):
    c.setFillColor(fill); c.setStrokeColor(INK); c.setLineWidth(2); c.circle(x, y, r, stroke=1, fill=1)
    c.setFillColor(WHITE); c.setFont('SGB', r + 1); c.drawCentredString(x, y - (r + 1) * 0.36, str(n))

def check(c, x, y, size=11):
    c.setFillColor(WHITE); c.setStrokeColor(INK); c.setLineWidth(1.6); c.rect(x, y, size, size, stroke=1, fill=1)

def footer(c, n):
    c.setFillColor(GREY); c.setFont('SG', 8.5); c.drawString(M, 12, f'Tech Arena participant guide   ·   page {n} of 4')
    c.setFillColor(HexColor('#8A8478')); c.setFont('SG', 6.5); c.drawRightString(W - M, 12, 'robos.inc')

c = canvas.Canvas('/Users/ajith/tech_arena/Tech-Arena-Participant-Guide.pdf', pagesize=A4)
c.setTitle('Tech Arena · Participant guide'); c.setAuthor('robos.inc'); c.setSubject('How to register and use the Tech Arena app')

# ---------------- Page 1: cover ----------------
page_bg(c)
c.setFillColor(RED); c.setFont('Bang', 30); c.drawString(M, H - 62, 'TECH ARENA')
caption(c, W - M - 150, H - 60, 'PARTICIPANT GUIDE', fill=WHITE, size=11, tilt=2)
panel(c, M, 300, W - 2 * M - 6, H - 390, fill=WHITE, shadow=7, r=16, lw=3.2)
caption(c, M + 22, H - 130, 'ISSUE #1 · 2026 · THE PROJECT EXPO')
shout(c, M + 24, H - 210, 'BUILD IT.', 66, fill=WHITE)
shout(c, M + 24, H - 275, 'PITCH IT.', 66, fill=RED)
shout(c, M + 24, H - 340, 'WIN IT!', 66, fill=WHITE)
burst(c, W - 165, H - 250, 102, YEL)
c.setFillColor(RED); c.setFont('Bang', 40); c.drawCentredString(W - 168, H - 240, 'KA-'); c.drawCentredString(W - 168, H - 280, 'BUILD!')
y = para(c, M + 26, H - 385, 'Everything your team needs for the expo: what to keep ready before you register, how to sign up in about 5 minutes, and how the app works on expo day.', W - 2 * M - 60, 'SGM', 13, 19)
# what's inside
items = [('1', 'Keep these ready', RED), ('2', 'Register your team', BLUE), ('3', 'Teammates log in', PURPLE), ('4', 'Expo day and results', GREEN)]
x0 = M + 26; yy = 360
for i, (n, t, col) in enumerate(items):
    xx = x0 + (i % 2) * 245; yv = yy - (i // 2) * 36
    num(c, xx + 12, yv + 4, n, col, 12); c.setFillColor(INK); c.setFont('SGB', 13); c.drawString(xx + 32, yv, t)
# Get the app (the organisers send the link and the Android app separately)
panel(c, M, 60, W - 2 * M - 6, 205, fill=YEL, shadow=6, r=16, lw=3)
shout(c, M + 22, 220, 'GET THE APP', 34, fill=WHITE)
para(c, M + 24, 186, 'The organisers will send you the Tech Arena app link and the Android app:', W - 2 * M - 60, 'SGM', 12.5, 17)
rows = [('iPhone / iPad', 'Open the link in Safari, tap Share, then “Add to Home Screen”.'),
        ('Android', 'Install the Tech Arena app (APK) you receive. Allow “install unknown apps” if your phone asks.'),
        ('Laptop', 'Open the link in any browser.')]
yy = 150
for t, d in rows:
    c.setFillColor(INK); c.circle(M + 30, yy + 4, 3.2, stroke=0, fill=1)
    c.setFont('SGB', 12); c.drawString(M + 42, yy, t)
    yy = para(c, M + 150, yy, d, W - 2 * M - 180, 'SG', 11, 14) - 8
footer(c, 1); c.showPage()

# ---------------- Page 2: keep ready ----------------
page_bg(c)
shout(c, M, H - 78, 'KEEP THESE READY', 44, fill=YEL)
para(c, M, H - 104, 'Collect everything below before you open the app. With it all ready, registration takes about 5 minutes.', W - 2 * M, 'SGM', 12, 17)

colw = (W - 2 * M - 20) / 2
# Lead column
lx, ly, lh = M, 92, H - 222
panel(c, lx, ly, colw - 6, lh, fill=WHITE, shadow=5)
c.setFillColor(RED); c.roundRect(lx + 2, ly + lh - 44, colw - 10, 42, 10, stroke=0, fill=1)
c.setFillColor(WHITE); c.setFont('Bang', 24); c.drawString(lx + 14, ly + lh - 32, 'TEAM LEAD (ONE PERSON)')
lead = [
 ('Profile photo', 'A clear, front-facing photo of your face in good light. Judges use it to recognise your team.'),
 ('Full name', '2 to 60 characters, as on your college ID.'),
 ('USN', 'Your university seat number.'),
 ('Mobile number', 'Your own 10-digit number. It becomes your login, and each number can join only one team.'),
 ('Email address', 'For contact and updates.'),
 ('Team name', '2 to 60 characters. Must be unique, so have a backup name.'),
 ('Project title', '3 to 80 characters.'),
 ('Project description', '10 to 1000 characters: what it does and how it works. Write it in your notes app first, then paste.'),
 ('Project image', 'A photo of your build, prototype or a diagram. Landscape works best.'),
 ('Team colour', 'Pick your favourite and a backup: every team gets a different colour, used for your banner and poster.'),
 ('Team password', 'At least 6 characters. Your whole team logs in with it, so pick one you can share.'),
]
y = ly + lh - 66
for t, d in lead:
    check(c, lx + 14, y - 2); c.setFillColor(INK); c.setFont('SGB', 11); c.drawString(lx + 32, y, t)
    y = para(c, lx + 32, y - 14, d, colw - 52, 'SG', 9.4, 12.2, GREY) - 7

# Teammates column
tx = M + colw + 14
panel(c, tx, ly + 250, colw - 6, lh - 250, fill=WHITE, shadow=5)
c.setFillColor(BLUE); c.roundRect(tx + 2, ly + lh - 44, colw - 10, 42, 10, stroke=0, fill=1)
c.setFillColor(WHITE); c.setFont('Bang', 24); c.drawString(tx + 14, ly + lh - 32, 'EACH TEAMMATE')
mates = [
 ('Full name', 'As on their college ID.'),
 ('Mobile number', 'Their own 10-digit number. This is how they log in.'),
 ('Email address', 'For contact and updates.'),
 ('USN', 'Optional, but good to have.'),
 ('Profile photo', 'Optional when the lead adds them, but required the first time they log in.'),
]
y = ly + lh - 66
for t, d in mates:
    check(c, tx + 14, y - 2); c.setFillColor(INK); c.setFont('SGB', 11); c.drawString(tx + 32, y, t)
    y = para(c, tx + 32, y - 14, d, colw - 52, 'SG', 9.4, 12.2, GREY) - 7
# Team rules sticker
panel(c, tx, ly, colw - 6, 232, fill=LYEL, shadow=5)
c.setFillColor(INK); c.setFont('Bang', 24); c.drawString(tx + 14, ly + 200, 'GOOD TO KNOW')
rules = [
 'Teams have up to 5 people, including the lead.',
 'One phone number = one person = one team.',
 'Photos can be JPG or PNG. The app shrinks big photos for you.',
 'Add all teammates before registration closes. Members and project details lock after that.',
 'Save your team password somewhere safe.',
]
y = ly + 178
for r in rules:
    c.setFillColor(RED); c.circle(tx + 20, y + 3.5, 3, stroke=0, fill=1)
    y = para(c, tx + 30, y, r, colw - 50, 'SGM', 10, 13.2) - 6
footer(c, 2); c.showPage()

# ---------------- Page 3: register + teammates ----------------
page_bg(c)
shout(c, M, H - 78, 'REGISTER YOUR TEAM', 44, fill=WHITE)
caption(c, M + 2, H - 106, 'FOR THE TEAM LEAD · ABOUT 5 MINUTES', fill=YEL, size=10, tilt=-1.5)
steps = [
 ('Open the app', 'Use the app link or the Android app (APK) the organisers sent you. On iPhone, add the link to your Home Screen so it opens like an app.'),
 ('Tap “Register your team!”', 'It is the big red button on the first page. If it says “Registration closed”, contact the organisers.'),
 ('About you', 'Add your profile photo, then your name, USN, mobile number and email.'),
 ('Your team and project', 'Type the team name, project title and description, add the project image, and pick your team colour. The app makes your comic poster from these.'),
 ('Set the team password', 'Type it twice. Then tap “Register team”. You land on your team home page.'),
 ('Add your teammates', 'On the team home, open Team. Enter each teammate\'s name, mobile number and email, then tap “Add to team”.'),
 ('Send them their login', 'Tap “Send logins” on the team home and type the team password. Share by SMS or WhatsApp, or copy the message. It has their phone number and the team password.'),
 ('Note your 4-digit team code', 'It is on your team home under “My code”. Judges type it on expo day.'),
]
colors = [RED, BLUE, PURPLE, PINK, GREEN, ORANGE, RED, BLUE]
y = H - 140
for i, (t, d) in enumerate(steps):
    lines = simpleSplit(d, 'SG', 10, W - 2 * M - 80)
    h = 30 + len(lines) * 13.5
    panel(c, M, y - h, W - 2 * M - 6, h, fill=WHITE, shadow=4, r=10, lw=2.2)
    num(c, M + 26, y - 22, i + 1, colors[i], 14)
    c.setFillColor(INK); c.setFont('SGB', 12.5); c.drawString(M + 52, y - 21, t)
    para(c, M + 52, y - 37, d, W - 2 * M - 80, 'SG', 10, 13.5, GREY)
    y -= h + 12
# teammates box
h = y - 40
panel(c, M, 40, W - 2 * M - 6, h, fill=LBLUE, shadow=5, r=12)
c.setFillColor(INK); c.setFont('Bang', 24); c.drawString(M + 16, 40 + h - 30, 'TEAMMATES: LOG IN')
para(c, M + 16, 40 + h - 50, 'Open the Tech Arena app (the link or APK from the organisers), tap “Team login”, and enter your own mobile number and the team password from your lead. The first time, the app asks for your profile photo: take one or pick one from the gallery, then tap “Save photo”.', W - 2 * M - 40, 'SGM', 10.6, 14.5)
footer(c, 3); c.showPage()

# ---------------- Page 4: expo day ----------------
page_bg(c)
shout(c, M, H - 78, 'ON EXPO DAY', 44, fill=RED)
day = [
 ('Check the queue', 'A random presentation order is drawn on the day. Open Queue on the team home to see your slot.'),
 ('Be ready at your stall', 'Keep your project, poster and team together. Have the team home open on one phone.'),
 ('Show your 4-digit code', 'Each judge asks for your code, types it in and sees your project, poster and photos.'),
 ('Pitch and answer questions', 'Two judges score you on the 5 criteria below.'),
 ('Watch your report', 'Report shows how many judges have scored you. Marks stay sealed until results are published, then everyone sees theirs at once.'),
 ('Results', 'When judging ends, the top 3 are published in the app under Results.'),
]
y = H - 112
cw = (W - 2 * M - 18) / 2
for i, (t, d) in enumerate(day):
    col = i % 2; row = i // 2
    x = M + col * (cw + 12); yy = y - row * 100
    panel(c, x, yy - 86, cw - 6, 86, fill=WHITE, shadow=4, r=10, lw=2.2)
    num(c, x + 22, yy - 20, i + 1, [BLUE, PURPLE, RED, PINK, GREEN, ORANGE][i], 12)
    c.setFillColor(INK); c.setFont('SGB', 12); c.drawString(x + 42, yy - 24, t)
    para(c, x + 14, yy - 44, d, cw - 34, 'SG', 9.6, 12.6, GREY)
# criteria
cy = y - 318
panel(c, M, cy - 120, W - 2 * M - 6, 130, fill=BLUE, shadow=6, r=14)
c.setFillColor(WHITE); c.setFont('Bang', 28); c.drawString(M + 16, cy - 24, 'HOW YOU ARE SCORED')
para(c, M + 16, cy - 42, 'Each judge gives 0 to 10 for each criterion: up to 50 marks per judge.', 400, 'SGM', 10.5, 14, WHITE)
crit = ['Idea & Innovation', 'Working Model', 'Uniqueness', 'Impact & Feasibility', 'Presentation & Q&A']
x = M + 16; yy = cy - 76
for i, cr in enumerate(crit):
    tw = pdfmetrics.stringWidth(cr, 'SGB', 10.5) + 58
    if x + tw > W - M - 20: x = M + 16; yy -= 32
    c.setFillColor(YEL if i % 2 == 0 else WHITE); c.setStrokeColor(INK); c.setLineWidth(1.8); c.roundRect(x, yy, tw, 22, 11, stroke=1, fill=1)
    c.setFillColor(INK); c.setFont('SGB', 10.5); c.drawString(x + 10, yy + 7, cr)
    c.roundRect(x + tw - 44, yy + 3, 40, 16, 8, stroke=0, fill=1); c.setFillColor(WHITE); c.setFont('SGB', 9); c.drawCentredString(x + tw - 24, yy + 7.5, '0-10')
    x += tw + 10
# FAQ
fy = cy - 140
panel(c, M, 40, W - 2 * M - 6, fy - 40, fill=LYEL, shadow=5, r=12)
c.setFillColor(INK); c.setFont('Bang', 24); c.drawString(M + 16, fy - 28, 'QUICK HELP')
faq = [
 ('“This phone number is already registered”', 'Each number can be used once. Use the person\'s own number, or ask the organisers.'),
 ('“This team name is already taken”', 'Pick your backup name.'),
 ('Forgot the team password?', 'Ask your lead. The lead can change it under Change password and send logins again.'),
 ('Want your own poster design?', 'The app makes one for you. To use your own instead, upload it from Poster on the team home before you are first judged.'),
 ('Need to fix a teammate or project detail?', 'Do it before registration closes. After that, ask the organisers.'),
]
y = fy - 52
for q, a in faq:
    c.setFillColor(INK); c.setFont('SGB', 10.5); c.drawString(M + 16, y, q)
    y = para(c, M + 16, y - 13, a, W - 2 * M - 40, 'SG', 9.8, 12.6, GREY) - 7
footer(c, 4); c.showPage()
c.save(); print('ok')
