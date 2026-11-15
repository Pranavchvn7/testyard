# CI/CD examples

Ready-to-adapt pipeline files for the TestYard automation starters. Replace `YOUR-TESTYARD-URL` with your deployed site.

| File | What it shows |
|---|---|
| `../playwright/.github-workflow-examples/pr-e2e-sharded.yml` | GitHub Actions: browser matrix x shards, merged HTML report, Slack alert |
| `../playwright/.github-workflow-examples/nightly.yml` | Scheduled regression with a manual grep input |
| `../playwright/.github-workflow-examples/reusable-e2e.yml` + `caller-reusable.yml` | Reusable workflow and a caller |
| `../playwright/.github-workflow-examples/docker-container.yml` | Job running in the Playwright Docker image |
| `../playwright/.github-workflow-examples/publish-report-pages.yml` | HTML report on GitHub Pages and a status badge |
| `github-actions/selenium-grid.yml` | Selenium Grid service container |
| `github-actions/newman-api.yml` | Postman collection through Newman |
| `Jenkinsfile`, `gitlab-ci.yml`, `azure-pipelines.yml`, `circleci-config.yml`, `bitbucket-pipelines.yml` | The same pipeline on other CI systems |
| `Dockerfile.tests`, `docker-compose.yml` | Containerised test runs and a Selenium Grid |

Pin the Playwright Docker image tag to the exact `@playwright/test` version in your `package.json`.
