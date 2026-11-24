import type { Page } from '@playwright/test';

/** Every page of the site. */
export const pages = [
  '/',
  '/research/',
  '/vigil/',
  '/publications/',
  '/people/',
  '/resources/',
  '/teaching/',
  '/join/',
  '/media/',
];

/** Collect console errors, uncaught exceptions, and failed requests for a page. */
export function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
  });
  return problems;
}
