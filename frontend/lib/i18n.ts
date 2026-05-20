/**
 * i18n Internationalisation Configuration (G-171)
 * Supports: English (en-GB), German (de-DE), French (fr-FR), Spanish (es-ES), Polish (pl-PL)
 * Uses Next.js built-in i18n routing
 */

/** @type {import('next').NextConfig} */
const i18nConfig = {
  i18n: {
    locales:       ["en-GB", "de-DE", "fr-FR", "es-ES", "pl-PL"],
    defaultLocale: "en-GB",
    localeDetection: true,
  },
};

module.exports = i18nConfig;

// ── Translation dictionary (English base) ─────────────────────────────────────
export const translations = {
  "en-GB": {
    nav: {
      shop:      "Shop",
      deals:     "Deals",
      account:   "My Account",
      cart:      "Cart",
      search:    "Search products...",
      track:     "Track Order",
    },
    product: {
      addToCart:    "Add to Cart",
      outOfStock:   "Out of Stock",
      notifyMe:     "Notify me when back",
      reviews:      "Reviews",
      questions:    "Questions & Answers",
      similar:      "Similar Products",
      quantity:     "Quantity",
      unit:         "Unit",
    },
    checkout: {
      title:        "Checkout",
      placeOrder:   "Place Order",
      total:        "Total",
      subtotal:     "Subtotal",
      vat:          "VAT (20%)",
      delivery:     "Delivery",
      free:         "Free",
      payWith:      "Pay with",
      coupon:       "Discount Code",
      apply:        "Apply",
    },
    orders: {
      status:       "Order Status",
      track:        "Track Order",
      invoice:      "Download Invoice",
      new:          "Order Placed",
      processing:   "Being Prepared",
      dispatched:   "On its Way",
      delivered:    "Delivered",
      cancelled:    "Cancelled",
      refunded:     "Refunded",
    },
    common: {
      loading:      "Loading...",
      error:        "Something went wrong",
      retry:        "Try Again",
      save:         "Save",
      cancel:       "Cancel",
      confirm:      "Confirm",
      close:        "Close",
      back:         "Back",
      next:         "Next",
      search:       "Search",
      filter:       "Filter",
      sort:         "Sort",
      viewAll:      "View All",
    },
  },
  "de-DE": {
    nav: {
      shop:      "Shop",
      deals:     "Angebote",
      account:   "Mein Konto",
      cart:      "Warenkorb",
      search:    "Produkte suchen...",
      track:     "Bestellung verfolgen",
    },
    product: {
      addToCart:    "In den Warenkorb",
      outOfStock:   "Nicht verfügbar",
      notifyMe:     "Benachrichtigen wenn verfügbar",
      reviews:      "Bewertungen",
      questions:    "Fragen & Antworten",
      similar:      "Ähnliche Produkte",
      quantity:     "Menge",
      unit:         "Einheit",
    },
    checkout: {
      title:        "Kasse",
      placeOrder:   "Bestellung aufgeben",
      total:        "Gesamt",
      subtotal:     "Zwischensumme",
      vat:          "MwSt. (20%)",
      delivery:     "Lieferung",
      free:         "Kostenlos",
      payWith:      "Bezahlen mit",
      coupon:       "Rabattcode",
      apply:        "Anwenden",
    },
    orders: {
      status:       "Bestellstatus",
      track:        "Bestellung verfolgen",
      invoice:      "Rechnung herunterladen",
      new:          "Bestellung aufgegeben",
      processing:   "Wird vorbereitet",
      dispatched:   "Unterwegs",
      delivered:    "Geliefert",
      cancelled:    "Storniert",
      refunded:     "Erstattet",
    },
    common: {
      loading:      "Lädt...",
      error:        "Etwas ist schiefgelaufen",
      retry:        "Erneut versuchen",
      save:         "Speichern",
      cancel:       "Abbrechen",
      confirm:      "Bestätigen",
      close:        "Schließen",
      back:         "Zurück",
      next:         "Weiter",
      search:       "Suchen",
      filter:       "Filtern",
      sort:         "Sortieren",
      viewAll:      "Alle anzeigen",
    },
  },
  "fr-FR": {
    nav: {
      shop:      "Boutique",
      deals:     "Promotions",
      account:   "Mon compte",
      cart:      "Panier",
      search:    "Rechercher des produits...",
      track:     "Suivre ma commande",
    },
    product: {
      addToCart:    "Ajouter au panier",
      outOfStock:   "Rupture de stock",
      notifyMe:     "Me prévenir quand disponible",
      reviews:      "Avis",
      questions:    "Questions et réponses",
      similar:      "Produits similaires",
      quantity:     "Quantité",
      unit:         "Unité",
    },
    checkout: {
      title:        "Paiement",
      placeOrder:   "Passer la commande",
      total:        "Total",
      subtotal:     "Sous-total",
      vat:          "TVA (20%)",
      delivery:     "Livraison",
      free:         "Gratuit",
      payWith:      "Payer avec",
      coupon:       "Code promo",
      apply:        "Appliquer",
    },
    orders: {
      status:       "Statut de commande",
      track:        "Suivre ma commande",
      invoice:      "Télécharger la facture",
      new:          "Commande passée",
      processing:   "En préparation",
      dispatched:   "En route",
      delivered:    "Livré",
      cancelled:    "Annulé",
      refunded:     "Remboursé",
    },
    common: {
      loading:      "Chargement...",
      error:        "Une erreur s'est produite",
      retry:        "Réessayer",
      save:         "Enregistrer",
      cancel:       "Annuler",
      confirm:      "Confirmer",
      close:        "Fermer",
      back:         "Retour",
      next:         "Suivant",
      search:       "Rechercher",
      filter:       "Filtrer",
      sort:         "Trier",
      viewAll:      "Voir tout",
    },
  },
};

// ── useTranslation hook ───────────────────────────────────────────────────────
export type Locale = keyof typeof translations;

export function getTranslations(locale: string) {
  const lang = (locale in translations ? locale : "en-GB") as Locale;
  return translations[lang];
}
