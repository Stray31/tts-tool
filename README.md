# TTS-Tool

## Sharing dropdown options

1. On the browser that has the dropdown list you want to share, open **Settings** and click **Download My Options**. This downloads an options file.
2. Send that file to the other person.
3. They open **Settings** on their device and drop the file into **Use someone else’s options**, or click **Choose options file**.
4. Confirm the replacement. Their dropdowns will use the imported list, which is saved in that browser.

Importing replaces the dropdown list saved in that browser. It does not erase notes or change the list on another device. Each person can export the same file and import it on their own device. GitHub Pages does not automatically sync browser data.

To try the site locally, serve the repository through a local HTTP server so the browser can load `dropdown-options.json`; opening `index.html` directly as a `file://` URL may block that request.
