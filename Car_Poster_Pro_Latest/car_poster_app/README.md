# Car Poster Pro — Updated MVP Prototype

Working prototype for car salespeople to generate Facebook Marketplace captions from inventory.

## What’s new
- **Caption styles**: Professional, Casual / Salesy, or Short & Simple
- **More fields**: Optionally include VIN, stock number, transmission, and fuel
- **Improved Chrome extension**: Better field detection for Marketplace forms
- **Landing page**: `landing.html` — simple product page you can open in a browser
- **Easy start (Windows)**: Double-click `START.bat`

## Quick start (Windows)

1. Extract the folder
2. Double-click **`START.bat`**
3. It will install dependencies (first time) and open the app in your browser

## Manual start (any computer)

```bash
cd car_poster_app
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

Then open http://localhost:8501

## Chrome extension

1. Go to `chrome://extensions`
2. Turn on Developer mode
3. Click “Load unpacked”
4. Select the `chrome_extension` folder
5. Open Facebook Marketplace → Create Listing → Vehicle
6. Click the extension icon and try “Fill Current Marketplace Form”

**Note:** Facebook changes its page often. The extension is improved but still a prototype. Always review before publishing.

## Landing page

Open `landing.html` in any browser to see a simple product page.

## CSV format
Required: `year`, `make`, `model`, `price`, `mileage`  
Optional: `trim`, `vin`, `stock`, `exterior_color`, `interior_color`, `transmission`, `fuel`, `description`, `image_urls`

## Compliance reminder
This tool helps prepare listings. You stay logged in and click Publish. Meta’s rules around automated posting are a gray area — use responsibly and keep listings accurate.

---

Prototype built for testing the concept. Ready for further development.
