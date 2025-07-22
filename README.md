# Superhero/Villain Dashboard

This small single-page web application loads character data from [akabab/superhero-api](https://github.com/akabab/superhero-api) and allows filtering, sorting and viewing details.

## Running

Serve the static files using Python's built-in HTTP server:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

## Project structure

- `index.html` – main HTML page.
- `style.css` – styling for cards, table view and modals.
- `app.js` – client-side logic for fetching data, rendering views and handling events.

## Features

- Toggle between card and list views.
- Search across multiple attributes (power stats, appearance and biography).
- Pagination with adjustable page size.
- Modals for advanced filtering and sorting options.
- Detail overlay showing extended information for a selected character.

