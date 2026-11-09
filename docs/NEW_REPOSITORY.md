# Upload under your work account

This distribution is a source-only copy. It contains no `.git` directory, Git author history, former hard-coded Worker URL or configured D1 database ID. The original GPL license is preserved. Required license and copyright notices should remain intact.

Creating a repository from these files creates a fresh history. It does not erase old forks, clones, cached pages, notifications, search results or other public records. You do not need to delete the old repository to test this replacement; verify the replacement before deleting anything.

## Manual upload

1. Sign into the intended **work** GitHub account. Confirm the avatar/account before creating the repository. Creating in an organization still records commits under the account making them.
2. Create a new empty repository rather than a fork or repository import. Choose the intended owner. Do not copy the old Git history or push an old clone to it.
3. Extract the supplied ZIP. Upload the **contents** of its project folder so `index.html`, `assets/`, `data/` and `.github/` are at the repository root. Include `.gitignore` and `.github/workflows/pages.yml`; file managers may hide dotfiles. Do not upload the ZIP as the application.
4. Commit through GitHub's web interface while signed into the work account. Inspect the resulting commit's author before continuing. The first commit should be attributed to the intended work account.
5. Under **Settings → Pages**, choose **GitHub Actions** as the source. Under **Actions**, enable workflows if prompted and run **Refresh data and deploy Pages** manually once after configuring Pages.
6. Open the deployed Pages URL. Test News Intelligence and a local scenario. The scheduled job runs every three hours on the default branch; GitHub may delay it. Deployments publish only HTML, assets, public data, and the license. Scheduled snapshots are deployed as artifacts rather than committed, so prior good snapshots are retained with Actions cache, with the included official-news snapshot as a fallback. Cache retention is best effort. Browser caches provide another fallback per device.
7. Optionally add the `FRED_API_KEY` repository secret for official observations. No secret is needed for news or the local model path.

The optional Worker uses `worker/wrangler.toml.example`. Copy it to `worker/wrangler.toml`, set your work deployment origin, and provision your own services. Do not reuse the former account's resources. Add your own endpoint through the app's endpoint field. If testing in a browser that ran the old site on the same origin, clear that site's local storage (this also deletes locally saved scenarios; export those first) to remove any previously saved endpoint.

## If you later use Git locally

Set identity for the **new checkout**, using the exact work-account name and verified work email or GitHub-provided noreply address:

```sh
git config --local user.name "YOUR WORK NAME"
git config --local user.email "YOUR WORK ACCOUNT NOREPLY ADDRESS"
git config --local --get user.name
git config --local --get user.email
```

Git authentication selects who may push; commit name/email determines attribution. They are separate. Review `git log -1 --format=fuller` before pushing. Do not copy an old `.git` directory into the new project.

Review GitHub app installations and the accounts connected to your development tools separately. Removing a runtime URL from source does not change those connections.
