/** Hotel group detection by name — powers the Group filter everywhere. */
export const HOTEL_GROUPS = [
  { id: "marriott", label: "Marriott", re: /(marriott|courtyard|sheraton|westin|ritz[- ]carlton|st\.? regis|aloft|moxy|autograph|renaissance|m[eé]ridien|fairfield|residence inn|springhill|towneplace|four points|luxury collection|delta hotels|element|edition|w \b|w hotel)/i },
  { id: "hilton", label: "Hilton", re: /(hilton|conrad|waldorf|doubletree|hampton|embassy suites|curio|canopy|tru by|homewood|home2|tapestry|lxr|motto)/i },
  { id: "hyatt", label: "Hyatt", re: /(hyatt|andaz|thompson|alila|caption by|destination by|unbound)/i },
  { id: "ihg", label: "IHG", re: /(intercontinental|holiday inn|crowne plaza|kimpton|hotel indigo|even hotels?|staybridge|candlewood|voco|regent|six senses|avid)/i },
  { id: "accor", label: "Accor", re: /(sofitel|novotel|pullman|mercure|ibis|mgallery|swiss[oô]tel|fairmont|raffles|banyan tree|m[oö]venpick|grand mercure)/i },
];

/** Group id for a hotel name, or null when independent/unrecognized. */
export const brandGroupOf = (name) =>
  HOTEL_GROUPS.find((g) => g.re.test(name ?? ""))?.id ?? null;
