"use strict";

(() => {
  // Every tool page is in /tools/, so links here remain relative on both
  // christavakoli.com and a repository-based GitHub Pages URL.
  const home = document.body.dataset.home || "./";
  const current = location.pathname.split("/").pop() || "index.html";

const links = [
  ["PDF", "merge-pdf.html"],
  ["Images", "image-converter.html"],
  ["JSON/CSV", "json-csv.html"],
  ["Text", "text-tools.html"],
  ["QR", "qr-generator.html"],
  ["Invoices", "invoice-maker.html"],
  ["Receipts", "receipt-maker.html"]
];

  const header = document.getElementById("tools-header");
  const footer = document.getElementById("tools-footer");

  if (header) {
    const nav = links.map(([label, file]) => {
      const active = current === file ? ' aria-current="page"' : "";
      return `<a href="./${file}"${active}>${label}</a>`;
    }).join("");

    header.innerHTML = `
      <header class="site-header">
        <nav class="wrap site-nav" aria-label="Tools navigation">
          <a class="brand" href="${home}">
            <span class="brand-mark">◆</span> Private Tools
          </a>
          <div class="nav-links">
            <a href="../index.html">Main site</a>
            ${nav}
          </div>
          <button class="btn" id="theme-toggle" type="button"
                  aria-label="Switch between dark and light themes">
            Theme
          </button>
        </nav>
      </header>`;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="wrap footer-inner">
          <span>© ${new Date().getFullYear()} Christa Vakoli</span>
          <span>Your files are processed locally. Tool libraries load from a CDN.</span>
        </div>
      </footer>`;
  }

  try {
    if (localStorage.getItem("cv-tools-theme") === "light") {
      document.body.dataset.theme = "light";
    }
  } catch (_) {
    // A blocked storage API does not prevent the site from working.
  }

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = document.body.dataset.theme === "light" ? "dark" : "light";
    document.body.dataset.theme = next;

    try {
      localStorage.setItem("cv-tools-theme", next);
    } catch (_) {
      // Persisting the preference is optional.
    }
  });

  let toastTimeout;

  function toast(message) {
    let element = document.getElementById("tools-toast");

    if (!element) {
      element = document.createElement("div");
      element.id = "tools-toast";
      element.className = "toast";
      element.setAttribute("role", "status");
      document.body.append(element);
    }

    element.textContent = message;
    element.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      element.hidden = true;
    }, 3500);
  }

  function showError(message) {
    const banner = document.getElementById("error-banner");
    if (!banner) return;

    banner.textContent = message;
    banner.hidden = !message;

    if (message) {
      banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    // Delay revocation: some browsers need the URL after click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function attachDropzone(zone, input, onFiles) {
    input.addEventListener("change", () => {
      if (input.files.length) onFiles(Array.from(input.files));
      input.value = "";
    });

    ["dragenter", "dragover"].forEach(type => {
      zone.addEventListener(type, event => {
        event.preventDefault();
        zone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach(type => {
      zone.addEventListener(type, event => {
        event.preventDefault();
        zone.classList.remove("drag-over");
      });
    });

    zone.addEventListener("drop", event => {
      if (event.dataTransfer.files.length) {
        onFiles(Array.from(event.dataTransfer.files));
      }
    });
  }

  async function copy(text) {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard access is unavailable in this browser.");
    }

    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard.");
  }

  window.CVTools = { toast, showError, download, attachDropzone, copy };
})();
