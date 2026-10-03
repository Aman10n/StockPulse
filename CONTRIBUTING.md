# Contributing to StockPulse

Thanks for improving StockPulse. Keep changes focused, testable, and easy to review.

## Local workflow

1. Create a branch from `main`.
2. Create and activate a virtual environment.
3. Install development dependencies with `pip install -r requirements-dev.txt`.
4. Copy `.env.example` to `.env` if you need non-default settings.
5. Run the app with `python app.py`.
6. Run `pytest -q` before opening a pull request.

## Pull-request checklist

- [ ] The change has a clear user or maintenance benefit.
- [ ] API behavior is covered by a regression test when applicable.
- [ ] Desktop and narrow layouts were checked for visual changes.
- [ ] No local databases, logs, credentials, or virtual environments are committed.
- [ ] Documentation reflects new configuration or behavior.

## Commit style

Use concise, imperative Conventional Commit messages where practical:

```text
feat: add portfolio allocation filter
fix: preserve zero-value quote responses
docs: explain production deployment
test: cover bulk import validation
```
