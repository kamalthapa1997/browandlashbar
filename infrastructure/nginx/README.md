# nginx production handoff

`merobrowandlashbar-site.conf.template` is a repository preparation artifact,
not the active production configuration. The live nginx configuration was not
available in this repository and was not accessed during Phase 5.

Before an authorized deployment, an infrastructure operator must:

1. Run `sudo nginx -T` and identify the active HTTP and HTTPS server blocks for
   the production hostname.
2. Compare the active static root, `/api` proxy, certificate directives,
   existing redirects, cache rules, and error handlers with this template.
3. Replace `__MEROBROWANDLASHBAR_SERVER_NAME__` and the certificate-path
   placeholders using the existing production values. Do not create, replace,
   or expose certificates as part of this step.
4. Preserve the template's repeated frontend headers in every static/document
   location. nginx's `add_header` inheritance stops when a child location has
   its own `add_header`.
5. Run `sudo nginx -t`. Only after it succeeds, reload nginx through the
   authorized change process.
6. Verify with `curl -I` over HTTPS for `/`, a React route such as `/gallery`,
   a hashed static asset, and `/api/health`. Confirm one frontend CSP, one API
   CSP, the expected frame/MIME/referrer/permissions headers, and HSTS.
7. Verify HTTP returns only a redirect to HTTPS; verify the certificate and the
   backend systemd service health; then check browser developer tools for CSP
   violations during Gallery, booking, admin image preview/upload, and Google
   Fonts loading.

The template gives hashed `/static/` assets immutable caching, gives HTML
`no-cache`, returns 404 for missing static files and `.map` requests, and keeps
all `/api` variants out of the React fallback. Production builds disable source
map generation as a second control.
