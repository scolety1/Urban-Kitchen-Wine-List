# Private Urban Kitchen Beverage Manager

This is a separate Google Apps Script project from the public read-only beverage feed. Deploy it as a Web app that requires Google account access. Every server method also checks the signed-in email against `ALLOWED_MANAGER_EMAILS`.

Configure these Script Properties in the private project; never add their values to Git:

- `ALLOWED_MANAGER_EMAILS`: comma-separated owner/manager Google account addresses.
- `GITHUB_TOKEN`: fine-grained token limited to `scolety1/Urban-Kitchen-Wine-List` with Actions workflow dispatch permission.
- `GITHUB_OWNER`: `scolety1`.
- `GITHUB_REPO`: `Urban-Kitchen-Wine-List`.
- `GITHUB_WORKFLOW`: `publish-inventory.yml`.

Deploy as the user accessing the web app. Restrict access to the intended Google accounts whenever the deployment UI permits; the server allowlist remains mandatory even when deployment access is restricted.

The private app may update only the guest-field allowlists in `WineReview.gs`, `OtherBeverages.gs`, and `whiskeyWritePlan_`. The public read-only feed remains responsible for filtering `Show on QR = TRUE` and projecting guest-safe fields.

