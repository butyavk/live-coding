// Build time: the topic page that shows each task, found by scanning the docs for <Task id="…" />,
// in each language ("sql-tasks/revenue-reports/", without the base and the locale). The mock
// picker (MockInterview.astro) filters tasks by the study plan's pages with it; a mock page
// (MockPage.astro) links to it as "Open the walkthrough" once the mock is over.
import { getCollection } from 'astro:content';

export type TaskPages = Record<string, { en?: string; ru?: string }>;

export async function taskPages(): Promise<TaskPages> {
  const where: TaskPages = {};
  for (const entry of await getCollection('docs')) {
    const ru = entry.id.startsWith('ru/');
    const slug = (ru ? entry.id.slice(3) : entry.id).replace(/(^|\/)index$/, '');
    for (const m of (entry.body ?? '').matchAll(/<Task\s+id=["']([a-z0-9]+)["']/g)) {
      (where[m[1]] ??= {})[ru ? 'ru' : 'en'] = slug ? `${slug}/` : '';
    }
  }
  return where;
}

/** The topic page of a task in a language, with the base: the Russian page, or the English one. */
export function taskPageHref(where: TaskPages, id: string, locale: 'en' | 'ru'): string | null {
  const w = where[id];
  if (!w) return null;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  if (locale === 'ru' && w.ru !== undefined) return `${base}ru/${w.ru}`;
  return w.en !== undefined ? `${base}${w.en}` : null;
}

/** getStaticPaths of the mock pages: every task that is placed on a page. */
export async function mockPaths() {
  return Object.keys(await taskPages()).map((id) => ({ params: { id } }));
}
