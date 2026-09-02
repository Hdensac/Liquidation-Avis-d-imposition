"use server";

import { createClient } from "@/utils/supabase/server";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";
import { buildTpsCalculations } from "@/utils/tpsCalculations";

export interface TaxpayerItem {
  id: string;
  ifu: string;
  name: string;
  phone: string;
  commune: string;
  totalProperties: number;
  totalActivities: number;
  totalLiquidations: number;
  totalAmountDues: number;
  totalPaid: number;
  balanceDue: number;
  status: "A_JOUR" | "SOLDE_DEBITEUR";
  lastOperationDate: string;
}

export interface TaxpayerDetail {
  ifu: string;
  name: string;
  phone: string;
  commune: string;
  arrondissement: string;
  quartier: string;
  properties: Array<{
    id: string;
    typeBien: string;
    commune: string;
    arrondissement: string;
    quartier: string;
    superficie: number;
    superficieImposable: number;
    valeurLocative: number;
    isLoue?: boolean;
    description?: string;
    referenceLiq: string;
    created_at: string;
  }>;
  activities: Array<{
    id: string;
    activite: string;
    commune: string;
    arrondissement: string;
    quartier: string;
    montantAutresActivites: number;
    referenceTps: string;
    created_at: string;
  }>;
  liquidations: Array<{
    id: string;
    type: "TFU" | "TPS";
    reference: string;
    commune: string;
    startYear: number;
    totalDroits: number;
    status: string;
    created_at: string;
    description: string;
  }>;
  totalLiquidated: number;
  totalPaid: number;
  balanceDue: number;
}

/**
 * Normalise une chaîne pour la recherche/regroupement
 */
function normalizeKey(str: string): string {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]/gi, "");
}

/**
 * Récupère la liste agrégrée de tous les contribuables (TFU & TPS)
 */
export async function fetchTaxpayers(searchQuery = "", page = 1, pageSize = 20): Promise<{
  data: TaxpayerItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = await createClient();

  // 1. Récupérer toutes les liquidations TFU avec leurs contribuables
  const { data: tfuData, error: tfuError } = await supabase
    .from("liquidations")
    .select(`
      id,
      status,
      commune,
      arrondissement,
      quartier,
      reference_liq,
      created_at,
      type_bien,
      superficie,
      superficie_imposable,
      valeur_locative,
      start_year,
      is_loue,
      valeur_irf,
      description,
      contribuable:contribuables (
        id,
        nom_prenoms,
        ifu_npi,
        telephone
      )
    `)
    .order("created_at", { ascending: false });

  if (tfuError) {
    console.error("Error fetching TFU liquidations for taxpayers:", tfuError);
  }

  // 2. Récupérer toutes les liquidations TPS
  const { data: tpsData, error: tpsError } = await supabase
    .from("tps_liquidations")
    .select(`
      id,
      status,
      commune,
      arrondissement,
      quartier,
      reference_tps,
      created_at,
      nom_raison_sociale,
      ifu_nc,
      telephone,
      activite,
      montant_autres_activites,
      acomptes_payes,
      start_year
    `)
    .order("created_at", { ascending: false });

  if (tpsError) {
    console.error("Error fetching TPS liquidations for taxpayers:", tpsError);
  }

  // Map pour agréger par IFU ou Nom
  const taxpayersMap = new Map<string, {
    ifu: string;
    name: string;
    phone: string;
    commune: string;
    propertiesCount: number;
    activitiesCount: number;
    liquidationsCount: number;
    totalAmountDues: number;
    totalPaid: number;
    lastDate: string;
    keysToMatch: string[];
  }>();

  // Traitement TFU
  (tfuData || []).forEach((liq: any) => {
    const contrib = Array.isArray(liq.contribuable) ? liq.contribuable[0] : liq.contribuable;
    if (!contrib && !liq.reference_liq) return;

    const ifu = (contrib?.ifu_npi || "").trim();
    const name = (contrib?.nom_prenoms || "Contribuable Inconnu").trim();
    const phone = (contrib?.telephone || "").trim();
    const commune = (liq.commune || "").trim();

    // Clé unique de regroupement: IFU prioritaire, sinon Nom normalisé
    const key = ifu ? `IFU_${normalizeKey(ifu)}` : `NAME_${normalizeKey(name)}`;

    // Calcul dynamique des droits TFU
    let totalDroits = 0;
    try {
      const calc = buildLiquidationCalculations({
        fullname: name,
        ifuNpi: ifu,
        phone,
        commune,
        arrondissement: liq.arrondissement || "",
        quartier: liq.quartier || "",
        typeBien: liq.type_bien || "NON_BATI",
        superficie: Number(liq.superficie) || 0,
        superficieImposable: liq.superficie_imposable !== null ? Number(liq.superficie_imposable) : "",
        valeurLocative: Number(liq.valeur_locative) || 0,
        startYear: Number(liq.start_year) || 2023,
        isLoue: Boolean(liq.is_loue),
        valeurIrf: Number(liq.valeur_irf) || "",
        description: liq.description || "",
      });
      totalDroits = calc.totalDu || 0;
    } catch (e) {
      console.error("Error calculating TFU droits:", e);
    }

    const isPaid = liq.status === "PAYE";
    const paidAmount = isPaid ? totalDroits : 0;

    let existing = taxpayersMap.get(key);
    if (!existing) {
      existing = {
        ifu: ifu || "N/A",
        name,
        phone,
        commune,
        propertiesCount: 0,
        activitiesCount: 0,
        liquidationsCount: 0,
        totalAmountDues: 0,
        totalPaid: 0,
        lastDate: liq.created_at || new Date().toISOString(),
        keysToMatch: [ifu, name, phone, commune, liq.reference_liq].filter(Boolean),
      };
      taxpayersMap.set(key, existing);
    } else {
      if (!existing.phone && phone) existing.phone = phone;
      if (!existing.ifu || existing.ifu === "N/A") existing.ifu = ifu || "N/A";
      if (!existing.commune && commune) existing.commune = commune;
      if (new Date(liq.created_at) > new Date(existing.lastDate)) {
        existing.lastDate = liq.created_at;
      }
      if (liq.reference_liq) existing.keysToMatch.push(liq.reference_liq);
    }

    existing.propertiesCount += 1;
    existing.liquidationsCount += 1;
    existing.totalAmountDues += totalDroits;
    existing.totalPaid += paidAmount;
  });

  // Traitement TPS
  (tpsData || []).forEach((tps: any) => {
    const ifu = (tps.ifu_nc || "").trim();
    const name = (tps.nom_raison_sociale || "Contribuable Inconnu").trim();
    const phone = (tps.telephone || "").trim();
    const commune = (tps.commune || "").trim();

    const key = ifu ? `IFU_${normalizeKey(ifu)}` : `NAME_${normalizeKey(name)}`;

    // Calcul dynamique des droits TPS
    let totalDroits = 0;
    try {
      const calc = buildTpsCalculations({
        montantAutresActivites: Number(tps.montant_autres_activites) || 0,
        acomptesPayes: Number(tps.acomptes_payes) || 0,
        startYear: Number(tps.start_year) || 2024,
      });
      totalDroits = calc.impotDu || 0;
    } catch (e) {
      console.error("Error calculating TPS droits:", e);
    }

    const isPaid = tps.status === "PAYE" || tps.status === "VALIDE";
    const paidAmount = isPaid ? totalDroits : 0;

    let existing = taxpayersMap.get(key);
    if (!existing) {
      existing = {
        ifu: ifu || "N/A",
        name,
        phone,
        commune,
        propertiesCount: 0,
        activitiesCount: 0,
        liquidationsCount: 0,
        totalAmountDues: 0,
        totalPaid: 0,
        lastDate: tps.created_at || new Date().toISOString(),
        keysToMatch: [ifu, name, phone, commune, tps.reference_tps].filter(Boolean),
      };
      taxpayersMap.set(key, existing);
    } else {
      if (!existing.phone && phone) existing.phone = phone;
      if (!existing.ifu || existing.ifu === "N/A") existing.ifu = ifu || "N/A";
      if (!existing.commune && commune) existing.commune = commune;
      if (new Date(tps.created_at) > new Date(existing.lastDate)) {
        existing.lastDate = tps.created_at;
      }
      if (tps.reference_tps) existing.keysToMatch.push(tps.reference_tps);
    }

    existing.activitiesCount += 1;
    existing.liquidationsCount += 1;
    existing.totalAmountDues += totalDroits;
    existing.totalPaid += paidAmount;
  });

  let allList = Array.from(taxpayersMap.entries()).map(([id, t]) => {
    const balanceDue = Math.max(0, t.totalAmountDues - t.totalPaid);
    return {
      id,
      ifu: t.ifu,
      name: t.name,
      phone: t.phone || "—",
      commune: t.commune || "—",
      totalProperties: t.propertiesCount,
      totalActivities: t.activitiesCount,
      totalLiquidations: t.liquidationsCount,
      totalAmountDues: t.totalAmountDues,
      totalPaid: t.totalPaid,
      balanceDue,
      status: (balanceDue === 0 ? "A_JOUR" : "SOLDE_DEBITEUR") as "A_JOUR" | "SOLDE_DEBITEUR",
      lastOperationDate: t.lastDate,
      _searchStr: t.keysToMatch.join(" ").toLowerCase(),
    };
  });

  // Filtrage
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    allList = allList.filter((item) =>
      item._searchStr.includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.ifu.toLowerCase().includes(q) ||
      item.phone.includes(q) ||
      item.commune.toLowerCase().includes(q)
    );
  }

  // Tri par date récents d'abord
  allList.sort((a, b) => new Date(b.lastOperationDate).getTime() - new Date(a.lastOperationDate).getTime());

  const total = allList.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedData = allList.slice(startIndex, startIndex + pageSize).map(({ _searchStr, ...rest }) => rest);

  return {
    data: paginatedData,
    total,
    page,
    pageSize,
  };
}

/**
 * Récupère le détail exhaustif d'un contribuable spécifique
 */
export async function getTaxpayerDetails(keyOrIfuOrName: string): Promise<TaxpayerDetail | null> {
  const supabase = await createClient();

  const searchClean = keyOrIfuOrName.replace(/^(IFU_|NAME_)/, "").trim();

  // 1. Récupérer toutes les liquidations TFU
  const { data: tfuList, error: tfuErr } = await supabase
    .from("liquidations")
    .select(`
      id,
      status,
      commune,
      arrondissement,
      quartier,
      type_bien,
      superficie,
      superficie_imposable,
      valeur_locative,
      is_loue,
      valeur_irf,
      description,
      start_year,
      reference_liq,
      created_at,
      contribuable:contribuables (
        id,
        nom_prenoms,
        ifu_npi,
        telephone
      )
    `)
    .order("created_at", { ascending: false });

  if (tfuErr) console.error("Error in getTaxpayerDetails TFU:", tfuErr);

  // 2. Récupérer toutes les liquidations TPS
  const { data: tpsList, error: tpsErr } = await supabase
    .from("tps_liquidations")
    .select(`
      id,
      status,
      commune,
      arrondissement,
      quartier,
      activite,
      montant_autres_activites,
      acomptes_payes,
      start_year,
      reference_tps,
      created_at,
      nom_raison_sociale,
      ifu_nc,
      telephone
    `)
    .order("created_at", { ascending: false });

  if (tpsErr) console.error("Error in getTaxpayerDetails TPS:", tpsErr);

  const normTarget = normalizeKey(searchClean);

  let matchIfu = "";
  let matchName = "";
  let matchPhone = "";
  let matchCommune = "";

  const matchedPropertiesMap = new Map<string, any>();
  const matchedActivitiesMap = new Map<string, any>();
  const matchedLiquidations: TaxpayerDetail["liquidations"] = [];

  let totalLiquidated = 0;
  let totalPaid = 0;

  // Filtrer TFU
  (tfuList || []).forEach((liq: any) => {
    const contrib = Array.isArray(liq.contribuable) ? liq.contribuable[0] : liq.contribuable;
    if (!contrib) return;

    const ifu = (contrib.ifu_npi || "").trim();
    const name = (contrib.nom_prenoms || "").trim();

    const isMatch = (ifu && normalizeKey(ifu) === normTarget) ||
      (name && normalizeKey(name) === normTarget) ||
      keyOrIfuOrName.includes(normalizeKey(ifu)) ||
      keyOrIfuOrName.includes(normalizeKey(name));

    if (!isMatch) return;

    if (!matchIfu && ifu) matchIfu = ifu;
    if (!matchName && name) matchName = name;
    if (!matchPhone && contrib.telephone) matchPhone = contrib.telephone;
    if (!matchCommune && liq.commune) matchCommune = liq.commune;

    const propKey = `${liq.commune}_${liq.arrondissement}_${liq.type_bien}_${liq.superficie}_${liq.valeur_locative}`;
    if (!matchedPropertiesMap.has(propKey)) {
      matchedPropertiesMap.set(propKey, {
        id: liq.id,
        typeBien: liq.type_bien || "NON_BATI",
        commune: liq.commune || "—",
        arrondissement: liq.arrondissement || "—",
        quartier: liq.quartier || "—",
        superficie: Number(liq.superficie) || 0,
        superficieImposable: Number(liq.superficie_imposable) || 0,
        valeurLocative: Number(liq.valeur_locative) || 0,
        isLoue: Boolean(liq.is_loue),
        description: liq.description || "",
        referenceLiq: liq.reference_liq || "—",
        created_at: liq.created_at,
      });
    }

    let amount = 0;
    try {
      const calc = buildLiquidationCalculations({
        fullname: name,
        ifuNpi: ifu,
        phone: contrib.telephone || "",
        commune: liq.commune || "",
        arrondissement: liq.arrondissement || "",
        quartier: liq.quartier || "",
        typeBien: liq.type_bien || "NON_BATI",
        superficie: Number(liq.superficie) || 0,
        superficieImposable: liq.superficie_imposable !== null ? Number(liq.superficie_imposable) : "",
        valeurLocative: Number(liq.valeur_locative) || 0,
        startYear: Number(liq.start_year) || 2023,
        isLoue: Boolean(liq.is_loue),
        valeurIrf: Number(liq.valeur_irf) || "",
        description: liq.description || "",
      });
      amount = calc.totalDu || 0;
    } catch (e) {
      console.error("Error calc details TFU:", e);
    }

    const isPaid = liq.status === "PAYE";

    totalLiquidated += amount;
    if (isPaid) totalPaid += amount;

    matchedLiquidations.push({
      id: liq.id,
      type: "TFU",
      reference: liq.reference_liq || "—",
      commune: liq.commune || "—",
      startYear: Number(liq.start_year) || 2024,
      totalDroits: amount,
      status: liq.status || "EN_ATTENTE",
      created_at: liq.created_at,
      description: `TFU ${liq.type_bien === "BATI" ? "Foncier Bâti" : "Foncier Non Bâti"} - ${liq.commune || ""}`,
    });
  });

  // Filtrer TPS
  (tpsList || []).forEach((tps: any) => {
    const ifu = (tps.ifu_nc || "").trim();
    const name = (tps.nom_raison_sociale || "").trim();

    const isMatch = (ifu && normalizeKey(ifu) === normTarget) ||
      (name && normalizeKey(name) === normTarget) ||
      keyOrIfuOrName.includes(normalizeKey(ifu)) ||
      keyOrIfuOrName.includes(normalizeKey(name));

    if (!isMatch) return;

    if (!matchIfu && ifu) matchIfu = ifu;
    if (!matchName && name) matchName = name;
    if (!matchPhone && tps.telephone) matchPhone = tps.telephone;
    if (!matchCommune && tps.commune) matchCommune = tps.commune;

    const actKey = `${tps.commune}_${tps.activite}`;
    if (!matchedActivitiesMap.has(actKey)) {
      matchedActivitiesMap.set(actKey, {
        id: tps.id,
        activite: tps.activite || "Activite non specifiee",
        commune: tps.commune || "—",
        arrondissement: tps.arrondissement || "—",
        quartier: tps.quartier || "—",
        montantAutresActivites: Number(tps.montant_autres_activites) || 0,
        referenceTps: tps.reference_tps || "—",
        created_at: tps.created_at,
      });
    }

    let amount = 0;
    try {
      const calc = buildTpsCalculations({
        montantAutresActivites: Number(tps.montant_autres_activites) || 0,
        acomptesPayes: Number(tps.acomptes_payes) || 0,
        startYear: Number(tps.start_year) || 2024,
      });
      amount = calc.impotDu || 0;
    } catch (e) {
      console.error("Error calc details TPS:", e);
    }

    const isPaid = tps.status === "PAYE" || tps.status === "VALIDE";

    totalLiquidated += amount;
    if (isPaid) totalPaid += amount;

    matchedLiquidations.push({
      id: tps.id,
      type: "TPS",
      reference: tps.reference_tps || "—",
      commune: tps.commune || "—",
      startYear: Number(tps.start_year) || 2024,
      totalDroits: amount,
      status: tps.status || "EN_ATTENTE",
      created_at: tps.created_at,
      description: `TPS - ${tps.activite || "Activité synthétique"}`,
    });
  });

  if (matchedLiquidations.length === 0 && !matchName) {
    return null;
  }

  matchedLiquidations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const balanceDue = Math.max(0, totalLiquidated - totalPaid);

  return {
    ifu: matchIfu || "Non renseigné",
    name: matchName || searchClean || "Contribuable",
    phone: matchPhone || "—",
    commune: matchCommune || "—",
    arrondissement: "—",
    quartier: "—",
    properties: Array.from(matchedPropertiesMap.values()),
    activities: Array.from(matchedActivitiesMap.values()),
    liquidations: matchedLiquidations,
    totalLiquidated,
    totalPaid,
    balanceDue,
  };
}

