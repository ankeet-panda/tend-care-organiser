"""End-to-end click-through of every Tend feature.
Usage: python -I tests/flows.py [base_url]   (default http://127.0.0.1:5230/)
Runs in Edge via Playwright. ?at=HH:MM pins the time of day (data is not saved in that mode).
"""
import sys
from playwright.sync_api import sync_playwright, expect

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5230/').rstrip('/') + '/'
results = []


def check(name, fn):
    try:
        fn()
        results.append((True, name, ''))
    except Exception as e:  # noqa: BLE001
        results.append((False, name, str(e).splitlines()[0][:200]))


def cmp(page, slot):
    return page.locator(f'article.cmp[data-slot="{slot}"]')


def supply_days(page, name):
    row = page.locator('.supply-row', has=page.locator('.supply-name', has_text=name)).first
    return row.locator('.supply-days').inner_text()


with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge')
    errors = []

    def new(at=None, w=1440, h=1000, dark=False):
        ctx = b.new_context(viewport={'width': w, 'height': h}, color_scheme='dark' if dark else 'light')
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('console', lambda m: errors.append(f'console {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        url = BASE + (f'?at={at}' if at else '') + '#/app'
        pg.goto(url)
        pg.wait_for_selector('article.cmp')
        return ctx, pg

    # ── Doses at 13:10: midday is due ──
    ctx, pg = new('13:10')

    def t_due():
        expect(cmp(pg, 'midday')).to_have_class(lambda c: 'is-due' in c) if False else None
        assert 'is-due' in cmp(pg, 'midday').get_attribute('class')
        assert 'is-given' in cmp(pg, 'morning').get_attribute('class')
        expect(pg.locator('.answer')).to_contain_text('1 of 4 given')
    check('Midday is due at 1:10 pm; morning shows as given', t_due)

    def t_give():
        before = supply_days(pg, 'Calcium')
        cmp(pg, 'midday').get_by_role('button', name='Mark given').click()
        assert 'is-given' in cmp(pg, 'midday').get_attribute('class')
        expect(cmp(pg, 'midday').locator('.lid .seal-initials')).to_have_text('Priya')
        expect(cmp(pg, 'midday').locator('.lid-caption')).to_contain_text('Given at 1:10 pm')
        expect(pg.locator('.answer')).to_contain_text('2 of 4 given')
        after = supply_days(pg, 'Calcium')
        assert before == '44 days left' and after == '43 days left', (before, after)
        expect(pg.locator('.toast')).to_contain_text('Midday dose given by Priya')
    check('Mark given closes the lid with initials, updates the answer and stock', t_give)

    def t_undo():
        pg.locator('.toast').get_by_role('button', name='Undo').click()
        assert 'is-due' in cmp(pg, 'midday').get_attribute('class')
        assert supply_days(pg, 'Calcium') == '44 days left'
    check('Undo puts the dose and the tablet back', t_undo)

    def t_skip():
        cmp(pg, 'midday').get_by_role('button', name='Not taken').click()
        cmp(pg, 'midday').get_by_role('button', name='Asleep').click()
        assert 'is-skipped' in cmp(pg, 'midday').get_attribute('class')
        expect(cmp(pg, 'midday').locator('.lid-caption')).to_contain_text('Not taken: asleep')
        cmp(pg, 'midday').get_by_role('button', name='Undo', exact=True).click()
        assert 'is-due' in cmp(pg, 'midday').get_attribute('class')
    check('Not taken records a reason; Clear reopens it', t_skip)

    def t_early():
        expect(cmp(pg, 'evening').locator('.cmp-opens')).to_have_text('Opens at 5 pm')
        assert cmp(pg, 'evening').get_by_role('button', name='Give early').count() == 0
    check('A later dose says when it opens; no early giving hours ahead', t_early)

    def t_week():
        pg.locator('.week-day').first.click()  # Monday of this week
        expect(pg.get_by_role('button', name='Back to today')).to_be_visible()
        missed = pg.locator('article.cmp.is-missed')
        if missed.count():
            missed.first.get_by_role('button', name='Log as given').click()
            assert pg.locator('article.cmp.is-missed').count() == 0
        pg.get_by_role('button', name='Back to today').click()
        expect(pg.locator('.answer')).to_contain_text('of 4 given')
    check('Week strip opens another day; a missed dose can be logged late', t_week)

    def t_asneeded():
        btn = pg.locator('.asneeded').get_by_role('button', name='Log a dose')
        assert btn.get_attribute('aria-disabled') == 'true'
        expect(pg.locator('.asneeded-main')).to_contain_text('Next from 2:40 pm')
    check('Paracetamol is held back until 4 hours after the last dose', t_asneeded)

    def t_note():
        pg.get_by_role('button', name='Write a note for the family').click()
        form = pg.locator('form.compose')
        form.get_by_role('button', name='Post note').click()
        expect(form.locator('.field-error')).to_be_visible()
        form.locator('textarea').fill('Dropped off the shopping. Mum ate all her soup.')
        form.get_by_role('button', name='Post note').click()
        expect(pg.locator('.lead-note')).to_contain_text('Dropped off the shopping')
        expect(pg.locator('.lead-note .note-who')).to_have_text('Priya')
        pg.locator('.lead-note').get_by_role('button', name='Delete this note').click()
        expect(pg.locator('.lead-note')).not_to_contain_text('Dropped off the shopping')
        pg.locator('.toast', has_text='Note deleted').get_by_role('button', name='Undo').click()
        expect(pg.locator('.lead-note')).to_contain_text('Dropped off the shopping')
    check('Post a note (empty is refused), delete it, undo', t_note)

    def t_refill():
        row = pg.locator('.supply-row', has=pg.locator('.supply-name', has_text='Furosemide'))
        row.get_by_role('button', name='Refill collected for Furosemide').click()
        row.locator('input').fill('0')
        row.get_by_role('button', name='Add to stock').click()
        expect(row.locator('.field-error')).to_be_visible()
        row.locator('input').fill('28')
        row.get_by_role('button', name='Add to stock').click()
        expect(row.locator('.supply-days')).to_have_text('34 days left')
    check('Refill adds to stock (0 refused); days left recomputed', t_refill)

    def t_meds():
        pg.locator('.supply').get_by_role('button', name='All medicines').click()
        sheet = pg.get_by_role('dialog')
        expect(sheet).to_be_visible()
        sheet.get_by_role('button', name='Add a medicine').click()
        sheet.get_by_role('button', name='Add to organiser').click()
        expect(sheet.locator('.field-error').first).to_be_visible()
        sheet.get_by_label('Name').fill('Senna')
        sheet.get_by_label('Strength').fill('7.5 mg')
        sheet.get_by_role('button', name='One fewer at morning').click()
        sheet.get_by_role('button', name='One more at bedtime').click()
        sheet.get_by_role('button', name='One more at bedtime').click()
        sheet.get_by_role('button', name='Add to organiser').click()
        expect(sheet.locator('.med-name', has_text='Senna')).to_be_visible()
        pg.keyboard.press('Escape')
        expect(pg.get_by_role('dialog')).to_have_count(0)
        expect(cmp(pg, 'bedtime').locator('.cmp-meds')).to_contain_text('Senna')
        expect(cmp(pg, 'bedtime').locator('.cmp-meds')).to_contain_text('7.5 mg × 2')
        expect(cmp(pg, 'bedtime').locator('.lid-count')).to_have_text('4 tablets')
    check('Add a medicine with a dose time; it appears in that compartment', t_meds)

    def t_stop():
        pg.locator('.supply').get_by_role('button', name='All medicines').click()
        sheet = pg.get_by_role('dialog')
        sheet.locator('.med-row', has_text='Senna').click()
        sheet.get_by_role('button', name='Stop this medicine').click()
        sheet.get_by_role('button', name='Stop Senna').click()
        expect(sheet.locator('.med-name', has_text='Senna')).to_have_count(0)
        sheet.get_by_role('button', name='Close').click()
        expect(cmp(pg, 'bedtime').locator('.cmp-meds')).not_to_contain_text('Senna')
    check('Stop a medicine (confirmed in place)', t_stop)

    def t_appt():
        pg.get_by_role('button', name='Add an appointment').click()
        sheet = pg.get_by_role('dialog')
        sheet.get_by_role('button', name='Add appointment').click()
        expect(sheet.locator('.field-error')).to_be_visible()
        sheet.get_by_label('What is it').fill('Eye test')
        sheet.get_by_text('Sam', exact=True).click()
        sheet.get_by_role('button', name='Add appointment').click()
        expect(pg.get_by_role('dialog')).to_have_count(0)
        appt = pg.locator('.appt', has_text='Eye test')
        expect(appt).to_contain_text('Sam is going')
        appt.click()
        sheet = pg.get_by_role('dialog')
        sheet.get_by_role('button', name='Remove this appointment').click()
        sheet.get_by_role('button', name='Remove appointment').click()
        expect(pg.locator('.appt', has_text='Eye test')).to_have_count(0)
    check('Add an appointment with who is going; remove it', t_appt)

    def t_me():
        pg.locator('.me-select').select_option('sam')
        pg.get_by_role('button', name='Write a note for the family').click()
        expect(pg.locator('.compose .field-hint')).to_have_text('Posting as Sam')
        pg.locator('.compose').get_by_role('button', name='Cancel').click()
        cmp(pg, 'midday').get_by_role('button', name='Mark given').click()
        expect(cmp(pg, 'midday').locator('.lid .seal-initials')).to_have_text('Sam')
    check('Switching who you are changes who gives and posts', t_me)

    def t_theme():
        pg.get_by_role('radio', name='Dark').click()
        assert pg.evaluate('document.documentElement.dataset.theme') == 'dark'
        pg.get_by_role('radio', name='Light').click()
        assert pg.evaluate('document.documentElement.dataset.theme') == 'light'
    check('Theme switch', t_theme)

    def t_keyboard_sheet():
        btn = pg.locator('.supply').get_by_role('button', name='All medicines')
        btn.focus()
        pg.keyboard.press('Enter')
        expect(pg.get_by_role('dialog')).to_be_visible()
        for _ in range(30):
            pg.keyboard.press('Tab')
        inside = pg.evaluate("!!document.activeElement.closest('[role=dialog]')")
        assert inside, 'focus left the dialog'
        pg.keyboard.press('Escape')
        assert pg.evaluate("document.activeElement.textContent.trim()") == 'All medicines', 'focus did not return'
    check('Sheet keeps focus inside, closes on Escape, returns focus', t_keyboard_sheet)
    ctx.close()

    # ── Morning before weigh-in: weight logging and the alert ──
    ctx, pg = new('08:00')

    def t_weight():
        form = pg.locator('form.weight-log')
        form.locator('input').fill('abc')
        form.get_by_role('button', name='Log weight').click()
        expect(form.locator('.field-error')).to_be_visible()
        form.locator('input').fill('66.6')
        form.get_by_role('button', name='Log weight').click()
        expect(pg.locator('.weight .figure')).to_contain_text('66.6')
        expect(pg.locator('.weight-alert')).to_contain_text('Call the heart failure nurse')
    check('Log a weight (bad value refused); a 2 kg rise raises the alert', t_weight)

    def t_morning_due():
        assert 'is-due' in cmp(pg, 'morning').get_attribute('class')
    check('At 8 am the morning compartment is due', t_morning_due)
    ctx.close()

    ctx, pg = new('16:00')

    def t_late_asneeded():
        assert 'is-late' not in cmp(pg, 'midday').get_attribute('class')  # sample: given at 1:18 pm
        btn = pg.locator('.asneeded').get_by_role('button', name='Log a dose')
        assert btn.get_attribute('aria-disabled') == 'false'
        btn.click()
        expect(pg.locator('.asneeded-main')).to_contain_text('2 today')
    check('Paracetamol can be logged once 4 hours have passed', t_late_asneeded)
    ctx.close()

    # ── Saving on the device (no pinned time) ──
    ctx, pg = new()

    def t_persist():
        pg.locator('.page-foot').get_by_role('button', name='Restore the sample household').click()
        n = pg.locator('.note').count() + pg.locator('.lead-note').count()
        pg.get_by_role('button', name='Write a note for the family').click()
        form = pg.locator('form.compose')
        form.locator('textarea').fill('Saved note check')
        form.get_by_role('button', name='Post note').click()
        pg.reload()
        pg.wait_for_selector('article.cmp')
        expect(pg.locator('.lead-note')).to_contain_text('Saved note check')
        assert pg.locator('.note').count() + pg.locator('.lead-note').count() == n + 1
        pg.locator('.page-foot').get_by_role('button', name='Restore the sample household').click()
        expect(pg.locator('.lead-note')).not_to_contain_text('Saved note check')
    check('Changes survive a reload; the sample can be restored', t_persist)
    ctx.close()

    # ── Phone width ──
    ctx, pg = new('13:10', 390, 844)

    def t_phone():
        sw = pg.evaluate('document.documentElement.scrollWidth')
        assert sw <= 390, f'page is {sw}px wide'
        expect(pg.locator('.cmp-detail')).to_contain_text('Midday, 1 pm')
        pg.locator('.cmp-detail').get_by_role('button', name='Mark given').click()
        assert 'is-given' in cmp(pg, 'midday').get_attribute('class')
        cmp(pg, 'bedtime').locator('.cmp-pick').click()
        expect(pg.locator('.cmp-detail')).to_contain_text('Bedtime, 9:30 pm')
        expect(pg.locator('.cmp-detail')).to_contain_text('Donepezil')
    check('Phone 390: no sideways scroll; pick a compartment, give from the panel under the case', t_phone)
    ctx.close()

    b.close()

ok = sum(1 for r in results if r[0])
for passed, name, msg in results:
    print(('PASS ' if passed else 'FAIL ') + name + (f'  -> {msg}' if msg else ''))
real_errors = [e for e in errors if 'React DevTools' not in e and '[vite]' not in e]
print(f'\n{ok}/{len(results)} passed')
if real_errors:
    print('Console/page errors:')
    for e in real_errors[:20]:
        print('  ' + e)
sys.exit(0 if ok == len(results) and not real_errors else 1)
