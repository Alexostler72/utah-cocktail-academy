const IMAGE_MANIFEST_URL = "data/cocktail-images.json";
const COCKTAIL_DATA_URL = "data/cocktails.json";

let cocktailRecords = new Map();
let imageManifest = {};
let refreshQueued = false;

function fallbackMarkup() {
  return `
    <div class="cocktail-photo-fallback" aria-hidden="true">
      <div class="glass-illustration"><span class="liquid"></span></div>
    </div>`;
}

function normaliseImageConfig(id) {
  const cocktail = cocktailRecords.get(id) || {};
  const manifestEntry = imageManifest[id];

  if (typeof manifestEntry === "string") {
    return {
      src: manifestEntry,
      alt: buildAltText(cocktail),
      position: "center"
    };
  }

  if (manifestEntry && typeof manifestEntry === "object") {
    return {
      src: manifestEntry.src || manifestEntry.path || "",
      alt: manifestEntry.alt || cocktail.imageAlt || buildAltText(cocktail),
      position: manifestEntry.position || "center"
    };
  }

  if (cocktail.image) {
    return {
      src: cocktail.image,
      alt: cocktail.imageAlt || buildAltText(cocktail),
      position: cocktail.imagePosition || "center"
    };
  }

  return null;
}

function buildAltText(cocktail) {
  if (!cocktail?.name) return "Cocktail photograph";

  const details = [
    cocktail.glassware ? `served in a ${cocktail.glassware}` : "",
    cocktail.garnish && cocktail.garnish !== "None" ? `with ${cocktail.garnish}` : ""
  ].filter(Boolean).join(" ");

  return `${cocktail.name} cocktail${details ? ` ${details}` : ""}`;
}

function createPhotoImage(config, eager = false) {
  const image = document.createElement("img");
  image.className = "cocktail-photo-image";
  image.src = config.src;
  image.alt = config.alt;
  image.decoding = "async";
  image.loading = eager ? "eager" : "lazy";
  image.style.objectPosition = config.position;

  image.addEventListener("load", () => {
    image.parentElement?.classList.add("image-loaded");
  }, { once: true });

  image.addEventListener("error", () => {
    image.parentElement?.classList.add("image-missing");
    image.remove();
  }, { once: true });

  return image;
}

function enhanceCard(card) {
  if (card.dataset.photoEnhanced === "true") return;

  const id = card.dataset.openCocktail;
  if (!id) return;

  const frame = document.createElement("div");
  frame.className = "cocktail-photo-frame cocktail-card-media";
  frame.innerHTML = fallbackMarkup();

  const config = normaliseImageConfig(id);
  if (config?.src) frame.append(createPhotoImage(config));

  card.prepend(frame);
  card.dataset.photoEnhanced = "true";
}

function enhanceDailyCard() {
  const dailyCard = document.querySelector(".daily-card");
  const art = dailyCard?.querySelector(".daily-art");
  const trigger = dailyCard?.querySelector("[data-open-cocktail]");

  if (!art || !trigger || art.dataset.photoEnhanced === "true") return;

  const config = normaliseImageConfig(trigger.dataset.openCocktail);
  if (config?.src) art.append(createPhotoImage(config, true));

  art.dataset.photoEnhanced = "true";
}

function enhanceDetailHero() {
  const match = location.hash.match(/^#cocktail\/(.+)$/);
  const art = document.querySelector(".detail-hero .cocktail-art");

  if (!match || !art) return;

  const id = decodeURIComponent(match[1]);
  if (art.dataset.photoCocktail === id) return;

  art.querySelectorAll(".cocktail-photo-image").forEach(image => image.remove());
  art.classList.remove("image-loaded", "image-missing");

  const config = normaliseImageConfig(id);
  if (config?.src) art.append(createPhotoImage(config, true));

  art.dataset.photoCocktail = id;
  art.dataset.photoEnhanced = "true";
}

function enhanceCocktailImages() {
  document.querySelectorAll(".cocktail-card[data-open-cocktail]").forEach(enhanceCard);
  enhanceDailyCard();
  enhanceDetailHero();
}

function queueEnhancement() {
  if (refreshQueued) return;
  refreshQueued = true;

  requestAnimationFrame(() => {
    refreshQueued = false;
    enhanceCocktailImages();
  });
}

async function loadImageData() {
  const [cocktailResponse, manifestResponse] = await Promise.all([
    fetch(COCKTAIL_DATA_URL),
    fetch(IMAGE_MANIFEST_URL, { cache: "no-cache" })
  ]);

  if (cocktailResponse.ok) {
    const cocktails = await cocktailResponse.json();
    cocktailRecords = new Map(cocktails.map(cocktail => [cocktail.id, cocktail]));
  }

  if (manifestResponse.ok) {
    const manifest = await manifestResponse.json();
    imageManifest = manifest && typeof manifest === "object" ? manifest : {};
  }
}

async function initialiseCocktailImages() {
  try {
    await loadImageData();
  } catch (error) {
    console.warn("Cocktail image metadata could not be loaded.", error);
  }

  queueEnhancement();

  const main = document.querySelector("#main-content");
  if (main) {
    new MutationObserver(queueEnhancement).observe(main, {
      childList: true,
      subtree: true
    });
  }

  window.addEventListener("hashchange", queueEnhancement);
}

initialiseCocktailImages();
