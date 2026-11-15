# TestYard Selenium (Python) starter

```bash
cd frameworks/selenium-python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest --base-url https://YOUR-TESTYARD-URL            # Chrome, headless
pytest -m smoke -n 4 --browser firefox                 # parallel, Firefox
SELENIUM_REMOTE_URL=http://localhost:4444/wd/hub pytest   # against a Selenium Grid
pytest --html=results/report.html --self-contained-html --junitxml=results/junit.xml
```

Selenium Manager downloads the matching driver automatically, so no manual chromedriver step is needed.
Failures save a screenshot to `results/screenshots/`.
