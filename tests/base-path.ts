/**
 * Where the build under test is mounted, without a trailing slash: "" at a domain root, or a
 * sub-path such as "/~jjcorso". Set BASE_PATH to build and test the site under a sub-path.
 */
export const basePath = (process.env.BASE_PATH ?? '/').replace(/\/+$/, '');
