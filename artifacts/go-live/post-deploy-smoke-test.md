# Post-deployment smoke test

## Command

Install/provide `playwright-core`, make Chrome and Edge available, then run:

```powershell
$env:SMOKE_BASE_URL = 'https://deployment.example'
$env:NODE_PATH = '<path-to-playwright-core-node_modules>'
npm run smoke:post-deploy
```

The base URL is configurable and defaults to `http://localhost:3000` only for local verification.

## Coverage

The harness executes a production-shaped Visual, Corporate, and Product case through company save, analyzed/approved structure, validated generation response, authored selection, PDF download, marker verification, and cross-case state replacement. It rejects legacy markers. It then seeds every owned storage key, uses the visible confirmation-based Clear local data control, refreshes, verifies nothing returns, and verifies an unrelated key remains.

The deterministic browser harness intercepts stochastic structure/generation responses with contract-valid fixtures so browser/deployment compatibility is reproducible. After deployment, additionally run one live model generation per family to verify provider credentials and model behavior; the readiness endpoint and credential-backed regression tests cover provider configuration but cannot substitute for the final deployed live-model smoke.

Expected family/pack pairs:

- `visual-portfolio` / `editorial-interiors-v1`
- `corporate-services` / `corporate-services-v1`
- `product-tech` / `product-tech-v1`

Any fallback, missing marker, legacy image-credit marker, failed download, stale state, or cleanup failure blocks promotion.
