# Builds Tech-Arena-App-Poster.pdf/.png: A4 comic poster with QR codes for the iPhone (web) link
# and the Android APK. Usage: python3 scripts/make-app-poster.py
import math
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

WEB = 'https://tech-arena.gate-orbit-server.workers.dev'
APK = 'https://tech-arena.gate-orbit-server.workers.dev/techarena.apk'
OUT = '/Users/ajith/tech_arena/Tech-Arena-App-Poster'

F = '/Users/ajith/tech_arena/app/node_modules/@expo-google-fonts'
pdfmetrics.registerFont(TTFont('Bang', f'{F}/bangers/400Regular/Bangers_400Regular.ttf'))
pdfmetrics.registerFont(TTFont('SG', f'{F}/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf'))
pdfmetrics.registerFont(TTFont('SGM', f'{F}/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf'))
pdfmetrics.registerFont(TTFont('SGB', f'{F}/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'))

INK = HexColor('#111111'); PAPER = HexColor('#FFF6DF'); WHITE = HexColor('#FFFFFF')
RED = HexColor('#E4002B'); YEL = HexColor('#FFD400'); BLUE = HexColor('#1E5BFF'); GREEN = HexColor('#14A44D')
GREY = HexColor('#555048'); PENCIL = HexColor('#8A8478')
W, H = A4
M = 34


def page_bg(c):
    c.setFillColor(PAPER); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(HexColor('#EFE3C2'))
    for y in range(0, int(H) + 14, 14):
        for x in range((y // 14) % 2 * 7, int(W) + 14, 14):
            c.circle(x, y, 0.9, stroke=0, fill=1)


def panel(c, x, y, w, h, fill=WHITE, shadow=6, r=14, lw=3):
    c.setFillColor(INK); c.roundRect(x + shadow, y - shadow, w, h, r, stroke=0, fill=1)
    c.setFillColor(fill); c.setStrokeColor(INK); c.setLineWidth(lw); c.roundRect(x, y, w, h, r, stroke=1, fill=1)


def shout(c, x, y, text, size, fill=WHITE, shadow=3, centre=False):
    c.saveState()
    c.setFont('Bang', size)
    if centre: x -= pdfmetrics.stringWidth(text, 'Bang', size) / 2
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


def qr_box(c, url, x, y, size):
    """QR code on a white tile with an ink border (quiet zone included)."""
    c.setFillColor(WHITE); c.setStrokeColor(INK); c.setLineWidth(2.6); c.roundRect(x, y, size, size, 10, stroke=1, fill=1)
    w = qr.QrCodeWidget(url, barLevel='M'); b = w.getBounds(); bw, bh = b[2] - b[0], b[3] - b[1]
    inner = size - 20
    d = Drawing(inner, inner, transform=[inner / bw, 0, 0, inner / bh, 0, 0]); d.add(w)
    renderPDF.draw(d, c, x + 10, y + 10)


def num(c, x, y, n, fill):
    c.setFillColor(fill); c.setStrokeColor(INK); c.setLineWidth(1.8); c.circle(x, y, 10, stroke=1, fill=1)
    c.setFillColor(WHITE); c.setFont('SGB', 11); c.drawCentredString(x, y - 4, str(n))


def steps(c, x, y, w, items, colour):
    for i, t in enumerate(items):
        num(c, x + 10, y + 4, i + 1, colour)
        lines = simpleSplit(t, 'SGM', 11, w - 30)
        c.setFillColor(INK); c.setFont('SGM', 11)
        for k, ln in enumerate(lines):
            c.drawString(x + 28, y - k * 14, ln)
        y -= 14 * len(lines) + 10
    return y


def platform_card(c, x, y, w, h, title, sub, colour, url, items, short):
    panel(c, x, y, w, h)
    # Coloured header band
    c.setFillColor(colour); c.roundRect(x + 1.5, y + h - 58, w - 3, 56.5, 13, stroke=0, fill=1)
    c.rect(x + 1.5, y + h - 58, w - 3, 20, stroke=0, fill=1)
    c.setStrokeColor(INK); c.setLineWidth(3); c.line(x, y + h - 58, x + w, y + h - 58)
    shout(c, x + w / 2, y + h - 40, title, 30, fill=WHITE, shadow=2.5, centre=True)
    c.setFillColor(WHITE); c.setFont('SGB', 9.5); c.drawCentredString(x + w / 2, y + h - 52, sub)
    qs = w - 44
    qr_box(c, url, x + (w - qs) / 2, y + h - 78 - qs, qs)
    c.setFillColor(GREY); c.setFont('SGB', 8.2); c.drawCentredString(x + w / 2, y + h - 94 - qs, short)
    steps(c, x + 18, y + h - 118 - qs, w - 36, items, colour)


c = canvas.Canvas(f'{OUT}.pdf', pagesize=A4)
c.setTitle('Tech Arena · Get the app'); c.setAuthor('robos.inc')
page_bg(c)

# Header
c.setFillColor(RED); c.setFont('Bang', 30); c.drawString(M, H - 58, 'TECH ARENA')
c.saveState(); c.translate(W - M - 186, H - 58); c.rotate(2)
c.setFillColor(YEL); c.setStrokeColor(INK); c.setLineWidth(2); c.rect(0, -6, 186, 24, stroke=1, fill=1)
c.setFillColor(INK); c.setFont('SGB', 11); c.drawString(10, 1, 'THE PROJECT EXPO 2026'); c.restoreState()

# Headline + burst
shout(c, M + 4, H - 150, 'GET THE APP!', 76, fill=YEL, shadow=4)
burst(c, W - 88, H - 122, 54, RED, pts=12)
c.setFillColor(WHITE); c.setFont('Bang', 24); c.drawCentredString(W - 91, H - 119, 'SCAN'); c.drawCentredString(W - 91, H - 142, 'ME!')
c.setFillColor(INK); c.setFont('SGM', 13.5)
c.drawString(M + 6, H - 186, 'Register your team, pitch to the judges and watch your score live.')

# Two platform cards
cw = (W - 2 * M - 26) / 2
ch = 488
cy = H - 222 - ch
platform_card(c, M, cy, cw, ch, 'iPHONE & iPAD', 'ALSO WORKS ON ANY LAPTOP', BLUE, WEB,
              ['Scan with the Camera app and open the link in Safari.',
               'Tap Share, then “Add to Home Screen”.',
               'Open Tech Arena from your home screen.'],
              'tech-arena.gate-orbit-server.workers.dev')
platform_card(c, M + cw + 26, cy, cw, ch, 'ANDROID', 'INSTALL THE TECH ARENA APP', GREEN, APK,
              ['Scan with your camera or Google Lens and download the app.',
               'Open the downloaded file and tap Install.',
               'If asked, allow “install unknown apps”.'],
              '.../techarena.apk')

# Bottom strip
by = cy - 66
panel(c, M, by, W - 2 * M - 6, 50, fill=YEL, shadow=5, r=12, lw=2.6)
c.setFillColor(INK); c.setFont('Bang', 22); c.drawString(M + 18, by + 18, 'NEED HELP?')
c.setFont('SGM', 11.5); c.drawString(M + 120, by + 20, 'Ask the organisers at the help desk.')

c.setFillColor(PENCIL); c.setFont('SG', 6.5); c.drawRightString(W - M, 14, 'robos.inc')
c.showPage(); c.save()

import pypdfium2 as pdfium
pdf = pdfium.PdfDocument(f'{OUT}.pdf')
pdf[0].render(scale=3).to_pil().save(f'{OUT}.png')
print('ok')
