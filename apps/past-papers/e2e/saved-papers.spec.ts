import { test, expect, type BrowserContext } from '@playwright/test';
import { seedAuth } from './support/auth';

/**
 * The history panel (SavedPapersPanel) — the one thing an account adds on top
 * of a generator that's fully usable signed out. Three things worth proving:
 *  1. Signed out, it's the pitch, not a locked/hidden feature.
 *  2. Signed in, it lists real saved_papers rows with a working delete.
 *  3. Generating a paper while signed in actually writes a row — the wiring
 *     between GeneratePaperPage's handleGenerate and @/lib/savedPapers.
 */

const folder = (name: string) => ({ name, id: null });
const file = (name: string, id: string) => ({ name, id });

const TREE: Record<string, unknown[]> = {
  '': [folder('0607')],
  '0607': [folder('Paper 2')],
  '0607/Paper 2': [
    file('3-Number-and-Algebra-QP.pdf', 'f1'),
    file('3-Number-and-Algebra-MS.pdf', 'f2'),
  ],
};

const QUESTIONS_METADATA = [
  { id: 'P2-001', chapter_num: 3, paper: 'June-2014-1' },
  { id: 'P2-002', chapter_num: 3, paper: 'June-2015-1' },
];

async function stubPaperTree(context: BrowserContext) {
  await context.route('**/storage/v1/object/list/**', (route) => {
    const prefix = (route.request().postDataJSON()?.prefix ?? '').replace(/\/$/, '');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TREE[prefix] ?? []),
    });
  });
}

async function stubChapterQuestions(context: BrowserContext) {
  await context.route('**/api/chapter-questions*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: QUESTIONS_METADATA }),
    }),
  );
}

async function stubComposePaper(context: BrowserContext) {
  await context.route('**/api/compose-paper', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pdfBase64: Buffer.from('%PDF-1.4 fake').toString('base64'),
        metadata: {},
      }),
    }),
  );
}

async function stubRestCatchAll(context: BrowserContext) {
  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

test('signed out, the history panel pitches signing in rather than hiding', async ({
  page,
  context,
}) => {
  await stubRestCatchAll(context);
  await page.goto('/');

  await expect(page.getByText('Your papers, wherever you sign in')).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/signin\?next=%2F&hint=history$/);
  await expect(page.getByText('Sign in to keep every paper you generate.')).toBeVisible();
});

test('signed in, the history panel lists saved papers with working delete', async ({
  page,
  context,
}) => {
  const rows = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      user_id: '00000000-0000-4000-8000-00000000e2e5',
      created_at: '2026-08-20T00:00:00.000Z',
      subject: '0607',
      component: 'Paper 2',
      file_name: 'International-Mathematics-Paper-2-2026-08-20.pdf',
      question_ids: ['P2-001', 'P2-002'],
      include_mark_scheme: true,
      randomize: true,
      r2_key: null,
    },
  ];

  await seedAuth(context, { saved_papers: rows });
  await page.goto('/');

  await expect(page.getByText('International Mathematics · Paper 2')).toBeVisible();
  await expect(page.getByText('2 questions')).toBeVisible();

  let deleteRequestId: string | null = null;
  await context.route('**/rest/v1/saved_papers*', (route) => {
    if (route.request().method() === 'DELETE') {
      deleteRequestId = new URL(route.request().url()).searchParams.get('id');
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    });
  });

  await page
    .getByRole('button', { name: 'Delete International-Mathematics-Paper-2-2026-08-20.pdf' })
    .click();

  await expect(page.getByText('International Mathematics · Paper 2')).toHaveCount(0);
  expect(deleteRequestId).toContain(rows[0].id);
});

test('generating a paper while signed in saves it to history', async ({ page, context }) => {
  await seedAuth(context, { saved_papers: [] });
  await stubPaperTree(context);
  await stubChapterQuestions(context);
  await stubComposePaper(context);

  let insertedBody: Record<string, unknown> | null = null;
  await context.route('**/rest/v1/saved_papers*', (route) => {
    if (route.request().method() === 'POST') {
      insertedBody = route.request().postDataJSON();
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'International Mathematics' }).click();
  await page.getByRole('button', { name: 'Paper 2' }).click();
  await page.getByRole('checkbox', { name: 'Select Number and Algebra' }).check();
  await page.getByRole('button', { name: 'Generate Paper' }).click();
  await expect(page.getByText('has been generated')).toBeVisible();

  await expect.poll(() => insertedBody).not.toBeNull();
  expect(insertedBody).toMatchObject({
    subject: '0607',
    component: 'Paper 2',
    include_mark_scheme: true,
    randomize: true,
  });
});
